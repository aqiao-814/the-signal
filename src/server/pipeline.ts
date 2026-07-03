import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { ingestPerson } from "@/server/x/ingest";
import { generateBriefing } from "@/server/ai/summarize";
import { getIngestSource } from "@/server/x/source";
import { spendCredits } from "@/server/credits";
import {
  recentWindow,
  scheduledWindow,
  type BriefWindow,
} from "@/server/schedule";
import { env } from "@/lib/env";

const log = createLogger("pipeline");

export interface PipelineOptions {
  window?: BriefWindow;
  personIds?: string[];
  /** Only process people at least one user follows (default: all tracked). */
  selectedOnly?: boolean;
}

/**
 * Ingest fresh activity for a person over a window and generate a briefing
 * from the notable posts in it. Safe to retry (idempotent).
 */
export async function runPersonPipeline(
  personId: string,
  window?: BriefWindow,
) {
  const win = window ?? recentWindow();
  const person = await prisma.trackedPerson.findUnique({
    where: { id: personId },
  });
  if (!person) return null;

  const ingest = await ingestPerson(
    {
      id: person.id,
      handle: person.handle,
      name: person.name,
      xUserId: person.xUserId,
    },
    { since: win.from, maxTweets: 50 },
  );
  const summary = await generateBriefing(person.id, win, { force: true });

  return { handle: person.handle, ingest, summarized: Boolean(summary) };
}

/**
 * Scheduled pipeline: ingest + (re)generate briefings for a coverage window.
 * Records a JobRun for observability. Idempotent end to end.
 */
export async function runDailyPipeline(opts: PipelineOptions = {}) {
  const win = opts.window ?? scheduledWindow();
  const job = await prisma.jobRun.create({
    data: {
      jobName: "digest",
      status: "RUNNING",
      meta: {
        from: win.from.toISOString(),
        to: win.to.toISOString(),
        ingestMode: env.INGEST_MODE,
        aiProvider: env.AI_PROVIDER,
      },
    },
  });

  try {
    const where = opts.personIds
      ? { id: { in: opts.personIds } }
      : opts.selectedOnly
        ? { selectedBy: { some: {} } }
        : {};
    const people = await prisma.trackedPerson.findMany({ where });

    const source = getIngestSource();
    const callsBefore = source.callCount();

    let processed = 0;
    let summarized = 0;
    for (const person of people) {
      try {
        const res = await runPersonPipeline(person.id, win);
        processed += 1;
        if (res?.summarized) summarized += 1;
      } catch (err) {
        log.error("person pipeline failed", {
          handle: person.handle,
          error: (err as Error).message,
        });
      }
    }

    await spendCredits(source.callCount() - callsBefore);

    await prisma.jobRun.update({
      where: { id: job.id },
      data: {
        status: "SUCCESS",
        finishedAt: new Date(),
        itemsProcessed: processed,
        meta: { people: people.length, summarized },
      },
    });

    log.info("pipeline complete", { processed, summarized });
    return { jobId: job.id, processed, summarized };
  } catch (err) {
    await prisma.jobRun.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        error: (err as Error).message,
      },
    });
    throw err;
  }
}
