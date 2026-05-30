import { KeyRound, LayoutDashboard, Settings, Users } from "lucide-react";
import Link from "next/link";

import { LogoutButton } from "@/components/logout-button";
import { NamespaceSwitcher } from "@/components/namespace-switcher";

// Infisical-style: a slim, quiet sidebar with a few top-level destinations.
// Access/Settings are placeholders for later phases.
const NAV = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/secrets", label: "Secrets", icon: KeyRound },
  { href: "/access", label: "Access", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings, disabled: true },
];

export function AppShell({
  displayName,
  children,
}: {
  displayName: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh">
      <aside className="flex w-60 shrink-0 flex-col border-r bg-sidebar">
        <div className="flex h-14 items-center gap-2 border-b px-4">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <KeyRound className="size-4" />
          </div>
          <span className="font-semibold">OpenBao</span>
        </div>

        <div className="border-b p-3">
          <NamespaceSwitcher />
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {NAV.map(({ href, label, icon: Icon, disabled }) =>
            disabled ? (
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
                className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
              >
                <Icon className="size-4" />
                {label}
              </Link>
            ),
          )}
        </nav>

        <div className="border-t p-3">
          <div className="px-3 py-2 text-xs text-muted-foreground">
            Signed in as
            <div className="truncate font-medium text-foreground">
              {displayName}
            </div>
          </div>
          <LogoutButton />
        </div>
      </aside>

      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
