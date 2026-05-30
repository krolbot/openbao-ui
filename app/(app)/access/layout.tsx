"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const TABS = [
  { href: "/access", label: "Policies" },
  { href: "/access/capabilities", label: "Capabilities" },
  { href: "/access/tokens", label: "Tokens" },
  { href: "/access/leases", label: "Leases" },
];

export default function AccessLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  // basePath (/ui) is stripped here so comparisons work regardless of version
  const rel = pathname.replace(/^\/ui/, "") || "/";

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
