"use client";

import { ChevronRight, Eye, EyeOff, FileKey2, Folder, Lock, Pencil, Plus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import * as React from "react";

import { ColorDot } from "@/components/label-editor";
import { EditorHandle, KvKeyValueEditor } from "@/components/kv/kv-fields";
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

function shallowEqual(
  a: Record<string, unknown> | undefined,
  b: Record<string, unknown>,
): boolean {
  if (a === b) return true;
  if (!a) return false;
  const ak = Object.keys(a);
  return ak.length === Object.keys(b).length && ak.every((k) => a[k] === b[k]);
}

/**
 * Collects one value per environment into a map. The per-env reporter children
 * (EnvLister/EnvReader) push their latest state through `report`; no-op updates
 * are dropped (shallow compare) so reporting doesn't churn renders. TanStack's
 * structural sharing keeps `data`/`keys` refs stable, so identity holds.
 */
function useEnvResults<T>() {
  const [results, setResults] = React.useState<Record<string, T>>({});
  const report = React.useCallback((mount: string, value: T) => {
    setResults((prev) =>
      shallowEqual(
        prev[mount] as Record<string, unknown> | undefined,
        value as Record<string, unknown>,
      )
        ? prev
        : { ...prev, [mount]: value },
    );
  }, []);
  return [results, report] as const;
}

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
  const [results, onResult] = useEnvResults<ListResult>();
  const [limit, setLimit] = React.useState(PAGE);

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
      {open ? <SecretMatrix envs={envs} path={path} show={show} /> : null}
    </>
  );
}

const display = (v: unknown) => (typeof v === "string" ? v : JSON.stringify(v));

// One value, masked by default with its own reveal toggle. The page-level
// "Show values" sets the baseline; the eye flips an individual value.
function ValueCell({
  value,
  has,
  defaultShown,
}: {
  value: string | null;
  has: boolean;
  defaultShown: boolean;
}) {
  const [shown, setShown] = React.useState(defaultShown);
  // follow the page-level toggle when it changes
  React.useEffect(() => setShown(defaultShown), [defaultShown]);
  if (!has) return <span className="text-muted-foreground/40">—</span>;
  return (
    <span className="inline-flex items-start gap-1.5">
      <span className="break-all">{shown ? value : "••••••••"}</span>
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        title={shown ? "Hide value" : "Reveal value"}
        className="mt-0.5 shrink-0 rounded p-0.5 text-muted-foreground/50 hover:bg-accent hover:text-foreground"
      >
        {shown ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
      </button>
    </span>
  );
}

type Cell = {
  loading: boolean;
  forbidden: boolean;
  missing: boolean; // a real 404 → safe to offer "create"
  errored: boolean; // any other read failure → never mislabel as missing
  data: Record<string, unknown> | null;
  version?: number;
};

/**
 * Expanded secret: a field × environment matrix — one row per key, one column
 * per environment, values side-by-side (like Compare). Each column has an
 * edit/create action that opens the full key/value editor beneath the table.
 */
function SecretMatrix({
  envs,
  path,
  show,
}: {
  envs: StructEnv[];
  path: string;
  show: boolean;
}) {
  const qc = useQueryClient();
  const [cells, onCell] = useEnvResults<Cell>();
  const [editing, setEditing] = React.useState<string | null>(null);

  // union of field keys across every environment that has the secret
  const keys = React.useMemo(() => {
    const set = new Set<string>();
    for (const e of envs) {
      const d = cells[e.mount]?.data;
      if (d) for (const k of Object.keys(d)) set.add(k);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [envs, cells]);

  const anyLoading = envs.some((e) => !cells[e.mount] || cells[e.mount].loading);
  const anyData = envs.some((e) => cells[e.mount]?.data);
  const editEnv = editing ? envs.find((e) => e.mount === editing) : null;
  const editCell = editing ? cells[editing] : undefined;

  return (
    <div className="border-b bg-muted/20 px-3 py-3">
      {/* hidden per-env readers (one useKvSecret each) */}
      {envs.map((e) => (
        <EnvReader key={e.mount} mount={e.mount} path={path} onResult={onCell} />
      ))}

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs">
            <tr>
              <th className="px-3 py-2 align-bottom font-medium text-muted-foreground">
                Field
              </th>
              {envs.map((e) => (
                <th key={e.mount} className="px-3 py-2 align-bottom font-medium">
                  <div className="flex items-center gap-1.5">
                    <ColorDot color={e.color} className="size-2 shrink-0" />
                    <span className="truncate" title={e.mount}>{e.name}</span>
                  </div>
                  <div className="mt-1">
                    <EnvAction
                      cell={cells[e.mount]}
                      onEdit={() => setEditing(e.mount)}
                      onRetry={() => qc.invalidateQueries({ queryKey: ["kv-secret"] })}
                    />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {keys.length === 0 ? (
              <tr>
                <td
                  colSpan={envs.length + 1}
                  className="px-3 py-4 text-center text-xs text-muted-foreground"
                >
                  {anyLoading
                    ? "Loading…"
                    : anyData
                      ? "This secret has no fields."
                      : "Not set in any selected environment — use a column's Create."}
                </td>
              </tr>
            ) : (
              keys.map((k) => {
                const cols = envs.map((e) => {
                  const c = cells[e.mount];
                  const has = !!c?.data && k in c.data!;
                  return { e, c, has, v: has ? display(c!.data![k]) : null };
                });
                // highlight a key whose value isn't identical across the envs
                // that actually have the secret (different, or absent in some)
                const haveSecret = cols.filter((x) => x.c?.data);
                const distinct = new Set(haveSecret.filter((x) => x.has).map((x) => x.v));
                const differs =
                  haveSecret.length > 1 &&
                  (distinct.size > 1 || haveSecret.some((x) => !x.has));
                return (
                  <tr key={k}>
                    <td className="px-3 py-2 align-top font-mono font-medium">
                      {k}
                      {differs ? (
                        <span className="ml-2 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-normal text-amber-600">
                          differs
                        </span>
                      ) : null}
                    </td>
                    {cols.map(({ e, has, v }) => (
                      <td
                        key={e.mount}
                        className="px-3 py-2 align-top font-mono text-muted-foreground"
                      >
                        <ValueCell value={v} has={has} defaultShown={show} />
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {editEnv ? (
        <EnvEditor
          key={editEnv.mount}
          env={editEnv}
          path={path}
          initial={editCell?.data ?? {}}
          present={!!editCell?.data}
          version={editCell?.version}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}

// Reads ONE env's secret and reports its state up (one useKvSecret per instance).
function EnvReader({
  mount,
  path,
  onResult,
}: {
  mount: string;
  path: string;
  onResult: (mount: string, c: Cell) => void;
}) {
  const secret = useKvSecret(mount, path);
  const status = secret.error instanceof BaoError ? secret.error.status : undefined;
  const forbidden = status === 403;
  const missing = secret.isError && status === 404;
  const errored = secret.isError && !forbidden && !missing;
  const data = (secret.data?.data as Record<string, unknown> | null) ?? null;
  const version = secret.data?.metadata?.version;
  React.useEffect(() => {
    onResult(mount, { loading: secret.isLoading, forbidden, missing, errored, data, version });
  }, [mount, secret.isLoading, forbidden, missing, errored, data, version, onResult]);
  return null;
}

// Per-column action shown under each environment header.
function EnvAction({
  cell,
  onEdit,
  onRetry,
}: {
  cell?: Cell;
  onEdit: () => void;
  onRetry: () => void;
}) {
  if (!cell || cell.loading) {
    return <span className="text-[10px] font-normal text-muted-foreground">loading…</span>;
  }
  if (cell.forbidden) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-normal text-muted-foreground">
        <Lock className="size-3" /> no access
      </span>
    );
  }
  if (cell.errored) {
    return (
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-1 text-[10px] font-normal text-destructive hover:underline"
      >
        error · retry
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onEdit}
      className="inline-flex items-center gap-1 text-[10px] font-normal text-primary hover:underline"
    >
      {cell.data ? (
        <><Pencil className="size-3" /> edit</>
      ) : (
        <><Plus className="size-3" /> create</>
      )}
    </button>
  );
}

// Full key/value editor for one environment, shown beneath the matrix.
function EnvEditor({
  env,
  path,
  initial,
  present,
  version,
  onClose,
}: {
  env: StructEnv;
  path: string;
  initial: Record<string, unknown>;
  present: boolean;
  version?: number;
  onClose: () => void;
}) {
  const write = useKvWrite(env.mount, path);
  const [error, setError] = React.useState<string | null>(null);
  const editorRef = React.useRef<EditorHandle>(null);

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
      onClose();
    } catch (e) {
      setError(errMsg(e));
    }
  }

  return (
    <div className="mt-3 rounded-lg border bg-card p-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium">
        <ColorDot color={env.color} className="size-2.5 shrink-0" />
        {present ? "Edit in" : "Create in"} {env.name}
        <span className="font-mono text-xs font-normal text-muted-foreground">{path}</span>
      </div>
      {error ? <p className="mb-2 text-xs text-destructive">{error}</p> : null}
      <KvKeyValueEditor ref={editorRef} initial={initial} />
      <div className="mt-3 flex gap-2">
        <Button size="sm" onClick={save} disabled={write.isPending}>
          {write.isPending ? "Saving…" : present ? "Save new version" : "Create"}
        </Button>
        <Button size="sm" variant="outline" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
