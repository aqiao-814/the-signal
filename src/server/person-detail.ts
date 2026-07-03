import "server-only";
import { prisma } from "@/lib/prisma";
import { startOfUtcDay } from "@/lib/utils";

/** Full detail view for a tracked person: latest briefing + supporting evidence. */
export async function getPersonDetail(handle: string) {
  const person = await prisma.trackedPerson.findUnique({
    where: { handle },
    include: {
      summaries: { orderBy: { summaryDate: "desc" }, take: 7 },
    },
  });
  if (!person) return null;

  const latest = person.summaries[0] ?? null;
  // Use the briefing's coverage window (falls back to its single day).
  const day = latest ? startOfUtcDay(latest.summaryDate) : startOfUtcDay();
  const from = latest?.periodStart ?? day;
  const to = latest?.periodEnd ?? new Date(day.getTime() + 86_400_000);

  // The top-3 most-liked posts in the window, each with its top reply.
  const topTweets = await prisma.tweet.findMany({
    where: {
      trackedPersonId: person.id,
      isRetweet: false,
      postedAt: { gte: from, lt: to },
    },
    orderBy: [{ likeCount: "desc" }],
    take: 3,
    include: { replies: { orderBy: { likeCount: "desc" }, take: 1 } },
  });

  // Notable replies = the single top reply to each notable post.
  const notableReplies = topTweets
    .filter((t) => t.replies.length > 0)
    .map((t) => ({
      ...t.replies[0]!,
      tweet: { text: t.text, url: t.url },
    }));

  return {
    person: {
      id: person.id,
      handle: person.handle,
      name: person.name,
      title: person.title,
      bio: person.bio,
      verified: person.verified,
    },
    latest,
    coverage: latest?.periodStart && latest?.periodEnd ? { from, to } : null,
    history: person.summaries,
    tweets: topTweets,
    notableReplies,
  };
}
