/**
 * Node 18 does not expose the Web Crypto API as a global by default, but
 * Better Auth (and other modern libraries) rely on `globalThis.crypto`.
 * Import this module before any code that needs it.
 *
 * This is a no-op on Node 20+ and in the Next.js runtime where the global
 * already exists.
 */
import { webcrypto } from "node:crypto";

if (typeof (globalThis as { crypto?: unknown }).crypto === "undefined") {
  (globalThis as { crypto?: unknown }).crypto = webcrypto;
}

export {};
