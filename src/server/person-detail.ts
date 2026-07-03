import "server-only";
import { prisma } from "@/lib/prisma";
import { startOfUtcDay } from "@/lib/utils";

/** Full detail view for a tracked person: latest brief + supporting evidence. */
export async function getPersonDetail(handle: string) {
  const person = await prisma.trackedPerson.findUnique({
    where: { handle },
    include: {
      summaries: { orderBy: { summaryDate: "desc" }, take: 7 },
    },
  });
  if (!person) return null;

  const latest = person.summaries[0] ?? null;
  const day = latest ? startOfUtcDay(latest.summaryDate) : startOfUtcDay();
  const nextDay = new Date(day.getTime() + 86_400_000);

  const tweets = await prisma.tweet.findMany({
    where: {
      trackedPersonId: person.id,
      isRetweet: false,
      postedAt: { gte: day, lt: nextDay },
    },
    orderBy: [{ likeCount: "desc" }],
    take: 6,
    include: {
      replies: { orderBy: { likeCount: "desc" }, take: 3 },
    },
  });

  // The most-liked replies across *all* of the day's posts, each carrying a
  // reference to the post it replied to.
  const notableReplies = await prisma.reply.findMany({
    where: {
      trackedPersonId: person.id,
      tweet: { isRetweet: false, postedAt: { gte: day, lt: nextDay } },
    },
    orderBy: { likeCount: "desc" },
    take: 8,
    include: {
      tweet: { select: { text: true, url: true, xTweetId: true } },
    },
  });

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
    history: person.summaries,
    tweets,
    notableReplies,
  };
}
