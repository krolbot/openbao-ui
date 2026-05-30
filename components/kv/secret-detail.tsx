"use client";

import { Pencil, RotateCcw, Trash2 } from "lucide-react";
import * as React from "react";

import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  EditorHandle,
  KvKeyValueEditor,
  KvValueViewer,
} from "@/components/kv/kv-fields";
import { VersionSidebar } from "@/components/kv/version-sidebar";
import { Button } from "@/components/ui/button";
import { BaoError } from "@/lib/bao-client";
import {
  useKvDeleteMetadata,
  useKvMetadata,
  useKvSecret,
  useKvVersionAction,
  useKvWrite,
} from "@/lib/kv";

const errMsg = (e: unknown) =>
  e instanceof BaoError ? e.errors.join(", ") : "Something went wrong";

export function SecretDetail({
  mount,
  secretPath,
  onDeleted,
}: {
  mount: string;
  secretPath: string;
  onDeleted: () => void;
}) {
  const meta = useKvMetadata(mount, secretPath);
  const [version, setVersion] = React.useState<number | undefined>(undefined);
  const [editing, setEditing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const editorRef = React.useRef<EditorHandle>(null);

  // reset transient state when switching secrets
  React.useEffect(() => {
    setVersion(undefined);
    setEditing(false);
    setError(null);
  }, [mount, secretPath]);

  const currentVersion = meta.data?.current_version;
  const viewing = version ?? currentVersion;
  const secret = useKvSecret(mount, secretPath, viewing);

  const write = useKvWrite(mount, secretPath);
  const softDelete = useKvVersionAction(mount, secretPath, "delete");
  const undelete = useKvVersionAction(mount, secretPath, "undelete");
  const destroy = useKvVersionAction(mount, secretPath, "destroy");
  const deleteAll = useKvDeleteMetadata(mount, secretPath);

  const [confirm, setConfirm] = React.useState<
    null | "deleteVersion" | "destroyVersion" | "deleteSecret"
  >(null);

  if (meta.isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  }
  if (meta.isError || !meta.data) {
    return (
      <div className="p-6 text-sm text-destructive">{errMsg(meta.error)}</div>
    );
  }

  const versionMeta = viewing ? meta.data.versions[String(viewing)] : undefined;
  const isDeleted = !!versionMeta?.deletion_time;
  const isDestroyed = !!versionMeta?.destroyed;
  const isCurrent = viewing === currentVersion;

  async function save() {
    setError(null);
    let data: Record<string, unknown>;
    try {
      data = editorRef.current!.getData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid input");
      return;
    }
    try {
      // optimistic-concurrency: guard against a racing writer
      await write.mutateAsync({ data, cas: currentVersion });
      setEditing(false);
      setVersion(undefined);
    } catch (e) {
      setError(errMsg(e));
    }
  }

  async function restore() {
    if (!secret.data?.data) return;
    setError(null);
    try {
      await write.mutateAsync({ data: secret.data.data, cas: currentVersion });
      setVersion(undefined);
    } catch (e) {
      setError(errMsg(e));
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b p-4">
        <div className="min-w-0">
          <div className="truncate font-mono font-medium">{secretPath}</div>
          <div className="text-xs text-muted-foreground">
            viewing v{viewing} · current v{currentVersion}
          </div>
        </div>
        <div className="flex gap-2">
          {!editing && isCurrent && !isDeleted && !isDestroyed ? (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              <Pencil /> Edit
            </Button>
          ) : null}
          {!editing && !isCurrent && !isDestroyed ? (
            <Button size="sm" variant="outline" onClick={restore}>
              <RotateCcw /> Restore this version
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="destructive"
            onClick={() => setConfirm("deleteSecret")}
          >
            <Trash2 /> Delete
          </Button>
        </div>
      </div>

      <div className="flex flex-1 gap-4 overflow-auto p-4">
        <div className="min-w-0 flex-1">
          {error ? (
            <p className="mb-3 text-sm text-destructive">{error}</p>
          ) : null}

          {editing ? (
            <>
              <KvKeyValueEditor
                ref={editorRef}
                initial={secret.data?.data ?? {}}
              />
              <div className="mt-4 flex gap-2">
                <Button onClick={save} disabled={write.isPending}>
                  {write.isPending ? "Saving…" : "Save new version"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditing(false);
                    setError(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </>
          ) : isDestroyed ? (
            <p className="py-6 text-center text-sm text-destructive">
              This version was permanently destroyed.
            </p>
          ) : isDeleted ? (
            <div className="py-6 text-center">
              <p className="mb-3 text-sm text-amber-600">
                This version is soft-deleted.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => undelete.mutate([viewing!])}
              >
                Undelete
              </Button>
            </div>
          ) : (
            <>
              <KvValueViewer data={secret.data?.data ?? {}} />
              {isCurrent ? (
                <div className="mt-4 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirm("deleteVersion")}
                  >
                    Soft-delete this version
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirm("destroyVersion")}
                  >
                    Destroy this version
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </div>

        <VersionSidebar
          metadata={meta.data}
          selected={viewing!}
          onSelect={(v) => {
            setVersion(v);
            setEditing(false);
          }}
        />
      </div>

      <ConfirmDialog
        open={confirm === "deleteVersion"}
        onClose={() => setConfirm(null)}
        onConfirm={async () => {
          await softDelete.mutateAsync([viewing!]);
          setConfirm(null);
        }}
        title={`Soft-delete v${viewing}?`}
        description="The version is hidden but can be undeleted later."
        confirmLabel="Soft-delete"
        pending={softDelete.isPending}
      />
      <ConfirmDialog
        open={confirm === "destroyVersion"}
        onClose={() => setConfirm(null)}
        onConfirm={async () => {
          await destroy.mutateAsync([viewing!]);
          setConfirm(null);
        }}
        title={`Permanently destroy v${viewing}?`}
        description="This cannot be undone — the version's data is removed."
        confirmText="destroy"
        confirmLabel="Destroy"
        pending={destroy.isPending}
      />
      <ConfirmDialog
        open={confirm === "deleteSecret"}
        onClose={() => setConfirm(null)}
        onConfirm={async () => {
          await deleteAll.mutateAsync();
          setConfirm(null);
          onDeleted();
        }}
        title="Delete secret and all versions?"
        description={`Permanently removes "${secretPath}" and its entire history + metadata.`}
        confirmText="delete"
        confirmLabel="Delete everything"
        pending={deleteAll.isPending}
      />
    </div>
  );
}
