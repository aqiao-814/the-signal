"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sunrise, RefreshCw, X } from "lucide-react";
import { refreshMyFeed } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

/** Whole-day difference between two dates in the *viewer's local* timezone. */
function localDayDiff(from: Date, to: Date): number {
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((startOfDay(to) - startOfDay(from)) / 86_400_000);
}

/**
 * Prompts a refresh when the feed is stale. "Best time to ask" logic: only once
 * a new local calendar day has begun since the last update (so we never nag on
 * the same day), with the wording escalating by age. If there are no X credits
 * left, we don't prompt a refresh that can't help — we say so instead.
 */
export function StalenessBanner({
  lastUpdated,
  creditsRemaining,
}: {
  lastUpdated: string | null;
  creditsRemaining: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [dismissed, setDismissed] = useState(false);

  if (!lastUpdated) return null;
  const days = localDayDiff(new Date(lastUpdated), new Date());
  if (days < 1 || dismissed) return null;

  const outOfCredits = creditsRemaining <= 0;
  const heading =
    days === 1 ? "It's a new day 🌅" : `It's been ${days} days 🌅`;
  const message = outOfCredits
    ? "You're out of X credits for now — check back once they refresh."
    : days === 1
      ? "Want to refresh to see what people are saying?"
      : `Looks like you last updated ${days} days ago — want to see what's new?`;

  function refresh() {
    start(async () => {
      await refreshMyFeed();
      router.refresh();
      setDismissed(true);
    });
  }

  return (
    <div className="mb-5 flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <Sunrise className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
        <div>
          <p className="font-medium">{heading}</p>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 self-end sm:self-auto">
        {!outOfCredits ? (
          <Button size="sm" onClick={refresh} disabled={pending}>
            {pending ? <Spinner /> : <RefreshCw className="h-4 w-4" />}
            {pending ? "Refreshing…" : "Refresh now"}
          </Button>
        ) : null}
        <button
          onClick={() => setDismissed(true)}
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
