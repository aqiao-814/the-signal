import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { LoginForm } from "@/components/auth/login-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const session = await getSession();
  if (session?.user) redirect("/dashboard");

  const { redirect: redirectTo } = await searchParams;
  const safeRedirect =
    redirectTo && redirectTo.startsWith("/") ? redirectTo : "/dashboard";

  return (
    <Card className="shadow-sm">
      <CardHeader className="text-center">
        <CardTitle className="font-serif text-2xl">Welcome back</CardTitle>
        <CardDescription>Sign in to read today&apos;s briefs.</CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm redirectTo={safeRedirect} />
      </CardContent>
    </Card>
  );
}
