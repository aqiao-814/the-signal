import { prisma } from "@/lib/prisma";
import { runDailyPipeline, runPersonPipeline } from "@/server/pipeline";
import { scheduledWindow } from "@/server/schedule";
import { inngest } from "./client";

/**
 * Twice-weekly digest to keep X API spend down: runs Monday and Friday at 13:00
 * (America/Chicago). Monday covers Fri–Sun; Friday covers Mon–Thu. Fans out one
 * durable, independently-retried step per person.
 */
export const weeklyDigest = inngest.createFunction(
  { id: "weekly-digest", name: "Weekly digest (Mon & Fri)" },
  { cron: "TZ=America/Chicago 0 13 * * 1,5" },
  async ({ step }) => {
    const win = scheduledWindow(new Date());
    const people = await step.run("load-people", async () =>
      prisma.trackedPerson.findMany({ select: { id: true, handle: true } }),
    );

    const results: { handle: string; summarized: boolean }[] = [];
    for (const person of people) {
      const res = await step.run(`digest-${person.handle}`, () =>
        runPersonPipeline(person.id, win),
      );
      results.push({
        handle: person.handle,
        summarized: Boolean(res?.summarized),
      });
    }
    return {
      window: { from: win.from.toISOString(), to: win.to.toISOString() },
      results,
    };
  },
);

/** On-demand: refresh a single person (last 7 days). */
export const personIngest = inngest.createFunction(
  { id: "person-ingest", name: "Person ingest" },
  { event: "app/person.ingest.requested" },
  async ({ event, step }) => {
    const { personId } = event.data as { personId: string };
    return step.run("pipeline", () => runPersonPipeline(personId));
  },
);

/** On-demand: run the whole scheduled pipeline. */
export const digestOnDemand = inngest.createFunction(
  { id: "digest-on-demand", name: "Digest (on demand)" },
  { event: "app/daily.digest.requested" },
  async ({ step }) => step.run("pipeline", () => runDailyPipeline()),
);

export const functions = [weeklyDigest, personIngest, digestOnDemand];
