import { createLogger } from "@/lib/logger";
import { tweetUrl } from "@/lib/constants";
import {
  HttpError,
  RateLimitError,
  RateLimiter,
  parseRetryAfter,
  withRetry,
} from "./http";
import type {
  FetchOptions,
  IngestSource,
  NormalizedReply,
  NormalizedTweet,
  PersonBundle,
  PersonRef,
} from "./types";

const log = createLogger("x:client");
const API = "https://api.twitter.com/2";

interface XUser {
  id: string;
  username: string;
  name: string;
  profile_image_url?: string;
  verified?: boolean;
}

interface XTweet {
  id: string;
  text: string;
  lang?: string;
  created_at?: string;
  conversation_id?: string;
  author_id?: string;
  referenced_tweets?: { type: string; id: string }[];
  public_metrics?: {
    like_count: number;
    retweet_count: number;
    reply_count: number;
    quote_count: number;
    impression_count?: number;
  };
}

/**
 * Live X (Twitter) API v2 source.
 *
 * Implements batching (single call per user for the timeline), an in-memory
 * user-id cache, a conservative token-bucket rate limiter, and exponential
 * backoff with Retry-After handling. Designed to never spam the API.
 */
export class XApiSource implements IngestSource {
  readonly mode = "live" as const;
  private readonly bearer: string;
  private readonly idCache = new Map<string, XUser>();
  // Cumulative count of X API calls made (used to meter credit usage).
  private calls = 0;
  // Stay comfortably under X limits without being the bottleneck. Overridable
  // via X_RATE_PER_MIN for higher tiers.
  private readonly limiter = new RateLimiter(
    Number(process.env.X_RATE_PER_MIN ?? 50),
    60_000,
  );

  constructor(bearer: string) {
    this.bearer = bearer;
  }

  callCount(): number {
    return this.calls;
  }

  private async request<T>(
    path: string,
    params: Record<string, string | number | undefined> = {},
  ): Promise<T> {
    await this.limiter.acquire();
    this.calls += 1;
    const url = new URL(`${API}${path}`);
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }

    return withRetry(
      async () => {
        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${this.bearer}`,
            "User-Agent": "TheSignal/1.0",
          },
          // Never cache credentialed API responses at the fetch layer.
          cache: "no-store",
        });

        if (res.status === 429) {
          const retryAfter =
            parseRetryAfter(res.headers.get("retry-after")) ??
            (() => {
              const reset = res.headers.get("x-rate-limit-reset");
              return reset
                ? Math.max(0, Number(reset) * 1000 - Date.now())
                : undefined;
            })();
          throw new RateLimitError("X API rate limit", retryAfter);
        }
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          throw new HttpError(
            `X API ${res.status} on ${path}`,
            res.status,
            body,
          );
        }
        return (await res.json()) as T;
      },
      { label: `GET ${path}` },
    );
  }

  private async resolveUser(handle: string): Promise<XUser | null> {
    const key = handle.toLowerCase();
    if (this.idCache.has(key)) return this.idCache.get(key)!;
    try {
      const data = await this.request<{ data?: XUser }>(
        `/users/by/username/${handle}`,
        { "user.fields": "profile_image_url,verified,name,username" },
      );
      if (data.data) {
        this.idCache.set(key, data.data);
        return data.data;
      }
    } catch (err) {
      log.error("failed to resolve user", {
        handle,
        error: (err as Error).message,
      });
    }
    return null;
  }

  private normalizeTweet(handle: string, t: XTweet): NormalizedTweet {
    const m = t.public_metrics;
    const isRetweet =
      t.referenced_tweets?.some((r) => r.type === "retweeted") ?? false;
    const isReply =
      t.referenced_tweets?.some((r) => r.type === "replied_to") ?? false;
    return {
      xTweetId: t.id,
      authorHandle: handle,
      text: t.text,
      lang: t.lang,
      likeCount: m?.like_count ?? 0,
      retweetCount: m?.retweet_count ?? 0,
      replyCount: m?.reply_count ?? 0,
      quoteCount: m?.quote_count ?? 0,
      viewCount: m?.impression_count ?? 0,
      isReply,
      isRetweet,
      conversationId: t.conversation_id,
      postedAt: t.created_at ?? new Date().toISOString(),
      url: tweetUrl(handle, t.id),
      raw: t,
    };
  }

  async fetchForPerson(
    person: PersonRef,
    opts: FetchOptions = {},
  ): Promise<PersonBundle> {
    const maxTweets = Math.min(opts.maxTweets ?? 20, 100);
    let userId = person.xUserId ?? undefined;
    let resolved: XUser | null = null;

    if (!userId) {
      resolved = await this.resolveUser(person.handle);
      userId = resolved?.id;
    }
    if (!userId) {
      log.warn("no user id; returning empty bundle", { handle: person.handle });
      return { handle: person.handle, xUserId: null, tweets: [], replies: [] };
    }

    // Batched timeline fetch (single request).
    const timeline = await this.request<{ data?: XTweet[] }>(
      `/users/${userId}/tweets`,
      {
        max_results: maxTweets,
        exclude: "retweets",
        "tweet.fields":
          "created_at,public_metrics,conversation_id,lang,referenced_tweets",
        start_time: opts.since?.toISOString(),
      },
    );

    const rawTweets = (timeline.data ?? []).filter((t) => !!t.text);
    const tweets = rawTweets
      .map((t) => this.normalizeTweet(person.handle, t))
      .filter((t) => !t.isReply);

    // Fetch replies for the top tweets via recent search. Each lookup is ONE
    // API call regardless of page size, so we pull a large page (X_REPLY_PAGE,
    // up to 100) to analyze many replies cheaply, across X_REPLY_LOOKUPS tweets.
    const replyLookups = Math.max(0, Number(process.env.X_REPLY_LOOKUPS ?? 4));
    const replyPage = Math.min(
      100,
      Math.max(10, Number(process.env.X_REPLY_PAGE ?? 50)),
    );
    const replies: NormalizedReply[] = [];
    for (const tweet of tweets.slice(0, replyLookups)) {
      const convId = tweet.conversationId ?? tweet.xTweetId;
      try {
        const search = await this.request<{
          data?: XTweet[];
          includes?: { users?: XUser[] };
        }>(`/tweets/search/recent`, {
          query: `conversation_id:${convId} -from:${person.handle}`,
          max_results: replyPage,
          "tweet.fields": "created_at,public_metrics,author_id,conversation_id",
          expansions: "author_id",
          "user.fields": "username,name",
        });
        const users = new Map(
          (search.includes?.users ?? []).map((u) => [u.id, u]),
        );
        for (const r of search.data ?? []) {
          const author = r.author_id ? users.get(r.author_id) : undefined;
          replies.push({
            xTweetId: r.id,
            parentXTweetId: tweet.xTweetId,
            conversationId: convId,
            authorHandle: author?.username ?? "unknown",
            authorName: author?.name,
            text: r.text,
            likeCount: r.public_metrics?.like_count ?? 0,
            replyCount: r.public_metrics?.reply_count ?? 0,
            postedAt: r.created_at ?? new Date().toISOString(),
            url: tweetUrl(author?.username ?? "i", r.id),
            raw: r,
          });
        }
      } catch (err) {
        // Reply search requires elevated access on some tiers; degrade cleanly.
        log.warn("reply search failed; continuing", {
          handle: person.handle,
          error: (err as Error).message,
        });
      }
    }

    return {
      handle: person.handle,
      xUserId: userId,
      tweets,
      replies,
    };
  }
}
