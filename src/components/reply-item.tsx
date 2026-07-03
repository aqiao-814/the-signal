import { Heart, ExternalLink, CornerDownRight } from "lucide-react";
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
  /** The post this reply was responding to. */
  replyingTo?: { text: string; url?: string | null } | null;
}

function snippet(text: string, max = 70): string {
  const clean = text
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return clean.length > max ? clean.slice(0, max - 1).trim() + "…" : clean;
}

export function ReplyItem({
  authorHandle,
  authorName,
  text,
  likeCount,
  postedAt,
  url,
  replyingTo,
}: ReplyItemProps) {
  const parent = replyingTo?.text ? snippet(replyingTo.text) : null;
  return (
    <article className="flex gap-3 rounded-xl border border-border/60 bg-secondary/20 p-4">
      <Avatar
        src={avatarUrl(authorHandle)}
        name={authorName ?? authorHandle}
        size={36}
      />
      <div className="min-w-0 flex-1">
        {parent ? (
          <p className="mb-1.5 flex items-start gap-1.5 text-xs text-muted-foreground">
            <CornerDownRight className="mt-0.5 h-3 w-3 shrink-0" />
            <span className="min-w-0">
              Replying to{" "}
              {replyingTo?.url ? (
                <a
                  href={replyingTo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="italic text-foreground/70 hover:text-primary hover:underline"
                >
                  &ldquo;{parent}&rdquo;
                </a>
              ) : (
                <span className="italic text-foreground/70">
                  &ldquo;{parent}&rdquo;
                </span>
              )}
            </span>
          </p>
        ) : null}
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
