import type { Metadata } from "next";
import Link from "next/link";
import { Newspaper, Users, MessageSquare, FileText } from "lucide-react";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getDashboardData } from "@/server/dashboard";
import { getCreditPool, getUserCreditsUsed } from "@/server/credits";
import { NewsCard } from "@/components/news-card";
import { RefreshButton } from "@/components/refresh-button";
import { EmptyState } from "@/components/empty-state";
import { CreditsMeter } from "@/components/credits-meter";
import { StalenessBanner } from "@/components/staleness-banner";
import { Reveal } from "@/components/motion/reveal";
import { buttonVariants } from "@/components/ui/button";
import {
  cn,
  formatCompactNumber,
  formatEditorialDate,
  formatRelativeTime,
} from "@/lib/utils";

export const metadata: Metadata = { title: "Today's briefing" };
export const dynamic = "force-dynamic";

function greeting(name: string) {
  const h = new Date().getHours();
  const part =
    h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  return `${part}, ${name.split(" ")[0]}`;
}

export default async function DashboardPage() {
  const user = await requireUser();
  const [{ cards, totals, lastUpdated }, account, pool, creditsUsed] =
    await Promise.all([
      getDashboardData(user.id),
      prisma.user.findUnique({
        where: { id: user.id },
        select: { lastRefreshedAt: true },
      }),
      getCreditPool(),
      getUserCreditsUsed(user.id),
    ]);

  const name = user.name?.trim() || user.email.split("@")[0];
  // Staleness is measured from the user's last refresh, falling back to when
  // the briefs were last generated.
  const staleFrom = account?.lastRefreshedAt ?? lastUpdated ?? null;

  return (
    <main className="container py-8">
      {/* Masthead */}
      <div className="flex flex-col gap-5 border-b border-border pb-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
              {formatEditorialDate(new Date())}
            </p>
            <h1 className="mt-1 font-serif text-3xl font-semibold tracking-tight sm:text-4xl">
              {greeting(name)} <span className="inline-block">👋</span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Here&apos;s what your tech leaders are saying today.
              {lastUpdated ? (
                <span> Updated {formatRelativeTime(lastUpdated)}.</span>
              ) : null}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <RefreshButton />
            <Link
              href="/onboarding"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Manage feed
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-muted-foreground">
          {cards.length > 0 ? (
            <>
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-4 w-4" />
                {totals.people} following
              </span>
              <span className="inline-flex items-center gap-1.5">
                <FileText className="h-4 w-4" />
                {formatCompactNumber(totals.tweets)} posts today
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MessageSquare className="h-4 w-4" />
                {formatCompactNumber(totals.replies)} replies analyzed
              </span>
            </>
          ) : null}
          <CreditsMeter
            remaining={pool.remaining}
            total={pool.total}
            used={creditsUsed}
            className="sm:ml-auto"
          />
        </div>
      </div>

      {/* Feed */}
      {cards.length === 0 ? (
        <div className="py-14">
          <EmptyState
            icon={Newspaper}
            title="Your front page is empty 📰"
            description="Pick a few tech leaders to follow and we'll start writing your daily briefs — fresh every morning."
            action={
              <Link
                href="/onboarding"
                className={cn(buttonVariants({ variant: "gradient" }))}
              >
                Choose who to follow
              </Link>
            }
          />
        </div>
      ) : (
        <div className="mt-6">
          <StalenessBanner
            lastUpdated={staleFrom ? new Date(staleFrom).toISOString() : null}
            creditsRemaining={pool.remaining}
          />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {cards.map((card, i) => (
              <Reveal
                key={card.person.id}
                delay={Math.min(i, 8) * 0.05}
                className="h-full"
              >
                <NewsCard card={card} />
              </Reveal>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
