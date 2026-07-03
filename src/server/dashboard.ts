import "server-only";
import { prisma } from "@/lib/prisma";
import type { Sentiment } from "@prisma/client";

export interface DashboardCard {
  person: {
    id: string;
    handle: string;
    name: string;
    title: string | null;
    bio: string | null;
    verified: boolean;
  };
  summary: {
    id: string;
    summaryDate: Date;
    headline: string;
    dek: string | null;
    sentiment: Sentiment;
    sentimentScore: number | null;
    tweetCount: number;
    replyCount: number;
    topics: string[];
    updatedAt: Date;
  } | null;
}

export interface DashboardData {
  cards: DashboardCard[];
  totals: { people: number; tweets: number; replies: number };
  lastUpdated: Date | null;
  /** Coverage window of the freshest briefing (for the schedule note). */
  coverage: { from: Date; to: Date } | null;
}

/** Everything the dashboard needs for a user, in a single round of queries. */
export async function getDashboardData(userId: string): Promise<DashboardData> {
  const selections = await prisma.selectedPerson.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    include: {
      person: {
        include: {
          summaries: { orderBy: { summaryDate: "desc" }, take: 1 },
        },
      },
    },
  });

  const cards: DashboardCard[] = selections.map(({ person }) => {
    const s = person.summaries[0];
    return {
      person: {
        id: person.id,
        handle: person.handle,
        name: person.name,
        title: person.title,
        bio: person.bio,
        verified: person.verified,
      },
      summary: s
        ? {
            id: s.id,
            summaryDate: s.summaryDate,
            headline: s.headline,
            dek: s.dek,
            sentiment: s.sentiment,
            sentimentScore: s.sentimentScore,
            tweetCount: s.tweetCount,
            replyCount: s.replyCount,
            topics: s.topics,
            updatedAt: s.updatedAt,
          }
        : null,
    };
  });

  const totals = cards.reduce(
    (acc, c) => {
      if (c.summary) {
        acc.tweets += c.summary.tweetCount;
        acc.replies += c.summary.replyCount;
      }
      return acc;
    },
    { people: cards.length, tweets: 0, replies: 0 },
  );

  const lastUpdated = cards.reduce<Date | null>((latest, c) => {
    if (!c.summary) return latest;
    if (!latest || c.summary.updatedAt > latest) return c.summary.updatedAt;
    return latest;
  }, null);

  // Coverage window from the most recent briefing among the selected people.
  const freshest = selections
    .flatMap((s) => s.person.summaries)
    .sort((a, b) => b.summaryDate.getTime() - a.summaryDate.getTime())[0];
  const coverage =
    freshest?.periodStart && freshest?.periodEnd
      ? { from: freshest.periodStart, to: freshest.periodEnd }
      : null;

  return { cards, totals, lastUpdated, coverage };
}
