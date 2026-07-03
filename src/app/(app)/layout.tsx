import { requireUser } from "@/lib/session";
import { AppHeader } from "@/components/app-header";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  return (
    <div className="relative flex min-h-dvh flex-col">
      <AppHeader user={{ name: user.name, email: user.email }} />
      <div className="flex-1">{children}</div>
    </div>
  );
}
