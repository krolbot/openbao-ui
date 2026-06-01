"use client";

import { Box, Database, GitCompare, KeyRound, Lock, Pencil, ScrollText, Settings, Terminal, Users } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { colorDot, LabelEditor } from "@/components/label-editor";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMounts } from "@/lib/kv";
import { labelKey, useLabels } from "@/lib/labels";

// engines with a dedicated dashboard / destination (clickable)
const SUPPORTED = new Set([
  "kv", "generic", "transit", "pki", "ssh", "database", "cubbyhole", "identity", "system",
]);

// some "engines" are managed in their own section rather than browsed
function destinationFor(type: string, name: string) {
  if (type === "identity") return "/access/identity";
  if (type === "system") return "/operations";
  return `/secrets/${name}`;
}

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
    case "cubbyhole":
      return { icon: Box, blurb: "Per-token private storage" };
    case "identity":
      return { icon: Users, blurb: "Entities & groups → Access" };
    case "system":
      return { icon: Settings, blurb: "System backend → Operations" };
    default:
      return { icon: Database, blurb: "—" };
  }
}

export default function SecretsPage() {
  const { data: mounts, isLoading, isError } = useMounts();
  const { data: labels } = useLabels();
  // the mount path (with trailing slash) currently being customized
  const [editing, setEditing] = React.useState<string | null>(null);

  return (
    <div className="mx-auto max-w-5xl p-8">
      <PageHeader
        title="Secrets"
        description="Secret engines — your environments — mounted in this namespace."
        className="mb-6"
        actions={
          <Link href="/secrets/compare">
            <Button variant="outline" size="sm">
              <GitCompare /> Compare
            </Button>
          </Link>
        }
      />

      {isLoading ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <li key={i} className="flex items-start gap-3 rounded-xl border bg-card p-4 shadow-sm">
              <Skeleton className="size-9 rounded-lg" />
              <div className="flex-1 space-y-2 py-0.5">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-40" />
              </div>
            </li>
          ))}
        </ul>
      ) : isError ? (
        <p className="text-sm text-destructive">
          Could not load mounts. Check your token&apos;s permissions.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {Object.entries(mounts ?? {})
            // surface KV "environments" ahead of system engines (cubbyhole/identity/sys)
            .sort(([, a], [, b]) => {
              const env = (t: string) => (t === "kv" || t === "generic" ? 0 : 1);
              return env(a.type) - env(b.type);
            })
            .map(([path, info]) => {
            const name = path.replace(/\/$/, "");
            const supported = SUPPORTED.has(info.type);
            const isEnv = info.type === "kv" || info.type === "generic";
            const { icon: Icon, blurb } = engineMeta(info.type);
            const version = info.options?.version;
            const lbl = labels?.[labelKey("environment", path)];
            const title = lbl?.label || path;
            const inner = (
              <div className="flex h-full items-start gap-3 rounded-xl border bg-card p-4 shadow-sm transition-all duration-150 group-hover:-translate-y-0.5 group-hover:border-primary/30 group-hover:shadow-md">
                <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {lbl?.color ? (
                      <span className={`size-2.5 shrink-0 rounded-full ${colorDot(lbl.color)}`} />
                    ) : null}
                    <span className={lbl?.label ? "font-medium" : "font-mono font-medium"}>
                      {title}
                    </span>
                    {lbl?.env_group ? (
                      <Badge variant="primary" className="capitalize">{lbl.env_group}</Badge>
                    ) : null}
                    <Badge variant="muted">
                      {info.type}
                      {version ? ` v${version}` : ""}
                    </Badge>
                  </div>
                  <p className="truncate text-sm text-muted-foreground">
                    {lbl?.label ? (
                      <span className="font-mono">{path}</span>
                    ) : (
                      lbl?.description || info.description || blurb
                    )}
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
              <li key={path} className="group/card relative">
                {supported ? (
                  <Link href={destinationFor(info.type, name)} className="group block">
                    {inner}
                  </Link>
                ) : (
                  <div className="opacity-60">{inner}</div>
                )}
                {isEnv ? (
                  <button
                    type="button"
                    onClick={() => setEditing(path)}
                    title="Customize display"
                    aria-label={`Customize ${path}`}
                    className="absolute right-2 top-2 rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100 group-hover/card:opacity-100"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {editing ? (
        <LabelEditor
          open
          onClose={() => setEditing(null)}
          scope="environment"
          refPath={editing}
          current={labels?.[labelKey("environment", editing)]}
          nativeName={editing}
          showEnvGroup
        />
      ) : null}
    </div>
  );
}
