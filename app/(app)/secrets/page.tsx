"use client";

import { Database, KeyRound, Lock, ScrollText, Terminal } from "lucide-react";
import Link from "next/link";

import { useMounts } from "@/lib/kv";

// engines with a dedicated dashboard (clickable)
const SUPPORTED = new Set(["kv", "generic", "transit", "pki", "ssh", "database"]);

function engineMeta(type: string) {
  switch (type) {
    case "kv":
    case "generic":
      return { icon: KeyRound, blurb: "Key/value secrets" };
    case "transit":
      return { icon: Lock, blurb: "Encryption as a service" };
    case "pki":
      return { icon: ScrollText, blurb: "Certificate authority" };
    case "ssh":
      return { icon: Terminal, blurb: "SSH certificates" };
    case "database":
      return { icon: Database, blurb: "Dynamic database credentials" };
    default:
      return { icon: Database, blurb: "—" };
  }
}

export default function SecretsPage() {
  const { data: mounts, isLoading, isError } = useMounts();

  return (
    <div className="mx-auto max-w-5xl p-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Secrets</h1>
        <p className="text-muted-foreground">
          Secret engines mounted in this namespace.
        </p>
      </header>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading engines…</p>
      ) : isError ? (
        <p className="text-sm text-destructive">
          Could not load mounts. Check your token&apos;s permissions.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {Object.entries(mounts ?? {}).map(([path, info]) => {
            const name = path.replace(/\/$/, "");
            const supported = SUPPORTED.has(info.type);
            const { icon: Icon, blurb } = engineMeta(info.type);
            const version = info.options?.version;
            const inner = (
              <div className="flex items-start gap-3 rounded-xl border p-4 transition-colors group-hover:bg-accent">
                <div className="flex size-9 items-center justify-center rounded-md bg-secondary">
                  <Icon className="size-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-medium">{path}</span>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                      {info.type}
                      {version ? ` v${version}` : ""}
                    </span>
                  </div>
                  <p className="truncate text-sm text-muted-foreground">
                    {info.description || blurb}
                  </p>
                  {!supported ? (
                    <span className="text-xs text-muted-foreground/70">
                      UI coming soon
                    </span>
                  ) : null}
                </div>
              </div>
            );
            return (
              <li key={path}>
                {supported ? (
                  <Link href={`/secrets/${name}`} className="group block">
                    {inner}
                  </Link>
                ) : (
                  <div className="opacity-60">{inner}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
