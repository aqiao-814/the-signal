import { Heart, ExternalLink } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { avatarUrl } from "@/lib/constants";
import { formatCompactNumber, formatRelativeTime } from "@/lib/utils";

interface ReplyItemProps {
  authorHandle: string;
  authorName?: string | null;
  text: string;
  likeCount: number;
  postedAt: Date;
  url?: string | null;
}

export function ReplyItem({
  authorHandle,
  authorName,
  text,
  likeCount,
  postedAt,
  url,
}: ReplyItemProps) {
  return (
    <article className="flex gap-3 rounded-xl border border-border/60 bg-secondary/20 p-4">
      <Avatar
        src={avatarUrl(authorHandle)}
        name={authorName ?? authorHandle}
        size={36}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-sm">
          <span className="truncate font-medium">
            {authorName ?? authorHandle}
          </span>
          <span className="truncate text-muted-foreground">
            @{authorHandle}
          </span>
          <span className="text-muted-foreground">·</span>
          <time className="shrink-0 text-xs text-muted-foreground">
            {formatRelativeTime(postedAt)}
          </time>
        </div>
        <p className="mt-1 text-sm leading-relaxed text-foreground/90">
          {text}
        </p>
        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Heart className="h-3 w-3" />
            {formatCompactNumber(likeCount)}
          </span>
          {url ? (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              View
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}
