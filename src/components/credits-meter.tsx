import { Wallet, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * X exposes no real balance or per-call price via its API, so rather than show
 * a misleading estimate we link straight to the X developer console where the
 * actual usage/billing lives.
 */
export function CreditsMeter({ className }: { className?: string }) {
  return (
    <a
      href="https://console.x.com/"
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "group inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs transition-colors hover:border-primary/40 hover:bg-secondary/50",
        className,
      )}
      title="See your X API credits & usage on the X console"
    >
      <Wallet className="h-3.5 w-3.5 text-accent" />
      <span>X API credits left</span>
      <ExternalLink className="h-3 w-3 text-muted-foreground transition-colors group-hover:text-primary" />
    </a>
  );
}
