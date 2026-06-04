"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogHeader } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type AccessLevel } from "@/lib/access-policy";
import {
  previewPolicy,
  useApplyAccessRole,
  type AccessRole,
  type EnvSelector,
} from "@/lib/access-roles";
import { labelKey, useLabels, type LabelMap } from "@/lib/labels";
import { useMounts } from "@/lib/kv";
import { cn } from "@/lib/utils";

const LEVELS: AccessLevel[] = ["viewer", "editor", "admin"];
type Mode = "group" | "mounts" | "folders";

const split = (s: string) =>
  s.split(",").map((x) => x.trim()).filter(Boolean);

export function GrantAccessDialog({
  existing,
  initial,
  onClose,
}: {
  existing: AccessRole[];
  initial?: AccessRole;
  onClose: () => void;
}) {
  const { data: mounts } = useMounts();
  const { data: labels } = useLabels();
  const apply = useApplyAccessRole();

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

  const [name, setName] = React.useState(initial?.name ?? "");
  const [description, setDescription] = React.useState(initial?.description ?? "");
  const [level, setLevel] = React.useState<AccessLevel>(initial?.level ?? "editor");
  const [mode, setMode] = React.useState<Mode>(initial?.env.kind ?? (groups.length ? "group" : "mounts"));
  const [group, setGroup] = React.useState(
    initial?.env.kind === "group" ? initial.env.group : groups[0] ?? "",
  );
  const [selMounts, setSelMounts] = React.useState<string[]>(
    initial?.env.kind === "mounts" ? initial.env.mounts : [],
  );
  const [folderMount, setFolderMount] = React.useState(
    initial?.env.kind === "folders" ? initial.env.mount : kvMounts[0] ?? "",
  );
  const [folders, setFolders] = React.useState(
    initial?.env.kind === "folders" ? initial.env.folders.join(", ") : "",
  );
  const [app, setApp] = React.useState(initial?.app ?? "");
  const [error, setError] = React.useState<string | null>(null);

  const env: EnvSelector =
    mode === "group"
      ? { kind: "group", group }
      : mode === "mounts"
        ? { kind: "mounts", mounts: selMounts }
        : { kind: "folders", mount: folderMount, folders: split(folders) };

  const role: AccessRole = {
    name: name.trim(),
    description: description.trim() || undefined,
    level,
    env,
    app: app.trim() || undefined,
  };

  const preview = React.useMemo(
    () => previewPolicy(role, labels as LabelMap),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(role), labels],
  );
  // how many environments the selection resolves to (the preview's path count)
  const envCount = (preview.match(/\/data\//g) ?? []).length;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^[a-zA-Z0-9_.-]+$/.test(role.name)) {
      setError("Name is required (letters, numbers, _ . -)");
      return;
    }
    if (envCount === 0) {
      setError("This selection doesn't match any environment");
      return;
    }
    try {
      await apply.mutateAsync({ role, labels: labels as LabelMap, existing });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply");
    }
  }

  return (
    <Dialog open onClose={onClose} className="max-w-2xl">
      <DialogHeader
        title={initial ? "Edit access role" : "Grant access"}
        description="Creates an OpenBao policy + identity group scoped to the chosen environments and app. Assign members to it below."
        onClose={onClose}
      />
      <form className="flex flex-col gap-4" onSubmit={submit}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Role name">
            <Input value={name} onChange={(e) => setName(e.target.value)} className="font-mono" placeholder="payments-prod-editor" autoFocus disabled={!!initial} />
          </Field>
          <Field label="Access level">
            <Segmented options={LEVELS} value={level} onChange={(v) => setLevel(v as AccessLevel)} />
          </Field>
        </div>

        <Field label="Description (optional)">
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this grants" />
        </Field>

        {/* environment selection */}
        <div className="flex flex-col gap-2">
          <Label>Environments</Label>
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
              <Input value={folders} onChange={(e) => setFolders(e.target.value)} className="font-mono" placeholder="dev, staging, prod" />
            </div>
          )}
        </div>

        <Field label="Application (optional — folder; blank = all apps)">
          <Input value={app} onChange={(e) => setApp(e.target.value)} className="font-mono" placeholder="payments" />
        </Field>

        {/* live policy preview */}
        <div className="flex flex-col gap-1">
          <Label>Generated policy {envCount ? <span className="text-muted-foreground">({envCount} path group{envCount === 1 ? "" : "s"})</span> : null}</Label>
          <pre className="max-h-48 overflow-auto rounded-md border bg-muted/40 p-3 text-xs leading-relaxed">
            <code>{preview}</code>
          </pre>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="flex justify-end gap-2 border-t pt-4">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={apply.isPending}>
            {apply.isPending ? "Applying…" : initial ? "Save & re-sync" : "Grant access"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

const selectCls =
  "h-9 rounded-md border bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col gap-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Segmented({
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
