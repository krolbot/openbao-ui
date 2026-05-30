"use client";

import { History } from "lucide-react";

import type { KvMetadata } from "@/lib/kv";
import { cn } from "@/lib/utils";

function versionStatus(meta: { deletion_time: string; destroyed: boolean }) {
  if (meta.destroyed) return { label: "destroyed", cls: "text-destructive" };
  if (meta.deletion_time) return { label: "deleted", cls: "text-amber-500" };
  return { label: "active", cls: "text-emerald-500" };
}

export function VersionSidebar({
  metadata,
  selected,
  onSelect,
}: {
  metadata: KvMetadata;
  selected: number;
  onSelect: (version: number) => void;
}) {
  const versions = Object.entries(metadata.versions)
    .map(([v, m]) => ({ version: Number(v), ...m }))
    .sort((a, b) => b.version - a.version);

  return (
    <div className="w-56 shrink-0 border-l pl-4">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium">
        <History className="size-4" />
        Versions
      </div>
      <ul className="flex flex-col gap-1">
        {versions.map((v) => {
          const status = versionStatus(v);
          const isCurrent = v.version === metadata.current_version;
          return (
            <li key={v.version}>
              <button
                onClick={() => onSelect(v.version)}
                className={cn(
                  "w-full rounded-md border px-3 py-2 text-left text-sm hover:bg-accent",
                  v.version === selected && "border-primary bg-accent",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">v{v.version}</span>
                  <span className={cn("text-xs", status.cls)}>
                    {status.label}
                  </span>
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {new Date(v.created_time).toLocaleString()}
                  {isCurrent ? " · current" : ""}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
