"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useCan } from "@/lib/acl";
import { cn } from "@/lib/utils";

export default function OperationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const rel = pathname.replace(/^\/ui/, "") || "/";
  const can = useCan();

  const TABS = [
    { href: "/operations", label: "Status", show: true },
    { href: "/operations/audit", label: "Audit", show: can("sys/audit") },
    { href: "/operations/quotas", label: "Quotas", show: can("sys/quotas/rate-limit") },
    { href: "/operations/plugins", label: "Plugins", show: can("sys/plugins/catalog") },
  ].filter((t) => t.show);

  return (
    <div className="flex h-full flex-col">
      <header className="border-b px-8 pt-8">
        <h1 className="text-2xl font-semibold tracking-tight">Operations</h1>
        <p className="mb-4 text-muted-foreground">
          System status, audit, quotas, and plugins.
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
