import { Heart, Repeat2, MessageSquare, ExternalLink } from "lucide-react";
import { formatCompactNumber, formatRelativeTime } from "@/lib/utils";

interface TweetItemProps {
  text: string;
  likeCount: number;
  retweetCount: number;
  replyCount: number;
  postedAt: Date;
  url?: string | null;
}

export function TweetItem({
  text,
  likeCount,
  retweetCount,
  replyCount,
  postedAt,
  url,
}: TweetItemProps) {
  return (
    <article className="rounded-xl border border-border bg-card/60 p-4 transition-colors hover:border-border">
      <p className="text-[15px] leading-relaxed">{text}</p>
      <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Heart className="h-3.5 w-3.5" />
          {formatCompactNumber(likeCount)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Repeat2 className="h-3.5 w-3.5" />
          {formatCompactNumber(retweetCount)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <MessageSquare className="h-3.5 w-3.5" />
          {formatCompactNumber(replyCount)}
        </span>
        <span className="ml-auto flex items-center gap-2">
          <time>{formatRelativeTime(postedAt)}</time>
          {url ? (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              on X
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : null}
        </span>
      </div>
    </article>
  );
}
