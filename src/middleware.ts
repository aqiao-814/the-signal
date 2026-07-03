import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Optimistic, edge-fast gate for protected routes based on the *presence* of a
 * session cookie. The real session is verified server-side in each protected
 * page via `requireUser()`.
 *
 * Note: we deliberately do NOT redirect authenticated users away from the auth
 * pages here. Cookie presence != a valid session (e.g. a revoked/expired
 * session, or the DB was reset), and pairing a presence-based redirect on the
 * auth pages with a validity-based redirect on protected pages causes an
 * infinite /login <-> /dashboard loop. The login/register pages handle the
 * "already signed in" redirect themselves via a real `getSession()` check.
 */
const PROTECTED = ["/dashboard", "/onboarding", "/person"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = Boolean(getSessionCookie(req, { cookiePrefix: "signal" }));

  const isProtected = PROTECTED.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  if (isProtected && !hasSession) {
    const url = new URL("/login", req.url);
    if (pathname !== "/dashboard") url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths except Next internals, the auth API, and static files.
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.[\\w]+$).*)",
  ],
};
