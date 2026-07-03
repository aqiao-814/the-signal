import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/constants";

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white shadow-sm",
        className,
      )}
      aria-hidden
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className="h-5 w-5 text-white"
        strokeWidth={2}
        stroke="currentColor"
        strokeLinecap="round"
      >
        <path d="M4 14a8 8 0 0 1 8-8" opacity={0.55} />
        <path d="M6.5 16.5a4.5 4.5 0 0 1 4.5-4.5" opacity={0.85} />
        <circle cx="12" cy="17.5" r="1.6" fill="currentColor" stroke="none" />
      </svg>
    </span>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="text-lg font-semibold tracking-tight">{APP_NAME}</span>
    </span>
  );
}
