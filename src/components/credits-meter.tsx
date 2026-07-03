import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Shows the shared X API credit budget remaining (normalized/global) and, when
 * provided, how many the current account has used.
 */
export function CreditsMeter({
  remaining,
  total,
  used,
  className,
}: {
  remaining: number;
  total: number;
  used?: number;
  className?: string;
}) {
  const pct =
    total > 0 ? Math.max(0, Math.min(100, (remaining / total) * 100)) : 0;
  const low = remaining <= Math.max(1, total * 0.1);

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs",
        className,
      )}
      title={`${remaining} of ${total} X API credits remaining`}
    >
      <Zap
        className={cn("h-3.5 w-3.5", low ? "text-destructive" : "text-accent")}
        fill="currentColor"
      />
      <span className="font-medium tabular-nums">
        {remaining.toLocaleString()}
      </span>
      <span className="hidden text-muted-foreground sm:inline">
        / {total.toLocaleString()} X credits
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
      {typeof used === "number" && used > 0 ? (
        <span className="text-muted-foreground">· {used} used by you</span>
      ) : null}
    </div>
  );
}
