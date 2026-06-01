"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useCan } from "@/lib/acl";
import { cn } from "@/lib/utils";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const rel = pathname.replace(/^\/ui/, "") || "/";
  const can = useCan();

  const TABS = [
    { href: "/settings", label: "Profile", show: true },
    { href: "/settings/preferences", label: "Preferences", show: true },
    { href: "/settings/namespaces", label: "Namespaces", show: can("sys/namespaces") },
    { href: "/settings/password-policies", label: "Password Policies", show: can("sys/policies/password") },
    { href: "/settings/server", label: "Server", show: can("sys/config/state/sanitized") },
    { href: "/settings/about", label: "About", show: true },
  ].filter((t) => t.show);

  return (
    <div className="flex h-full flex-col">
      <header className="border-b px-8 pt-8">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mb-4 text-muted-foreground">
          Your profile, UI preferences, namespaces, and server configuration.
        </p>
        <nav className="flex gap-1">
          {TABS.map((t) => {
            const active = rel === t.href;
            return (
              <Link
                key={t.href}
                href={t.href}
                className={cn(
                  "rounded-t-md border-b-2 px-3 py-2 text-sm font-medium",
                  active
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <div className="min-h-0 flex-1 overflow-auto">{children}</div>
    </div>
  );
}
