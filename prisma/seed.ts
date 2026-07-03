import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { RECOMMENDED_PEOPLE, avatarUrl } from "@/lib/constants";
import { buildPersonDay } from "@/server/x/mock";
import { persistBundle, ingestPerson } from "@/server/x/ingest";
import { generateSummaryForPerson } from "@/server/ai/summarize";
import { startOfUtcDay } from "@/lib/utils";
import { isLiveIngest } from "@/lib/env";
import { createLogger } from "@/lib/logger";

const log = createLogger("seed");

const HISTORY_DAYS = 3;
const LIVE_SUMMARY_DAYS = 5;
const DEMO_EMAIL = "demo@thesignal.app";
const DEMO_PASSWORD = "demo12345";
const DEMO_NAME = "Demo Reader";

async function upsertPeople() {
  for (const p of RECOMMENDED_PEOPLE) {
    await prisma.trackedPerson.upsert({
      where: { handle: p.handle },
      create: {
        handle: p.handle,
        name: p.name,
        title: p.title,
        bio: p.bio,
        verified: p.verified,
        avatarUrl: avatarUrl(p.handle),
      },
      update: {
        name: p.name,
        title: p.title,
        bio: p.bio,
        verified: p.verified,
        avatarUrl: avatarUrl(p.handle),
      },
    });
  }
  log.info(`upserted ${RECOMMENDED_PEOPLE.length} tracked people`);
}

async function seedContent() {
  const people = await prisma.trackedPerson.findMany();
  for (const person of people) {
    for (let d = HISTORY_DAYS - 1; d >= 0; d--) {
      const day = startOfUtcDay(new Date(Date.now() - d * 86_400_000));
      const bundle = buildPersonDay(
        { handle: person.handle, name: person.name, xUserId: person.xUserId },
        day,
      );
      await persistBundle(
        {
          id: person.id,
          handle: person.handle,
          name: person.name,
          xUserId: person.xUserId,
        },
        bundle,
      );
      await generateSummaryForPerson(person.id, { date: day, force: true });
    }
    log.info(`seeded ${HISTORY_DAYS} days for @${person.handle}`);
  }
}

/** The most recent distinct UTC days a person actually posted (originals). */
async function recentTweetDays(
  personId: string,
  limit: number,
): Promise<Date[]> {
  const tweets = await prisma.tweet.findMany({
    where: { trackedPersonId: personId, isRetweet: false },
    select: { postedAt: true },
    orderBy: { postedAt: "desc" },
    take: 80,
  });
  const seen = new Set<string>();
  const days: Date[] = [];
  for (const t of tweets) {
    const day = startOfUtcDay(t.postedAt);
    const key = day.toISOString();
    if (!seen.has(key)) {
      seen.add(key);
      days.push(day);
    }
    if (days.length >= limit) break;
  }
  return days;
}

/** Live seeding: fetch real recent tweets from X, then summarize the days the
 * person actually posted (so infrequent posters still get briefs). */
async function seedLiveContent() {
  const people = await prisma.trackedPerson.findMany();
  for (const person of people) {
    try {
      const res = await ingestPerson({
        id: person.id,
        handle: person.handle,
        name: person.name,
        xUserId: person.xUserId,
      });
      log.info(`live-ingested @${person.handle}`, {
        tweets: res.tweets,
        replies: res.replies,
      });
    } catch (err) {
      log.warn(`live ingest failed for @${person.handle}`, {
        error: (err as Error).message,
      });
    }
    const days = await recentTweetDays(person.id, LIVE_SUMMARY_DAYS);
    for (const day of days) {
      await generateSummaryForPerson(person.id, { date: day, force: true });
    }
  }
}

/** Best-effort demo account so the app is immediately explorable. */
async function seedDemoUser() {
  let user = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });
  if (!user) {
    try {
      // Import lazily so a headless context never breaks core seeding.
      const { auth } = await import("@/lib/auth");
      await auth.api.signUpEmail({
        body: { email: DEMO_EMAIL, password: DEMO_PASSWORD, name: DEMO_NAME },
      });
    } catch (err) {
      log.warn("demo signup via auth API failed (non-fatal)", {
        error: (err as Error).message,
      });
    }
    user = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });
  }

  if (!user) {
    log.warn("no demo user created; register manually in the app");
    return;
  }

  const picks = await prisma.trackedPerson.findMany({
    take: 5,
    orderBy: { name: "asc" },
  });
  for (const p of picks) {
    await prisma.selectedPerson.upsert({
      where: {
        userId_trackedPersonId: { userId: user.id, trackedPersonId: p.id },
      },
      create: { userId: user.id, trackedPersonId: p.id },
      update: {},
    });
  }
  log.info(`demo user ready → ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

async function main() {
  await upsertPeople();

  const summaryCount = await prisma.dailySummary.count();
  if (summaryCount > 0 && !process.env.SEED_FORCE) {
    log.info("content already present; skipping generation", {
      summaries: summaryCount,
    });
  } else if (isLiveIngest) {
    log.info("live ingest from the X API + summaries…");
    await seedLiveContent();
  } else {
    log.info("generating mock content + summaries…");
    await seedContent();
  }

  await seedDemoUser();
  log.info("✓ seed complete");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error("[seed] failed:", err);
    await prisma.$disconnect();
    process.exit(1);
  });
