"use client";

import { Layers, Plus, Trash2 } from "lucide-react";
import * as React from "react";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogHeader } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BaoError } from "@/lib/bao-client";
import { useNamespace } from "@/lib/namespace";
import {
  useCreateNamespace,
  useDeleteNamespace,
  useNamespacesDetailed,
} from "@/lib/settings";

const errMsg = (e: unknown) =>
  e instanceof BaoError ? e.errors.join(", ") : "Something went wrong";

export default function NamespacesPage() {
  const list = useNamespacesDetailed();
  const create = useCreateNamespace();
  const del = useDeleteNamespace();
  const { namespace, setNamespace } = useNamespace();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [removing, setRemoving] = React.useState<string | null>(null);

  return (
    <div className="mx-auto max-w-3xl p-8">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Child namespaces of <span className="font-mono text-foreground">{namespace || "root"}</span>.
          Each is an isolated tenant with its own mounts, policies, and identities.
        </p>
        <Button size="sm" onClick={() => { setName(""); setError(null); setOpen(true); }}>
          <Plus /> New namespace
        </Button>
      </div>

      {list.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {(list.data ?? []).map((ns) => {
            const full = [namespace, ns.path.replace(/\/$/, "")].filter(Boolean).join("/");
            return (
              <li key={ns.path} className="flex items-center gap-3 px-3 py-2 text-sm">
                <Layers className="size-4 text-muted-foreground" />
                <span className="flex-1 font-mono">{ns.path}</span>
                <Button variant="ghost" size="sm" onClick={() => setNamespace(full)}>
                  Switch
                </Button>
                <Button variant="ghost" size="icon" title="Delete" onClick={() => setRemoving(ns.path)}>
                  <Trash2 />
                </Button>
              </li>
            );
          })}
          {list.data?.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">
              No child namespaces.
            </li>
          ) : null}
        </ul>
      )}

      {open ? (
        <Dialog open onClose={() => setOpen(false)}>
          <DialogHeader title="New namespace" onClose={() => setOpen(false)} />
          <form
            className="flex flex-col gap-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setError(null);
              if (!name.trim()) return setError("Name is required");
              try {
                await create.mutateAsync(name.trim());
                setOpen(false);
              } catch (err) {
                setError(errMsg(err));
              }
            }}
          >
            <div className="flex flex-col gap-2">
              <Label>Path</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="font-mono" placeholder="team-a" autoFocus />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={create.isPending}>Create</Button>
            </div>
          </form>
        </Dialog>
      ) : null}

      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        onConfirm={async () => {
          await del.mutateAsync(removing!);
          setRemoving(null);
        }}
        title={`Delete namespace "${removing}"?`}
        description="This permanently removes the namespace and everything inside it (mounts, policies, secrets)."
        confirmText="delete"
        confirmLabel="Delete namespace"
        pending={del.isPending}
      />
    </div>
  );
}
