import { prisma } from "@/lib/prisma";
import { runPersonPipeline, runDailyPipeline } from "@/server/pipeline";
import { inngest } from "./client";

/**
 * Scheduled daily digest. Fans out one durable step per tracked person so that
 * a failure for one person is retried independently and never blocks the rest.
 * Runs at 12:00 UTC each day.
 */
export const dailyDigest = inngest.createFunction(
  { id: "daily-digest", name: "Daily digest" },
  { cron: "TZ=Etc/UTC 0 12 * * *" },
  async ({ step }) => {
    const people = await step.run("load-people", async () =>
      prisma.trackedPerson.findMany({ select: { id: true, handle: true } }),
    );

    const results: { handle: string; summarized: boolean }[] = [];
    for (const person of people) {
      const res = await step.run(`ingest-summarize-${person.handle}`, () =>
        runPersonPipeline(person.id),
      );
      results.push({
        handle: person.handle,
        summarized: Boolean(res?.summarized),
      });
    }
    return { people: people.length, results };
  },
);

/** On-demand: ingest + summarize a single person. */
export const personIngest = inngest.createFunction(
  { id: "person-ingest", name: "Person ingest" },
  { event: "app/person.ingest.requested" },
  async ({ event, step }) => {
    const { personId, date } = event.data as {
      personId: string;
      date?: string;
    };
    return step.run("pipeline", () =>
      runPersonPipeline(personId, date ? new Date(date) : undefined),
    );
  },
);

/** On-demand: run the whole daily pipeline (e.g. triggered by an admin event). */
export const dailyDigestOnDemand = inngest.createFunction(
  { id: "daily-digest-on-demand", name: "Daily digest (on demand)" },
  { event: "app/daily.digest.requested" },
  async ({ event, step }) => {
    const { date } = (event.data ?? {}) as { date?: string };
    return step.run("pipeline", () =>
      runDailyPipeline({ date: date ? new Date(date) : undefined }),
    );
  },
);

export const functions = [dailyDigest, personIngest, dailyDigestOnDemand];
