import { startOfUtcDay } from "@/lib/utils";

/**
 * Auto-refresh schedule. To keep X API spend down, briefings are refreshed
 * twice a week instead of daily:
 *
 *   • Monday  → covers Fri, Sat, Sun (the weekend)
 *   • Friday  → covers Mon, Tue, Wed, Thu (the work week)
 *
 * Each run pulls the notable activity from the days it covers.
 */
export const SCHEDULE_NOTE = "Auto-refreshes Mondays & Fridays";

export interface BriefWindow {
  /** Inclusive start of the covered period. */
  from: Date;
  /** Exclusive end of the covered period. */
  to: Date;
  /** The day the briefing is published/keyed to. */
  publish: Date;
}

/** Coverage window for a scheduled publish date (a Monday or Friday). */
export function scheduledWindow(publish: Date = new Date()): BriefWindow {
  const to = startOfUtcDay(publish); // cover up to (but not including) publish day
  const dow = to.getUTCDay(); // 0 Sun … 6 Sat
  let back = 7;
  if (dow === 1)
    back = 3; // Monday → Fri, Sat, Sun
  else if (dow === 5) back = 4; // Friday → Mon, Tue, Wed, Thu
  const from = new Date(to.getTime() - back * 86_400_000);
  return { from, to, publish: to };
}

/** Window covering the last `days` days including today (manual refresh). */
export function recentWindow(days = 7, now: Date = new Date()): BriefWindow {
  const today = startOfUtcDay(now);
  const to = new Date(today.getTime() + 86_400_000); // include today
  const from = new Date(to.getTime() - days * 86_400_000);
  return { from, to, publish: today };
}

/** Human label for a coverage window, e.g. "Mon, Jun 29 – Thu, Jul 2". */
export function coverageLabel(from: Date, to: Date): string {
  const last = new Date(to.getTime() - 86_400_000); // last covered day (inclusive)
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  if (startOfUtcDay(from).getTime() === startOfUtcDay(last).getTime()) {
    return fmt(from);
  }
  return `${fmt(from)} – ${fmt(last)}`;
}
