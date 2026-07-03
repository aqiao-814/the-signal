"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { signOut } from "@/lib/auth-client";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export function LogoutButton({
  variant = "ghost",
  size = "sm",
  className,
}: Pick<ButtonProps, "variant" | "size" | "className">) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function handleLogout() {
    start(async () => {
      await signOut();
      router.replace("/login");
      router.refresh();
    });
  }

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={handleLogout}
      disabled={pending}
    >
      {pending ? <Spinner /> : <LogOut className="h-4 w-4" />}
      <span>Sign out</span>
    </Button>
  );
}
