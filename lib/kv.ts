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

/** Namespaces (best-effort; empty if not permitted or unsupported). */
export function useNamespaces() {
  const { namespace } = useNamespace();
  return useQuery({
    queryKey: ["namespaces", namespace],
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
  const m = stripSlash(mount);
  const p = stripSlash(path);
  return useQuery({
    queryKey: ["kv-list", namespace, m, p],
    queryFn: async () => {
      const res = await baoFetch<{ data: { keys: string[] } }>({
        path: `${m}/metadata/${p}`,
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
  const m = stripSlash(mount);
  const p = stripSlash(path);
  return useQuery({
    queryKey: ["kv-secret", namespace, m, p, version ?? "latest"],
    enabled: !!p,
    queryFn: async () => {
      const res = await baoFetch<{ data: KvSecret }>({
        path: `${m}/data/${p}`,
        namespace,
        query: version ? { version } : undefined,
      });
      return res.data;
    },
  });
}

/** Version history + metadata for a secret. */
export function useKvMetadata(mount: string, path: string) {
  const { namespace } = useNamespace();
  const m = stripSlash(mount);
  const p = stripSlash(path);
  return useQuery({
    queryKey: ["kv-metadata", namespace, m, p],
    enabled: !!p,
    queryFn: async () => {
      const res = await baoFetch<{ data: KvMetadata }>({
        path: `${m}/metadata/${p}`,
        namespace,
      });
      return res.data;
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
  const invalidate = useInvalidateSecret(mount, path);
  const m = stripSlash(mount);
  const p = stripSlash(path);
  return useMutation({
    meta: { success: "Secret saved", silentError: true },
    mutationFn: async (vars: {
      data: Record<string, unknown>;
      cas?: number;
    }) => {
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
  const invalidate = useInvalidateSecret(mount, path);
  const m = stripSlash(mount);
  const p = stripSlash(path);
  return useMutation({
    meta: { success: "Secret deleted" },
    mutationFn: async () =>
      baoFetch({
        path: `${m}/metadata/${p}`,
        method: "DELETE",
        namespace,
      }),
    onSuccess: invalidate,
  });
}
