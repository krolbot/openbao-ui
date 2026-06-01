"use client";

import {
  Activity,
  KeyRound,
  LayoutDashboard,
  Moon,
  Search,
  Settings as SettingsIcon,
  Shield,
} from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { useTheme } from "@/components/theme";
import { useMounts } from "@/lib/kv";

type Command = {
  id: string;
  label: string;
  hint?: string;
  icon: React.ReactNode;
  run: () => void;
};

export function CommandPalette() {
  const router = useRouter();
  const { toggle } = useTheme();
  const { data: mounts } = useMounts();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);

  // global ⌘K / Ctrl+K
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  React.useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
    }
  }, [open]);

  const go = React.useCallback(
    (href: string) => () => {
      router.push(href);
      setOpen(false);
    },
    [router],
  );

  const commands = React.useMemo<Command[]>(() => {
    const nav: Command[] = [
      { id: "overview", label: "Overview", icon: <LayoutDashboard />, run: go("/") },
      { id: "secrets", label: "Secrets", icon: <KeyRound />, run: go("/secrets") },
      { id: "policies", label: "Access · Policies", icon: <Shield />, run: go("/access") },
      { id: "auth", label: "Access · Auth Methods", icon: <Shield />, run: go("/access/auth") },
      { id: "identity", label: "Access · Identity", icon: <Shield />, run: go("/access/identity") },
      { id: "mfa", label: "Access · MFA", icon: <Shield />, run: go("/access/mfa") },
      { id: "capabilities", label: "Access · Capabilities", icon: <Shield />, run: go("/access/capabilities") },
      { id: "tokens", label: "Access · Tokens", icon: <Shield />, run: go("/access/tokens") },
      { id: "leases", label: "Access · Leases", icon: <Shield />, run: go("/access/leases") },
      { id: "ops-status", label: "Operations · Status", icon: <Activity />, run: go("/operations") },
      { id: "ops-audit", label: "Operations · Audit", icon: <Activity />, run: go("/operations/audit") },
      { id: "ops-quotas", label: "Operations · Quotas", icon: <Activity />, run: go("/operations/quotas") },
      { id: "ops-plugins", label: "Operations · Plugins", icon: <Activity />, run: go("/operations/plugins") },
      { id: "settings", label: "Settings · Profile", icon: <SettingsIcon />, run: go("/settings") },
      { id: "settings-prefs", label: "Settings · Preferences", icon: <SettingsIcon />, run: go("/settings/preferences") },
      { id: "settings-ns", label: "Settings · Namespaces", icon: <SettingsIcon />, run: go("/settings/namespaces") },
      { id: "theme", label: "Toggle dark mode", icon: <Moon />, run: () => { toggle(); setOpen(false); } },
    ];
    const kvMounts = Object.keys(mounts ?? {}).map((path) => {
      const name = path.replace(/\/$/, "");
      return {
        id: `mount-${name}`,
        label: `Open engine ${path}`,
        hint: "secrets",
        icon: <KeyRound />,
        run: go(`/secrets/${name}`),
      } satisfies Command;
    });
    return [...nav, ...kvMounts];
  }, [go, toggle, mounts]);

  const filtered = commands.filter((c) =>
    c.label.toLowerCase().includes(query.toLowerCase()),
  );

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      filtered[active]?.run();
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-md border px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent"
      >
        <Search className="size-4" />
        <span className="flex-1 text-left">Search…</span>
        <kbd className="rounded border bg-muted px-1.5 text-xs">⌘K</kbd>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[15vh]"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-lg overflow-hidden rounded-xl border bg-card shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b px-3">
              <Search className="size-4 text-muted-foreground" />
              <input
                autoFocus
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                onKeyDown={onKeyDown}
                placeholder="Jump to…"
                className="h-11 flex-1 bg-transparent text-sm outline-none"
              />
            </div>
            <ul className="max-h-80 overflow-auto p-2">
              {filtered.length === 0 ? (
                <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                  No matches
                </li>
              ) : (
                filtered.map((c, i) => (
                  <li key={c.id}>
                    <button
                      onMouseEnter={() => setActive(i)}
                      onClick={c.run}
                      className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm [&_svg]:size-4 [&_svg]:text-muted-foreground ${
                        i === active ? "bg-accent" : ""
                      }`}
                    >
                      {c.icon}
                      <span className="flex-1">{c.label}</span>
                      {c.hint ? (
                        <span className="text-xs text-muted-foreground">
                          {c.hint}
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      ) : null}
    </>
  );
}
