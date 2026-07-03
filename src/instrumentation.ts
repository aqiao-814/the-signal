/**
 * Runs once when the server process starts. We use it to install the Web
 * Crypto polyfill on Node 18 before any request is handled.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("@/lib/crypto-polyfill");
  }
}
