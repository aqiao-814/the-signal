import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

/** Returns the current session (or null) for the incoming request. */
export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

/** Returns the current user or redirects to /login. Use in protected pages. */
export async function requireUser() {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }
  return session.user;
}
