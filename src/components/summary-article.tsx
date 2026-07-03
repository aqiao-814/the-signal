import { cn } from "@/lib/utils";

/** Renders article prose, splitting the body into paragraphs. */
export function SummaryArticle({
  body,
  className,
}: {
  body: string;
  className?: string;
}) {
  const paragraphs = body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <div
      className={cn(
        "space-y-4 text-[15px] leading-relaxed text-foreground/90",
        "first-letter:font-serif [&>p:first-of-type]:first-letter:float-left [&>p:first-of-type]:first-letter:mr-1 [&>p:first-of-type]:first-letter:text-5xl [&>p:first-of-type]:first-letter:font-semibold [&>p:first-of-type]:first-letter:leading-[0.8] [&>p:first-of-type]:first-letter:text-primary",
        className,
      )}
    >
      {paragraphs.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </div>
  );
}
