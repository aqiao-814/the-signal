import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { ingestPerson } from "@/server/x/ingest";
import { generateSummaryForPerson } from "@/server/ai/summarize";
import { getIngestSource } from "@/server/x/source";
import { spendCredits } from "@/server/credits";
import { env } from "@/lib/env";

const log = createLogger("pipeline");

export interface PipelineOptions {
  date?: Date;
  personIds?: string[];
  /** Only process people at least one user follows (default: all tracked). */
  selectedOnly?: boolean;
}

/** Run ingest + summarize for a single person. Safe to retry (idempotent). */
export async function runPersonPipeline(personId: string, date?: Date) {
  const person = await prisma.trackedPerson.findUnique({
    where: { id: personId },
  });
  if (!person) return null;

  const ingest = await ingestPerson({
    id: person.id,
    handle: person.handle,
    name: person.name,
    xUserId: person.xUserId,
  });
  const summary = await generateSummaryForPerson(person.id, {
    date,
    force: true,
  });

  return { handle: person.handle, ingest, summarized: Boolean(summary) };
}

/**
 * Daily pipeline: ingest fresh activity and (re)generate summaries for the
 * given day. Records a JobRun for observability. Idempotent end to end.
 */
export async function runDailyPipeline(opts: PipelineOptions = {}) {
  const date = opts.date ?? new Date();
  const job = await prisma.jobRun.create({
    data: {
      jobName: "daily-digest",
      status: "RUNNING",
      meta: {
        date: date.toISOString(),
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
        const res = await runPersonPipeline(person.id, date);
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
        meta: {
          date: date.toISOString(),
          people: people.length,
          summarized,
        },
      },
    });

    log.info("daily pipeline complete", { processed, summarized });
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
