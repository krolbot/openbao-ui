"use client";

import { ArrowLeft, Eye, EyeOff, Network } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { ColorDot } from "@/components/label-editor";
import { PageHeader } from "@/components/page-header";
import { StructureTree, type StructEnv } from "@/components/kv/structure-tree";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useMounts } from "@/lib/kv";
import { labelKey, useLabels } from "@/lib/labels";
import { cn } from "@/lib/utils";

export default function StructurePage() {
  const mounts = useMounts();
  const { data: labels } = useLabels();

  const kvMounts = Object.entries(mounts.data ?? {})
    .filter(([, v]) => v.type === "kv" || v.type === "generic")
    .map(([p]) => p.replace(/\/$/, ""));
  const env = (m: string) => labels?.[labelKey("environment", `${m}/`)];
  const envName = (m: string) => env(m)?.label || m;
  const envColor = (m: string) => env(m)?.color ?? null;

  const [selected, setSelected] = React.useState<string[]>([]);
  const [show, setShow] = React.useState(false);

  // default-select all KV mounts once they load
  React.useEffect(() => {
    if (kvMounts.length && selected.length === 0) setSelected(kvMounts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounts.data]);

  function toggle(m: string) {
    setSelected((s) => (s.includes(m) ? s.filter((x) => x !== m) : [...s, m]));
  }

  const envs: StructEnv[] = kvMounts
    .filter((m) => selected.includes(m))
    .map((m) => ({ mount: m, name: envName(m), color: envColor(m) }));

  return (
    <div className="mx-auto max-w-6xl p-8">
      <Link
        href="/secrets"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Secrets
      </Link>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <Network className="size-6" /> Structure
          </span>
        }
        description="The whole secret tree across your environments. Expand a secret to view, edit, or fill it in where it's missing."
        className="mb-6"
        actions={
          <Button variant="outline" size="sm" onClick={() => setShow((s) => !s)}>
            {show ? <EyeOff /> : <Eye />} {show ? "Hide" : "Show"} values
          </Button>
        }
      />

      <div className="mb-6 flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-sm">
        <Label>Environments</Label>
        {mounts.isLoading ? (
          <div className="flex gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-7 w-24 rounded-md" />
            ))}
          </div>
        ) : kvMounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No KV environments found in this namespace.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {kvMounts.map((m) => (
              <label
                key={m}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1 text-sm",
                  selected.includes(m) ? "border-primary bg-accent" : "text-muted-foreground",
                )}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(m)}
                  onChange={() => toggle(m)}
                />
                <ColorDot color={envColor(m)} className="size-2.5 shrink-0" />
                <span title={m} className={env(m)?.label ? "font-medium" : "font-mono"}>
                  {envName(m)}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      {!mounts.isLoading ? <StructureTree envs={envs} show={show} /> : null}
    </div>
  );
}
