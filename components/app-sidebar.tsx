"use client";

import { Activity, KeyRound, LayoutDashboard, Settings, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { CommandPalette } from "@/components/command-palette";
import { NamespaceSwitcher } from "@/components/namespace-switcher";
import { SessionBar } from "@/components/session-bar";
import { ThemeToggle } from "@/components/theme";
import { useCan } from "@/lib/acl";
import { cn } from "@/lib/utils";

export function AppSidebar({ displayName }: { displayName: string }) {
  const pathname = usePathname();
  const rel = pathname.replace(/^\/ui/, "") || "/";
  const can = useCan();

  // capability-aware: hide what the token can't use (Access stays — the
  // Capabilities tester always works on your own token)
  // land on the first Access tab the token can actually use
  const accessHref = can("sys/policies/acl") ? "/access" : "/access/capabilities";
  const nav = [
    { href: "/", label: "Overview", icon: LayoutDashboard, show: true },
    { href: "/secrets", label: "Secrets", icon: KeyRound, show: can("sys/mounts") },
    { href: accessHref, label: "Access", icon: Users, show: true },
    { href: "/operations", label: "Operations", icon: Activity, show: can("sys/audit") },
    { href: "/settings", label: "Settings", icon: Settings, show: true, disabled: true },
  ].filter((n) => n.show);

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r bg-sidebar">
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <KeyRound className="size-4" />
        </div>
        <span className="flex-1 font-semibold">OpenBao</span>
        <ThemeToggle />
      </div>

      <div className="space-y-2 border-b p-3">
        <NamespaceSwitcher />
        <CommandPalette />
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {nav.map(({ href, label, icon: Icon, disabled }) => {
          const active = href === "/" ? rel === "/" : rel.startsWith(href);
          return disabled ? (
            <span
              key={href}
              className="flex cursor-not-allowed items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground/50"
            >
              <Icon className="size-4" />
              {label}
              <span className="ml-auto text-[10px] uppercase tracking-wide">
                soon
              </span>
            </span>
          ) : (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-sidebar-accent",
                active ? "bg-sidebar-accent text-foreground" : "text-sidebar-foreground",
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      <SessionBar displayName={displayName} />
    </aside>
  );
}
