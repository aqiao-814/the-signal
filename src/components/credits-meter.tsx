import { Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

const usd = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    Math.max(0, n),
  );

/**
 * Shows the money left in the shared X API account (normalized/global) and,
 * when provided, how much the current account has spent.
 */
export function CreditsMeter({
  remainingUsd,
  totalUsd,
  spentUsd,
  className,
}: {
  remainingUsd: number;
  totalUsd: number;
  spentUsd?: number;
  className?: string;
}) {
  const pct =
    totalUsd > 0
      ? Math.max(0, Math.min(100, (remainingUsd / totalUsd) * 100))
      : 0;
  const low = remainingUsd <= Math.max(0.01, totalUsd * 0.15);

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs",
        className,
      )}
      title={`${usd(remainingUsd)} of ${usd(totalUsd)} X API budget remaining`}
    >
      <Wallet
        className={cn("h-3.5 w-3.5", low ? "text-destructive" : "text-accent")}
      />
      <span className="font-medium tabular-nums">{usd(remainingUsd)}</span>
      <span className="hidden text-muted-foreground sm:inline">
        left in X API
      </span>
      <span className="relative h-1.5 w-10 overflow-hidden rounded-full bg-secondary">
        <span
          className={cn(
            "absolute inset-y-0 left-0 rounded-full",
            low ? "bg-destructive" : "bg-accent",
          )}
          style={{ width: `${pct}%` }}
        />
      </span>
      {typeof spentUsd === "number" && spentUsd > 0 ? (
        <span className="text-muted-foreground">· {usd(spentUsd)} by you</span>
      ) : null}
    </div>
  );
}
