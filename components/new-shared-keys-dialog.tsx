"use client";

import { Plus, Trash2 } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogHeader } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label as FieldLabel } from "@/components/ui/label";
import { useMounts } from "@/lib/kv";
import { labelKey, useLabels } from "@/lib/labels";
import { useSaveSharedGroup } from "@/lib/shared-groups";
import { cn } from "@/lib/utils";

type Row = { k: string; v: string };

/**
 * Create a shared key bundle (e.g. "stripe") — a set of key/values written to
 * `<env>/_shared/<name>/config` in the chosen environments. Apps then include it
 * (read-only) so the values live in one place. Tune per-environment values later
 * in the secret browser.
 */
export function NewSharedKeysDialog({ onClose }: { onClose: () => void }) {
  const { data: mounts } = useMounts();
  const { data: labels } = useLabels();
  const save = useSaveSharedGroup();

  const kvMounts = Object.entries(mounts ?? {})
    .filter(([, v]) => v.type === "kv" || v.type === "generic")
    .map(([p]) => p.replace(/\/$/, ""));
  const envName = (m: string) => labels?.[labelKey("environment", `${m}/`)]?.label || m;

  const [name, setName] = React.useState("");
  const [rows, setRows] = React.useState<Row[]>([{ k: "", v: "" }]);
  const [envs, setEnvs] = React.useState<string[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  const cleanName = name.trim();
  const setRow = (i: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^[a-zA-Z0-9_.-]+$/.test(cleanName)) {
      setError("Name is required (letters, numbers, _ . -)");
      return;
    }
    if (envs.length === 0) {
      setError("Pick at least one environment to store the keys in");
      return;
    }
    const data: Record<string, string> = {};
    for (const r of rows) if (r.k.trim()) data[r.k.trim()] = r.v;
    try {
      await save.mutateAsync({ name: cleanName, data, envs });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    }
  }

  return (
    <Dialog open onClose={onClose} className="max-w-xl">
      <DialogHeader
        title="New shared keys"
        description="A bundle of key/values stored at _shared/<name> in the chosen environments. Apps can include it read-only, so the values live in one place."
        onClose={onClose}
      />
      <form className="flex flex-col gap-4" onSubmit={submit}>
        <div className="flex flex-col gap-2">
          <FieldLabel>Name</FieldLabel>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="font-mono" placeholder="stripe" autoFocus />
        </div>

        <div className="flex flex-col gap-2">
          <FieldLabel>Keys</FieldLabel>
          <div className="flex flex-col gap-2">
            {rows.map((r, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input value={r.k} onChange={(e) => setRow(i, { k: e.target.value })} className="font-mono" placeholder="STRIPE_API_KEY" />
                <Input value={r.v} onChange={(e) => setRow(i, { v: e.target.value })} className="font-mono" placeholder="value" />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  title="Remove"
                  onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((_, j) => j !== i) : rs))}
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
          </div>
          <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => setRows((rs) => [...rs, { k: "", v: "" }])}>
            <Plus /> Add key
          </Button>
        </div>

        <div className="flex flex-col gap-2">
          <FieldLabel>Store in environments</FieldLabel>
          {kvMounts.length ? (
            <div className="flex flex-wrap gap-2">
              {kvMounts.map((m) => (
                <label
                  key={m}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1 text-sm",
                    envs.includes(m) ? "border-primary bg-accent" : "text-muted-foreground",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={envs.includes(m)}
                    onChange={() => setEnvs((s) => (s.includes(m) ? s.filter((x) => x !== m) : [...s, m]))}
                  />
                  {envName(m)}
                </label>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No environments yet — create one first.</p>
          )}
          <p className="text-xs text-muted-foreground">
            Values are written to each selected environment; tune per-environment values later in the secret browser.
          </p>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="flex justify-end gap-2 border-t pt-4">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Create shared keys"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
