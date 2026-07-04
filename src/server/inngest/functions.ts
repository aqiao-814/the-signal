import { runDailyPipeline, runPersonPipeline } from "@/server/pipeline";
import { inngest } from "./client";

/**
 * There is intentionally NO scheduled/cron job — refreshing hits the live X API
 * and costs money, so it only ever happens on demand (the "Refresh" button, or
 * these events / the protected /api/cron/daily endpoint you trigger yourself).
 */

/** On-demand: refresh a single person (last 7 days). */
export const personIngest = inngest.createFunction(
  { id: "person-ingest", name: "Person ingest" },
  { event: "app/person.ingest.requested" },
  async ({ event, step }) => {
    const { personId } = event.data as { personId: string };
    return step.run("pipeline", () => runPersonPipeline(personId));
  },
);

/** On-demand: run the whole pipeline for everyone. */
export const digestOnDemand = inngest.createFunction(
  { id: "digest-on-demand", name: "Digest (on demand)" },
  { event: "app/daily.digest.requested" },
  async ({ step }) => step.run("pipeline", () => runDailyPipeline()),
);

export const functions = [personIngest, digestOnDemand];
