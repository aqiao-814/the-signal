"use client";

import * as React from "react";
import Image from "next/image";
import { cn, initials } from "@/lib/utils";

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: number;
  className?: string;
  ring?: boolean;
}

/** Round avatar with graceful fallback to initials when the image fails. */
export function Avatar({
  src,
  name,
  size = 44,
  className,
  ring = false,
}: AvatarProps) {
  const [errored, setErrored] = React.useState(false);
  const showImage = src && !errored;

  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary text-muted-foreground",
        ring && "ring-2 ring-primary/40 ring-offset-2 ring-offset-background",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {showImage ? (
        <Image
          src={src}
          alt={name}
          width={size}
          height={size}
          onError={() => setErrored(true)}
          className="h-full w-full object-cover"
          unoptimized
        />
      ) : (
        <span
          className="font-semibold"
          style={{ fontSize: Math.max(11, size * 0.36) }}
        >
          {initials(name)}
        </span>
      )}
    </div>
  );
}
