"use client";

import * as React from "react";

import { EnvScopePicker, Segmented } from "@/components/env-selector";
import { SharedKeysPicker } from "@/components/shared-keys-picker";
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

const LEVELS: AccessLevel[] = ["viewer", "editor", "admin"];

export function GrantAccessDialog({
  existing,
  initial,
  initialApp,
  onClose,
}: {
  existing: AccessRole[];
  initial?: AccessRole;
  initialApp?: string;
  onClose: () => void;
}) {
  const apply = useApplyAccessRole();

  const [name, setName] = React.useState(initial?.name ?? "");
  const [description, setDescription] = React.useState(initial?.description ?? "");
  const [level, setLevel] = React.useState<AccessLevel>(initial?.level ?? "editor");
  const [env, setEnv] = React.useState<EnvSelector>(initial?.env ?? { kind: "mounts", mounts: [] });
  const [app, setApp] = React.useState(initial?.app ?? initialApp ?? "");
  const [shared, setShared] = React.useState<string[]>(initial?.shared ?? []);
  const [error, setError] = React.useState<string | null>(null);

  const role: AccessRole = {
    name: name.trim(),
    description: description.trim() || undefined,
    level,
    env,
    app: app.trim() || undefined,
    shared: shared.length ? shared : undefined,
  };

  const preview = React.useMemo(
    () => previewPolicy(role),
    [JSON.stringify(role)],
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
      await apply.mutateAsync({ role, existing });
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

        <EnvScopePicker initial={initial?.env} onChange={setEnv} />

        <Field label="Application (optional — folder; blank = all apps)">
          <Input value={app} onChange={(e) => setApp(e.target.value)} className="font-mono" placeholder="payments" />
        </Field>

        <SharedKeysPicker value={shared} onChange={setShared} />

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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col gap-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
