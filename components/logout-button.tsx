"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    try {
      const res = await fetch("/ui/api/auth/logout", { method: "POST" });
      if (!res.ok) {
        // Non-2xx: don't navigate away on a failed logout — re-enable the
        // button so the user can retry instead of being stuck disabled.
        setLoading(false);
        return;
      }
      router.push("/login");
      router.refresh();
    } catch {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="w-full justify-start text-muted-foreground"
      onClick={logout}
      disabled={loading}
    >
      <LogOut />
      Sign out
    </Button>
  );
}
