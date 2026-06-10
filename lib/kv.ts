"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { baoFetch } from "@/lib/bao-client";
import { useNamespace } from "@/lib/namespace";

// --- response shapes (subset we use) ---

export type UiMount = {
  type: string;
  description?: string;
  accessor?: string;
  options?: Record<string, string> | null;
};

export type KvVersionMeta = {
  created_time: string;
  deletion_time: string;
  destroyed: boolean;
};

export type KvMetadata = {
  current_version: number;
  oldest_version: number;
  max_versions: number;
  cas_required: boolean;
  custom_metadata: Record<string, string> | null;
  created_time: string;
  updated_time: string;
  versions: Record<string, KvVersionMeta>;
};

export type KvSecret = {
  data: Record<string, unknown> | null;
  metadata: {
    version: number;
    created_time: string;
    deletion_time: string;
    destroyed: boolean;
    custom_metadata: Record<string, string> | null;
  };
};

const stripSlash = (s: string) => s.replace(/^\/+|\/+$/g, "");

/**
 * KV v2 vs v1. v2 mounts advertise `options.version === "2"` and expose the
 * `/data` + `/metadata` sub-paths; v1 and `generic` mounts read/write/list at
 * the mount path directly and have no versioning. Returns `undefined` until the
 * mount list has loaded (so callers can avoid firing a wrong-shaped request).
 */
export function useKvIsV2(mount: string): boolean | undefined {
  const { data } = useMounts();
  if (!data) return undefined;
  const info = data[`${stripSlash(mount)}/`];
  return info?.options?.version === "2";
}

// --- queries ---

/** Secret engine mounts visible to the current token (capability-aware). */
export function useMounts() {
  const { namespace } = useNamespace();
  return useQuery({
    queryKey: ["mounts", namespace],
    queryFn: async () => {
      const res = await baoFetch<{ data: { secret: Record<string, UiMount> } }>(
        { path: "sys/internal/ui/mounts", namespace },
      );
      return res.data.secret ?? {};
    },
  });
}

/**
 * Enable a KV secrets engine — i.e. create an "environment". Defaults to v2.
 * The BFF operator gate rejects this for non-operators; OpenBao enforces the
 * real `sys/mounts/<path>` capability regardless.
 */
export function useEnableSecretEngine() {
  const qc = useQueryClient();
  const { namespace } = useNamespace();
  return useMutation({
    meta: { success: "Environment created", silentError: true },
    mutationFn: async (vars: { path: string; description?: string; version?: "1" | "2" }) =>
      baoFetch({
        path: `sys/mounts/${stripSlash(vars.path)}`,
        method: "POST",
        namespace,
        body: {
          type: "kv",
          description: vars.description || undefined,
          options: { version: vars.version ?? "2" },
        },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mounts", namespace] }),
  });
}

/**
 * Disable a secrets engine — destroys the mount and ALL secrets in it. The
 * caller is responsible for confirming intent (typed-confirm) before invoking.
 */
export function useDisableSecretEngine() {
  const qc = useQueryClient();
  const { namespace } = useNamespace();
  return useMutation({
    meta: { success: "Environment disabled", silentError: true },
    mutationFn: async (path: string) =>
      baoFetch({
        path: `sys/mounts/${stripSlash(path)}`,
        method: "DELETE",
        namespace,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mounts", namespace] }),
  });
}

/** Namespaces (best-effort; empty if not permitted or unsupported).
 *  Namespaces are an Enterprise feature — open-source OpenBao returns 404 here,
 *  which is expected. Cache the result and don't retry so we don't re-probe a
 *  known-unsupported endpoint on every navigation (avoidable console noise). */
export function useNamespaces() {
  const { namespace } = useNamespace();
  return useQuery({
    queryKey: ["namespaces", namespace],
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: async () => {
      try {
        const res = await baoFetch<{ data: { keys: string[] } }>({
          path: "sys/namespaces",
          namespace,
          list: true,
        });
        return res.data?.keys ?? [];
      } catch {
        return [] as string[];
      }
    },
  });
}

/** List keys (folders end with "/") at a path within a KV mount. */
export function useKvList(mount: string, path: string) {
  const { namespace } = useNamespace();
  const v2 = useKvIsV2(mount);
  const m = stripSlash(mount);
  const p = stripSlash(path);
  return useQuery({
    queryKey: ["kv-list", namespace, m, p, v2],
    enabled: v2 !== undefined,
    queryFn: async () => {
      const res = await baoFetch<{ data: { keys: string[] } }>({
        path: v2 ? `${m}/metadata/${p}` : `${m}/${p}`,
        namespace,
        list: true,
      });
      return res.data?.keys ?? [];
    },
  });
}

/** Read a secret (optionally a specific version). */
export function useKvSecret(mount: string, path: string, version?: number) {
  const { namespace } = useNamespace();
  const v2 = useKvIsV2(mount);
  const m = stripSlash(mount);
  const p = stripSlash(path);
  return useQuery({
    queryKey: ["kv-secret", namespace, m, p, version ?? "latest", v2],
    enabled: !!p && v2 !== undefined,
    queryFn: async () => {
      if (v2) {
        const res = await baoFetch<{ data: KvSecret }>({
          path: `${m}/data/${p}`,
          namespace,
          query: version ? { version } : undefined,
        });
        return res.data;
      }
      // v1: fields live directly under `data`; wrap to the v2-ish shape the UI uses
      const res = await baoFetch<{ data: Record<string, unknown> }>({
        path: `${m}/${p}`,
        namespace,
      });
      return {
        data: res.data ?? {},
        metadata: {
          version: 1,
          created_time: "",
          deletion_time: "",
          destroyed: false,
          custom_metadata: null,
        },
      } as KvSecret;
    },
  });
}

/** Version history + metadata for a secret. */
export function useKvMetadata(mount: string, path: string) {
  const { namespace } = useNamespace();
  const v2 = useKvIsV2(mount);
  const m = stripSlash(mount);
  const p = stripSlash(path);
  return useQuery({
    queryKey: ["kv-metadata", namespace, m, p, v2],
    enabled: !!p && v2 !== undefined,
    queryFn: async () => {
      if (v2) {
        const res = await baoFetch<{ data: KvMetadata }>({
          path: `${m}/metadata/${p}`,
          namespace,
        });
        return res.data;
      }
      // v1 has no versioning — synthesize single-version metadata so the
      // detail view renders (history/soft-delete are hidden for v1).
      return {
        current_version: 1,
        oldest_version: 1,
        max_versions: 0,
        cas_required: false,
        custom_metadata: null,
        created_time: "",
        updated_time: "",
        versions: {
          "1": { created_time: "", deletion_time: "", destroyed: false },
        },
      } as KvMetadata;
    },
  });
}

// --- mutations ---

function useInvalidateSecret(mount: string, path: string) {
  const qc = useQueryClient();
  const { namespace } = useNamespace();
  const m = stripSlash(mount);
  const p = stripSlash(path);
  return () => {
    qc.invalidateQueries({ queryKey: ["kv-secret", namespace, m, p] });
    qc.invalidateQueries({ queryKey: ["kv-metadata", namespace, m, p] });
    qc.invalidateQueries({ queryKey: ["kv-list", namespace, m] });
  };
}

/** Write a new version of a secret. Pass `cas` to guard against races. */
export function useKvWrite(mount: string, path: string) {
  const { namespace } = useNamespace();
  const v2 = useKvIsV2(mount);
  const invalidate = useInvalidateSecret(mount, path);
  const m = stripSlash(mount);
  const p = stripSlash(path);
  return useMutation({
    meta: { success: "Secret saved", silentError: true },
    mutationFn: async (vars: {
      data: Record<string, unknown>;
      cas?: number;
    }) => {
      if (v2 === false) {
        // v1: write the fields directly at the mount path (no versioning/cas)
        return baoFetch({ path: `${m}/${p}`, method: "POST", namespace, body: vars.data });
      }
      const body: Record<string, unknown> = { data: vars.data };
      if (vars.cas !== undefined) body.options = { cas: vars.cas };
      return baoFetch({
        path: `${m}/data/${p}`,
        method: "POST",
        namespace,
        body,
      });
    },
    onSuccess: invalidate,
  });
}

type VersionAction = "delete" | "undelete" | "destroy";

/** Soft-delete / undelete / permanently destroy specific versions. */
export function useKvVersionAction(
  mount: string,
  path: string,
  action: VersionAction,
) {
  const { namespace } = useNamespace();
  const invalidate = useInvalidateSecret(mount, path);
  const m = stripSlash(mount);
  const p = stripSlash(path);
  return useMutation({
    meta: {
      success:
        action === "delete"
          ? "Version soft-deleted"
          : action === "undelete"
            ? "Version restored"
            : "Version destroyed",
    },
    mutationFn: async (versions: number[]) =>
      baoFetch({
        path: `${m}/${action}/${p}`,
        method: "POST",
        namespace,
        body: { versions },
      }),
    onSuccess: invalidate,
  });
}

/** Permanently delete a secret and ALL its versions + metadata. */
export function useKvDeleteMetadata(mount: string, path: string) {
  const { namespace } = useNamespace();
  const v2 = useKvIsV2(mount);
  const invalidate = useInvalidateSecret(mount, path);
  const m = stripSlash(mount);
  const p = stripSlash(path);
  return useMutation({
    meta: { success: "Secret deleted" },
    mutationFn: async () =>
      baoFetch({
        // v2 removes all versions+metadata; v1 deletes the secret at its path
        path: v2 === false ? `${m}/${p}` : `${m}/metadata/${p}`,
        method: "DELETE",
        namespace,
      }),
    onSuccess: invalidate,
  });
}
