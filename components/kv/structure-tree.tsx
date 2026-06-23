"use client";

import { ChevronRight, FileKey2, Folder, Lock, Pencil, Plus } from "lucide-react";
import * as React from "react";

import { ColorDot } from "@/components/label-editor";
import {
  EditorHandle,
  KvKeyValueEditor,
  KvValueViewer,
} from "@/components/kv/kv-fields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BaoError } from "@/lib/bao-client";
import { useKvList, useKvSecret, useKvWrite } from "@/lib/kv";
import { cn } from "@/lib/utils";

/** One environment = one KV/generic mount, with display metadata. */
export type StructEnv = { mount: string; name: string; color: string | null };

// Cap rendered rows per level — OpenBao LIST is unpaginated, so a folder with
// thousands of keys (unioned across envs) would otherwise blow up the DOM.
const PAGE = 300;

const errMsg = (e: unknown) =>
  e instanceof BaoError ? e.errors.join(", ") : "Something went wrong";

/**
 * Unified, lazy cross-environment KV tree. Browses the *union* of every selected
 * environment's secret structure: folders expand on demand, and each secret row
 * expands to a side-by-side per-environment grid where you can view/edit existing
 * values or create the secret in an environment that doesn't have it yet.
 *
 * Listings/reads go through the real `useKvList`/`useKvSecret` hooks (shared query
 * cache), so a write via `useKvWrite` invalidates and refreshes this view too.
 */
export function StructureTree({
  envs,
  show,
}: {
  envs: StructEnv[];
  show: boolean;
}) {
  if (envs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Select at least one environment to see its structure.
      </p>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border">
      <Children envs={envs} rel="" depth={0} show={show} />
    </div>
  );
}

type ListResult = { keys: string[]; loading: boolean; forbidden: boolean };

// Fetches ONE env's listing at a path and reports it upward. Kept as its own
// component so we obey rules-of-hooks (one `useKvList` per instance) while still
// fanning out across a dynamic set of environments.
function EnvLister({
  mount,
  path,
  onResult,
}: {
  mount: string;
  path: string;
  onResult: (mount: string, r: ListResult) => void;
}) {
  const list = useKvList(mount, path);
  const forbidden = list.error instanceof BaoError && list.error.status === 403;
  React.useEffect(() => {
    onResult(mount, {
      // a 404 (path absent in this env) surfaces as an error → just empty keys
      keys: list.data ?? [],
      loading: list.isLoading,
      forbidden,
    });
  }, [mount, list.data, list.isLoading, forbidden, onResult]);
  return null;
}

function Children({
  envs,
  rel,
  depth,
  show,
}: {
  envs: StructEnv[];
  rel: string;
  depth: number;
  show: boolean;
}) {
  const [results, setResults] = React.useState<Record<string, ListResult>>({});
  const [limit, setLimit] = React.useState(PAGE);

  const onResult = React.useCallback((mount: string, r: ListResult) => {
    setResults((prev) => {
      const cur = prev[mount];
      // useKvList yields a stable array ref while unchanged, so identity suffices
      if (
        cur &&
        cur.loading === r.loading &&
        cur.forbidden === r.forbidden &&
        cur.keys === r.keys
      ) {
        return prev;
      }
      return { ...prev, [mount]: r };
    });
  }, []);

  // union of all keys across envs (+ which envs contain each, + which denied the
  // listing), memoized so it isn't rebuilt on every per-env result report.
  const { present, keys, anyLoading, forbidden } = React.useMemo(() => {
    const present = new Map<string, Set<string>>();
    const forbidden = new Set<string>();
    let anyLoading = false;
    for (const e of envs) {
      const r = results[e.mount];
      if (!r || r.loading) anyLoading = true;
      if (r?.forbidden) forbidden.add(e.mount);
      for (const k of r?.keys ?? []) {
        let set = present.get(k);
        if (!set) present.set(k, (set = new Set()));
        set.add(e.mount);
      }
    }
    const keys = [...present.keys()].sort((a, b) => a.localeCompare(b));
    return { present, keys, anyLoading, forbidden };
  }, [envs, results]);

  const indent = { paddingLeft: depth * 16 + 12 };

  return (
    <>
      {/* hidden per-env listers (one real useKvList each) */}
      {envs.map((e) => (
        <EnvLister key={e.mount} mount={e.mount} path={rel} onResult={onResult} />
      ))}

      {anyLoading && keys.length === 0 ? (
        <p className="px-3 py-2 text-xs text-muted-foreground" style={indent}>
          Loading…
        </p>
      ) : keys.length === 0 ? (
        // Distinguish "nothing here" from "you can't list here" (403): folding a
        // forbidden listing into an empty union makes no-access look like no-secrets.
        forbidden.size > 0 ? (
          <p
            className="flex items-center gap-1.5 px-3 py-2 text-xs text-muted-foreground"
            style={indent}
          >
            <Lock className="size-3.5" /> No list access in {forbidden.size} of{" "}
            {envs.length} environment{envs.length === 1 ? "" : "s"}.
          </p>
        ) : (
          <p className="px-3 py-2 text-xs text-muted-foreground" style={indent}>
            (empty)
          </p>
        )
      ) : (
        <>
          {keys.slice(0, limit).map((k) => {
            const isFolder = k.endsWith("/");
            const name = k.replace(/\/$/, "");
            const childRel = rel ? `${rel}/${name}` : name;
            const here = present.get(k)!;
            // Always pass the full env list down: a secret under a folder that's
            // absent in some envs must still offer those envs a "Create here" cell.
            // The extra LIST calls for envs lacking the folder just 404 → empty.
            return isFolder ? (
              <FolderRow
                key={k}
                envs={envs}
                name={name}
                rel={childRel}
                depth={depth}
                present={here}
                forbidden={forbidden}
                show={show}
              />
            ) : (
              <SecretRow
                key={k}
                envs={envs}
                name={name}
                path={childRel}
                depth={depth}
                present={here}
                forbidden={forbidden}
                show={show}
              />
            );
          })}
          {keys.length > limit ? (
            <button
              type="button"
              onClick={() => setLimit((n) => n + PAGE)}
              className="w-full px-3 py-2 text-left text-xs text-primary hover:bg-accent/50"
              style={indent}
            >
              Show {Math.min(PAGE, keys.length - limit)} more… ({keys.length - limit} hidden)
            </button>
          ) : null}
        </>
      )}
    </>
  );
}

// small colored dots showing which envs contain a path: dimmed where absent,
// amber-ringed where the env denied the listing (no-access ≠ absent).
function PresenceDots({
  envs,
  present,
  forbidden,
}: {
  envs: StructEnv[];
  present: Set<string>;
  forbidden?: Set<string>;
}) {
  return (
    <span className="ml-auto flex shrink-0 items-center gap-1 pl-2">
      {envs.map((e) => {
        const has = present.has(e.mount);
        const denied = forbidden?.has(e.mount);
        return (
          <span
            key={e.mount}
            title={`${e.name}: ${has ? "present" : denied ? "no list access" : "absent"}`}
            className={cn("rounded-full", denied && "ring-1 ring-amber-500/60")}
          >
            <ColorDot
              color={e.color}
              className={cn("size-2", !has && "opacity-20 grayscale")}
            />
          </span>
        );
      })}
    </span>
  );
}

function Row({
  depth,
  open,
  onToggle,
  icon: Icon,
  name,
  hint,
  children,
}: {
  depth: number;
  open: boolean;
  onToggle: () => void;
  icon: React.ComponentType<{ className?: string }>;
  name: string;
  hint?: string;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center gap-1.5 border-b py-2 pr-3 text-sm last:border-b-0 hover:bg-accent/40"
      style={{ paddingLeft: depth * 16 + 8 }}
    >
      <ChevronRight
        className={cn(
          "size-3.5 shrink-0 text-muted-foreground transition-transform",
          open && "rotate-90",
        )}
      />
      <Icon className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="truncate font-mono">{name}</span>
      {hint ? (
        <span className="shrink-0 font-mono text-xs text-muted-foreground">{hint}</span>
      ) : null}
      {children}
    </button>
  );
}

function FolderRow({
  envs,
  name,
  rel,
  depth,
  present,
  forbidden,
  show,
}: {
  envs: StructEnv[];
  name: string;
  rel: string;
  depth: number;
  present: Set<string>;
  forbidden: Set<string>;
  show: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Row
        depth={depth}
        open={open}
        onToggle={() => setOpen((o) => !o)}
        icon={Folder}
        name={name}
        hint="/"
      >
        <PresenceDots envs={envs} present={present} forbidden={forbidden} />
      </Row>
      {open ? <Children envs={envs} rel={rel} depth={depth + 1} show={show} /> : null}
    </>
  );
}

function SecretRow({
  envs,
  name,
  path,
  depth,
  present,
  forbidden,
  show,
}: {
  envs: StructEnv[];
  name: string;
  path: string;
  depth: number;
  present: Set<string>;
  forbidden: Set<string>;
  show: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Row
        depth={depth}
        open={open}
        onToggle={() => setOpen((o) => !o)}
        icon={FileKey2}
        name={name}
      >
        <PresenceDots envs={envs} present={present} forbidden={forbidden} />
      </Row>
      {open ? (
        <div className="border-b bg-muted/20 px-3 py-3">
          <div className="flex gap-3 overflow-x-auto">
            {envs.map((e) => (
              <EnvCell key={e.mount} env={e} path={path} show={show} />
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}

// Self-contained per-environment cell: own read, own edit state, own write.
function EnvCell({
  env,
  path,
  show,
}: {
  env: StructEnv;
  path: string;
  show: boolean;
}) {
  const secret = useKvSecret(env.mount, path);
  const write = useKvWrite(env.mount, path);
  const [editing, setEditing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const editorRef = React.useRef<EditorHandle>(null);

  const status = secret.error instanceof BaoError ? secret.error.status : undefined;
  const forbidden = status === 403;
  // Only a real 404 means "doesn't exist here" → offer create. Other failures
  // (5xx/transient/network) are surfaced as errors so we never mislabel an
  // existing-but-unreadable secret as missing (and then clobber it on write).
  const missing = secret.isError && status === 404;
  const errored = secret.isError && !forbidden && !missing;
  const present = !secret.isError && !!secret.data;
  const data = (secret.data?.data as Record<string, unknown> | null) ?? null;
  const version = secret.data?.metadata?.version;

  async function save() {
    setError(null);
    let payload: Record<string, unknown>;
    try {
      payload = editorRef.current!.getData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid input");
      return;
    }
    try {
      // existing secret → CAS on current version; create → cas:0 (v1 ignores it)
      await write.mutateAsync({ data: payload, cas: present ? version : 0 });
      setEditing(false);
    } catch (e) {
      setError(errMsg(e));
    }
  }

  return (
    <div className="w-72 shrink-0 rounded-lg border bg-card">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <ColorDot color={env.color} className="size-2.5 shrink-0" />
        <span className="min-w-0 truncate text-sm font-medium" title={env.mount}>
          {env.name}
        </span>
        {forbidden ? (
          <Badge variant="muted" className="ml-auto shrink-0">no access</Badge>
        ) : errored ? (
          <Badge variant="muted" className="ml-auto shrink-0">error</Badge>
        ) : missing && !editing ? (
          <Badge variant="muted" className="ml-auto shrink-0">no secret</Badge>
        ) : null}
      </div>

      <div className="p-3">
        {secret.isLoading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : forbidden ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="size-3.5" /> Your token can&apos;t read this environment.
          </p>
        ) : errored ? (
          <div className="flex flex-col items-start gap-2 py-1">
            <p className="text-xs text-destructive">{errMsg(secret.error)}</p>
            <Button size="sm" variant="outline" onClick={() => secret.refetch()}>
              Retry
            </Button>
          </div>
        ) : editing ? (
          <>
            {error ? <p className="mb-2 text-xs text-destructive">{error}</p> : null}
            <KvKeyValueEditor ref={editorRef} initial={data ?? {}} />
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={save} disabled={write.isPending}>
                {write.isPending ? "Saving…" : present ? "Save new version" : "Create"}
              </Button>
              <Button
                size="sm"
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
        ) : present ? (
          <>
            <KvValueViewer data={data ?? {}} reveal={show} />
            <Button
              size="sm"
              variant="outline"
              className="mt-3"
              onClick={() => setEditing(true)}
            >
              <Pencil /> Edit
            </Button>
          </>
        ) : (
          <div className="flex flex-col items-start gap-2 py-1">
            <p className="text-xs text-muted-foreground">No secret at this path here.</p>
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              <Plus /> Create here
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
