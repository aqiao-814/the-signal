import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { formatEditorialDate, startOfUtcDay } from "@/lib/utils";
import { getSummarizer } from ".";
import type { SummaryInput, SummaryReply } from "./types";

const log = createLogger("ai:summarize");

const KEYWORDS = [
  "AI",
  "AGI",
  "GPU",
  "compute",
  "agents",
  "safety",
  "models",
  "open source",
  "robotics",
  "chips",
  "energy",
  "scaling",
  "search",
  "reasoning",
  "data",
];

function topicsFor(raw: unknown, text: string): string[] {
  if (raw && typeof raw === "object" && "topics" in raw) {
    const t = (raw as { topics?: unknown }).topics;
    if (Array.isArray(t)) return t.map(String);
  }
  const lower = text.toLowerCase();
  return KEYWORDS.filter((k) => lower.includes(k.toLowerCase())).slice(0, 4);
}

function stanceFor(raw: unknown): string | undefined {
  if (raw && typeof raw === "object" && "stance" in raw) {
    return String((raw as { stance?: unknown }).stance ?? "") || undefined;
  }
  return undefined;
}

export interface GenerateOptions {
  date?: Date;
  force?: boolean;
}

/**
 * Gather a person's activity for a day, generate an article-style summary via
 * the configured provider, and upsert it. Idempotent per (person, day).
 */
export async function generateSummaryForPerson(
  personId: string,
  opts: GenerateOptions = {},
) {
  const day = startOfUtcDay(opts.date ?? new Date());
  const nextDay = new Date(day.getTime() + 86_400_000);

  const person = await prisma.trackedPerson.findUnique({
    where: { id: personId },
  });
  if (!person) return null;

  if (!opts.force) {
    const existing = await prisma.dailySummary.findUnique({
      where: {
        trackedPersonId_summaryDate: {
          trackedPersonId: personId,
          summaryDate: day,
        },
      },
    });
    if (existing) return existing;
  }

  const tweets = await prisma.tweet.findMany({
    where: {
      trackedPersonId: personId,
      isRetweet: false,
      postedAt: { gte: day, lt: nextDay },
    },
    orderBy: { postedAt: "asc" },
    include: {
      // Pull a deep sample of replies per tweet so sentiment and themes are
      // read from the whole conversation, not just a couple of top comments.
      replies: { orderBy: { likeCount: "desc" }, take: 60 },
    },
  });

  if (tweets.length === 0) {
    log.debug("no tweets to summarize", { handle: person.handle });
    return null;
  }

  const notableReplies = tweets
    .flatMap((t) => t.replies)
    .sort((a, b) => b.likeCount - a.likeCount);

  // Feed a large sample to the summarizer for analysis (sentiment + themes),
  // capped to keep prompt size sane for LLM providers.
  const summaryReplies: SummaryReply[] = notableReplies
    .slice(0, 60)
    .map((r) => ({
      authorHandle: r.authorHandle,
      authorName: r.authorName,
      text: r.text,
      likeCount: r.likeCount,
      stance: stanceFor(r.raw),
    }));

  const input: SummaryInput = {
    person: {
      name: person.name,
      handle: person.handle,
      title: person.title ?? "",
    },
    editorialDate: formatEditorialDate(day),
    tweets: tweets.map((t) => ({
      text: t.text,
      likeCount: t.likeCount,
      retweetCount: t.retweetCount,
      replyCount: t.replyCount,
      postedAt: t.postedAt.toISOString(),
      topics: topicsFor(t.raw, t.text),
      url: t.url ?? "",
    })),
    replies: summaryReplies,
    metrics: {
      tweetCount: tweets.length,
      replyCount: notableReplies.length,
      totalLikes: tweets.reduce((s, t) => s + t.likeCount, 0),
      totalReplies: tweets.reduce((s, t) => s + t.replyCount, 0),
    },
  };

  const summarizer = getSummarizer();
  const result = await summarizer.summarize(input);

  // Highlights: most-engaged tweets + replies for the detail page.
  const topTweetIds = [...tweets]
    .sort(
      (a, b) => b.likeCount + b.retweetCount - (a.likeCount + a.retweetCount),
    )
    .slice(0, 4)
    .map((t) => t.xTweetId);
  const topReplyIds = notableReplies.slice(0, 5).map((r) => r.xTweetId);

  const saved = await prisma.dailySummary.upsert({
    where: {
      trackedPersonId_summaryDate: {
        trackedPersonId: personId,
        summaryDate: day,
      },
    },
    create: {
      trackedPersonId: personId,
      summaryDate: day,
      headline: result.headline,
      dek: result.dek,
      body: result.body,
      sentiment: result.sentiment,
      sentimentScore: result.sentimentScore,
      tweetCount: input.metrics.tweetCount,
      replyCount: input.metrics.replyCount,
      topics: result.topics,
      highlights: { tweets: topTweetIds, replies: topReplyIds },
      model: result.model,
    },
    update: {
      headline: result.headline,
      dek: result.dek,
      body: result.body,
      sentiment: result.sentiment,
      sentimentScore: result.sentimentScore,
      tweetCount: input.metrics.tweetCount,
      replyCount: input.metrics.replyCount,
      topics: result.topics,
      highlights: { tweets: topTweetIds, replies: topReplyIds },
      model: result.model,
    },
  });

  log.info("summary generated", {
    handle: person.handle,
    model: result.model,
    sentiment: result.sentiment,
  });
  return saved;
}
