"use client";

import { createAuthClient } from "better-auth/react";

/**
 * Client-side auth helpers. Uses NEXT_PUBLIC_APP_URL (inlined at build time).
 */
export const authClient = createAuthClient({
  baseURL:
    process.env.NEXT_PUBLIC_APP_URL ??
    (typeof window !== "undefined" ? window.location.origin : undefined),
});

export const { signIn, signUp, signOut, useSession } = authClient;
