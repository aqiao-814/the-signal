import { Badge } from "@/components/ui/badge";
import type { Sentiment } from "@prisma/client";

const CONFIG: Record<
  Sentiment,
  {
    label: string;
    emoji: string;
    variant: "success" | "destructive" | "warning" | "secondary";
  }
> = {
  POSITIVE: { label: "Bullish", emoji: "🚀", variant: "success" },
  NEGATIVE: { label: "Skeptical", emoji: "🤔", variant: "destructive" },
  MIXED: { label: "Divided", emoji: "⚖️", variant: "warning" },
  NEUTRAL: { label: "Measured", emoji: "😌", variant: "secondary" },
};

export function SentimentBadge({
  sentiment,
  className,
}: {
  sentiment: Sentiment;
  className?: string;
}) {
  const { label, emoji, variant } = CONFIG[sentiment];
  return (
    <Badge variant={variant} className={className}>
      <span aria-hidden>{emoji}</span>
      {label}
    </Badge>
  );
}
