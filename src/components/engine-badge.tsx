import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/** Shows which summarizer / LLM is currently writing the briefs. */
export function EngineBadge({
  label,
  model,
  className,
}: {
  label: string;
  model: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs",
        className,
      )}
      title={`Briefs written by ${label} (${model})`}
    >
      <Sparkles className="h-3.5 w-3.5 text-primary" />
      <span className="text-muted-foreground">Written by</span>
      <span className="font-medium">{label}</span>
      <span className="hidden font-mono text-[11px] text-muted-foreground sm:inline">
        {model}
      </span>
    </span>
  );
}
