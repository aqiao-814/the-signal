import { createLogger } from "@/lib/logger";

const log = createLogger("x:http");

export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export class RateLimitError extends Error {
  constructor(
    message: string,
    public readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = "RateLimitError";
  }
}

export class HttpError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

interface RetryOptions {
  retries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  label?: string;
}

/**
 * Runs `fn` with exponential backoff + full jitter. Retries only transient
 * failures (429 and 5xx); honours an explicit `retryAfterMs` when provided.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  {
    retries = 4,
    baseDelayMs = 500,
    maxDelayMs = 20_000,
    label = "request",
  }: RetryOptions = {},
): Promise<T> {
  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (err) {
      const retryable =
        err instanceof RateLimitError ||
        (err instanceof HttpError && err.status >= 500);
      if (!retryable || attempt >= retries) throw err;

      const explicit =
        err instanceof RateLimitError ? err.retryAfterMs : undefined;
      const backoff = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
      const jitter = Math.random() * backoff;
      const delay = explicit ?? Math.round(jitter);
      attempt += 1;
      log.warn(`${label} failed, retrying`, {
        attempt,
        retries,
        delayMs: delay,
        error: (err as Error).message,
      });
      await sleep(delay);
    }
  }
}

/**
 * Minimal token-bucket rate limiter to keep us well under X API limits.
 * `acquire()` resolves when a token is available.
 */
export class RateLimiter {
  private tokens: number;
  private readonly capacity: number;
  private readonly refillPerMs: number;
  private last: number;

  constructor(ratePerWindow: number, windowMs: number) {
    this.capacity = ratePerWindow;
    this.tokens = ratePerWindow;
    this.refillPerMs = ratePerWindow / windowMs;
    this.last = Date.now();
  }

  private refill() {
    const now = Date.now();
    const elapsed = now - this.last;
    this.tokens = Math.min(
      this.capacity,
      this.tokens + elapsed * this.refillPerMs,
    );
    this.last = now;
  }

  async acquire(): Promise<void> {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }
    const needed = 1 - this.tokens;
    const waitMs = Math.ceil(needed / this.refillPerMs);
    await sleep(waitMs);
    return this.acquire();
  }
}

/** Parse a Retry-After header (seconds or HTTP date) into milliseconds. */
export function parseRetryAfter(header: string | null): number | undefined {
  if (!header) return undefined;
  const secs = Number(header);
  if (!Number.isNaN(secs)) return secs * 1000;
  const date = Date.parse(header);
  if (!Number.isNaN(date)) return Math.max(0, date - Date.now());
  return undefined;
}
