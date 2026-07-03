import { env, isLiveIngest } from "@/lib/env";
import { createLogger } from "@/lib/logger";
import type { IngestSource } from "./types";
import { MockSource } from "./mock";
import { XApiSource } from "./client";

const log = createLogger("x:source");

let cached: IngestSource | null = null;

/** Returns the configured ingest source (live X API or local fixtures). */
export function getIngestSource(): IngestSource {
  if (cached) return cached;
  if (isLiveIngest && env.X_API_BEARER_TOKEN) {
    log.info("using live X API ingest source");
    cached = new XApiSource(env.X_API_BEARER_TOKEN);
  } else {
    log.info("using mock ingest source (no X token / INGEST_MODE!=live)");
    cached = new MockSource();
  }
  return cached;
}
