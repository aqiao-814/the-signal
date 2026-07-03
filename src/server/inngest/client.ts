import { Inngest } from "inngest";

/** Inngest client for background/scheduled jobs. */
export const inngest = new Inngest({ id: "the-signal" });

/** Event payloads. */
export type Events = {
  "app/daily.digest.requested": { data: { date?: string } };
  "app/person.ingest.requested": { data: { personId: string; date?: string } };
};
