"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useCan } from "@/lib/acl";
import { cn } from "@/lib/utils";

export default function AccessLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  // basePath (/ui) is stripped here so comparisons work regardless of version
  const rel = pathname.replace(/^\/ui/, "") || "/";
  const can = useCan();

  // Capabilities always works on your own token; the rest are gated.
  const TABS = [
    { href: "/access", label: "Policies", show: can("sys/policies/acl") },
    { href: "/access/capabilities", label: "Capabilities", show: true },
    { href: "/access/tokens", label: "Tokens", show: can("auth/token/accessors") },
    { href: "/access/leases", label: "Leases", show: can("sys/leases/lookup") },
  ].filter((t) => t.show);

  return (
    <div className="flex h-full flex-col">
      <header className="border-b px-8 pt-8">
        <h1 className="text-2xl font-semibold tracking-tight">Access</h1>
        <p className="mb-4 text-muted-foreground">
          Policies, capabilities, tokens, and leases.
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
