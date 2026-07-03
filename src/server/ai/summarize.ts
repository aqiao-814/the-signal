import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { formatEditorialDate, startOfUtcDay } from "@/lib/utils";
import { getSummarizer } from ".";
import type { BriefWindow } from "@/server/schedule";
import type { SummaryInput, SummaryReply } from "./types";

const log = createLogger("ai:summarize");

/** How many of the day(s)' posts count as "notable" (top by likes). */
const NOTABLE_TWEETS = 3;
/** Replies pulled per notable tweet — enough to find the top reply + read mood. */
const REPLIES_PER_TWEET = 40;

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

/**
 * Generate a briefing for a person covering a window of days. The briefing is
 * built from the NOTABLE activity in that window: the top-3 most-liked posts
 * and the top reply to each. Idempotent per (person, publish day).
 */
export async function generateBriefing(
  personId: string,
  win: BriefWindow,
  opts: { force?: boolean } = {},
) {
  const day = startOfUtcDay(win.publish);

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

  // Top-3 most-liked posts in the window, each with its replies (for the top
  // reply + reading sentiment).
  const [topTweets, totalPosts] = await Promise.all([
    prisma.tweet.findMany({
      where: {
        trackedPersonId: personId,
        isRetweet: false,
        postedAt: { gte: win.from, lt: win.to },
      },
      orderBy: [{ likeCount: "desc" }],
      take: NOTABLE_TWEETS,
      include: {
        replies: { orderBy: { likeCount: "desc" }, take: REPLIES_PER_TWEET },
      },
    }),
    prisma.tweet.count({
      where: {
        trackedPersonId: personId,
        isRetweet: false,
        postedAt: { gte: win.from, lt: win.to },
      },
    }),
  ]);

  if (topTweets.length === 0) {
    log.debug("no posts to summarize in window", { handle: person.handle });
    return null;
  }

  const allReplies = topTweets
    .flatMap((t) => t.replies)
    .sort((a, b) => b.likeCount - a.likeCount);
  const topReplyPerTweet = topTweets
    .map((t) => t.replies[0])
    .filter((r): r is NonNullable<typeof r> => Boolean(r));

  const summaryReplies: SummaryReply[] = allReplies.slice(0, 60).map((r) => ({
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
    editorialDate: formatEditorialDate(win.publish),
    tweets: topTweets.map((t) => ({
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
      tweetCount: totalPosts,
      replyCount: allReplies.length,
      totalLikes: topTweets.reduce((s, t) => s + t.likeCount, 0),
      totalReplies: topTweets.reduce((s, t) => s + t.replyCount, 0),
    },
  };

  const result = await getSummarizer().summarize(input);

  const highlights = {
    tweets: topTweets.map((t) => t.xTweetId),
    replies: topReplyPerTweet.map((r) => r.xTweetId),
  };

  const data = {
    headline: result.headline,
    dek: result.dek,
    body: result.body,
    sentiment: result.sentiment,
    sentimentScore: result.sentimentScore,
    tweetCount: input.metrics.tweetCount,
    replyCount: input.metrics.replyCount,
    topics: result.topics,
    highlights,
    model: result.model,
    periodStart: win.from,
    periodEnd: win.to,
  };

  const saved = await prisma.dailySummary.upsert({
    where: {
      trackedPersonId_summaryDate: {
        trackedPersonId: personId,
        summaryDate: day,
      },
    },
    create: { trackedPersonId: personId, summaryDate: day, ...data },
    update: data,
  });

  log.info("briefing generated", {
    handle: person.handle,
    model: result.model,
    sentiment: result.sentiment,
    posts: totalPosts,
  });
  return saved;
}

/** Single-day briefing (used by the mock seeder). */
export async function generateSummaryForPerson(
  personId: string,
  opts: { date?: Date; force?: boolean } = {},
) {
  const day = startOfUtcDay(opts.date ?? new Date());
  return generateBriefing(
    personId,
    { from: day, to: new Date(day.getTime() + 86_400_000), publish: day },
    { force: opts.force },
  );
}
