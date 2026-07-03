import Link from "next/link";
import { ArrowUpRight, MessageSquare, FileText, Sparkles } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { SentimentBadge } from "@/components/sentiment-badge";
import type { DashboardCard } from "@/server/dashboard";
import { avatarUrl } from "@/lib/constants";
import { cn, formatCompactNumber, formatRelativeTime } from "@/lib/utils";

export function NewsCard({ card }: { card: DashboardCard }) {
  const { person, summary } = card;

  return (
    <Link
      href={`/person/${person.handle}`}
      className={cn(
        "group h-full",
        "relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card p-5",
        "transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      {/* Header: profile */}
      <div className="flex items-start gap-3">
        <Avatar src={avatarUrl(person.handle)} name={person.name} size={46} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-semibold leading-tight">
              {person.name}
            </span>
            {person.verified ? (
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-accent" />
            ) : null}
          </div>
          <p className="truncate text-xs text-muted-foreground">
            @{person.handle}
            {person.title ? ` · ${person.title}` : ""}
          </p>
        </div>
        <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
      </div>

      {/* Body: the brief */}
      {summary ? (
        <div className="mt-4 flex flex-1 flex-col">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <SentimentBadge sentiment={summary.sentiment} />
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Brief · {formatRelativeTime(summary.updatedAt)}
            </span>
          </div>
          <h3 className="text-balance font-serif text-lg font-semibold leading-snug tracking-tight">
            {summary.headline}
          </h3>
          {summary.dek ? (
            <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">
              {summary.dek}
            </p>
          ) : null}

          {summary.topics.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {summary.topics.slice(0, 3).map((t) => (
                <Badge key={t} variant="outline" className="font-normal">
                  {t}
                </Badge>
              ))}
            </div>
          ) : null}

          <div className="mt-4 flex items-center gap-4 border-t border-border/60 pt-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              {formatCompactNumber(summary.tweetCount)} posts
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" />
              {formatCompactNumber(summary.replyCount)} replies
            </span>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-1 flex-col justify-center rounded-xl border border-dashed border-border bg-secondary/30 p-4 text-center">
          <p className="text-sm font-medium">No brief yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Refresh your feed to generate today&apos;s summary.
          </p>
        </div>
      )}
    </Link>
  );
}
