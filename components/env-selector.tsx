"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type EnvSelector } from "@/lib/access-roles";
import { useMounts } from "@/lib/kv";
import { labelKey, useLabels } from "@/lib/labels";
import { cn } from "@/lib/utils";

type Mode = EnvSelector["kind"]; // "group" | "mounts" | "folders"

const split = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

const selectCls =
  "h-9 rounded-md border bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * Reusable environment-scope picker (env group / specific mounts / env folders),
 * shared by the access-grant dialog and the app-credential wizard. Controlled by
 * output: it owns the sub-state and reports the resolved `EnvSelector` upward via
 * `onChange` whenever the selection changes.
 */
export function EnvScopePicker({
  initial,
  onChange,
  label = "Environments",
}: {
  initial?: EnvSelector;
  onChange: (env: EnvSelector) => void;
  label?: string;
}) {
  const { data: mounts } = useMounts();
  const { data: labels } = useLabels();

  const kvMounts = Object.entries(mounts ?? {})
    .filter(([, v]) => v.type === "kv" || v.type === "generic")
    .map(([p]) => p.replace(/\/$/, ""));
  const envName = (m: string) => labels?.[labelKey("environment", `${m}/`)]?.label || m;
  const groups = Array.from(
    new Set(
      Object.values(labels ?? {})
        .filter((l) => l.scope === "environment" && l.env_group)
        .map((l) => l.env_group as string),
    ),
  ).sort();

  const [mode, setMode] = React.useState<Mode>(initial?.kind ?? "group");
  const [group, setGroup] = React.useState(initial?.kind === "group" ? initial.group : "");
  const [selMounts, setSelMounts] = React.useState<string[]>(
    initial?.kind === "mounts" ? initial.mounts : [],
  );
  const [folderMount, setFolderMount] = React.useState(
    initial?.kind === "folders" ? initial.mount : "",
  );
  const [foldersText, setFoldersText] = React.useState(
    initial?.kind === "folders" ? initial.folders.join(", ") : "",
  );

  // Default to "mounts" mode when no env groups exist, and seed the group /
  // folder-mount selects once the mount list + labels have loaded.
  React.useEffect(() => {
    if (!initial && groups.length === 0 && kvMounts.length) setMode("mounts");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups.length, kvMounts.length]);
  React.useEffect(() => {
    if (!group && groups.length) setGroup(groups[0]);
  }, [groups, group]);
  React.useEffect(() => {
    if (!folderMount && kvMounts.length) setFolderMount(kvMounts[0]);
  }, [kvMounts, folderMount]);

  const env: EnvSelector =
    mode === "group"
      ? { kind: "group", group }
      : mode === "mounts"
        ? { kind: "mounts", mounts: selMounts }
        : { kind: "folders", mount: folderMount, folders: split(foldersText) };

  // Report upward only when the resolved value actually changes (by content),
  // so a parent re-render doesn't loop.
  const envKey = JSON.stringify(env);
  React.useEffect(() => {
    onChange(env);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [envKey]);

  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      <Segmented
        options={["group", "mounts", "folders"]}
        labels={{ group: "By env group", mounts: "Specific environments", folders: "Env folders in a mount" }}
        value={mode}
        onChange={(v) => setMode(v as Mode)}
      />
      {mode === "group" ? (
        groups.length ? (
          <select value={group} onChange={(e) => setGroup(e.target.value)} className={selectCls}>
            {groups.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        ) : (
          <p className="text-xs text-muted-foreground">
            No env groups yet — tag environments with a group on the Secrets page first.
          </p>
        )
      ) : mode === "mounts" ? (
        <div className="flex flex-wrap gap-2">
          {kvMounts.map((m) => (
            <label key={m} className={cn("flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1 text-sm", selMounts.includes(m) ? "border-primary bg-accent" : "text-muted-foreground")}>
              <input type="checkbox" checked={selMounts.includes(m)} onChange={() => setSelMounts((s) => s.includes(m) ? s.filter((x) => x !== m) : [...s, m])} />
              {envName(m)}
            </label>
          ))}
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          <select value={folderMount} onChange={(e) => setFolderMount(e.target.value)} className={selectCls}>
            {kvMounts.map((m) => (<option key={m} value={m}>{envName(m)}</option>))}
          </select>
          <Input value={foldersText} onChange={(e) => setFoldersText(e.target.value)} className="font-mono" placeholder="dev, staging, prod" />
        </div>
      )}
    </div>
  );
}

export function Segmented({
  options,
  labels,
  value,
  onChange,
}: {
  options: string[];
  labels?: Record<string, string>;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={cn(
            "rounded-md border px-2.5 py-1 text-sm capitalize",
            value === o ? "border-primary bg-accent" : "text-muted-foreground",
          )}
        >
          {labels?.[o] ?? o}
        </button>
      ))}
    </div>
  );
}
