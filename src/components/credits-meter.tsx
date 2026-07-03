import { Wallet, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

const usd = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    Math.max(0, n),
  );

/**
 * X doesn't expose a real balance or per-call price via its API, so the number
 * here is an app-side estimate. We link out to the X developer console where
 * the actual usage/billing lives.
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
  const low = remainingUsd <= Math.max(0.01, totalUsd * 0.15);

  return (
    <a
      href="https://console.x.com/"
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "group inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs transition-colors hover:border-primary/40 hover:bg-secondary/50",
        className,
      )}
      title="Estimated X API spend — click to see real usage on the X console"
    >
      <Wallet
        className={cn("h-3.5 w-3.5", low ? "text-destructive" : "text-accent")}
      />
      <span className="font-medium tabular-nums">~{usd(remainingUsd)}</span>
      <span className="hidden text-muted-foreground sm:inline">
        left in X API
      </span>
      {typeof spentUsd === "number" && spentUsd > 0 ? (
        <span className="text-muted-foreground">· ~{usd(spentUsd)} by you</span>
      ) : null}
      <ExternalLink className="h-3 w-3 text-muted-foreground transition-colors group-hover:text-primary" />
    </a>
  );
}
