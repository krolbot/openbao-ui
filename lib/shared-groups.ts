"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { SHARED_PREFIX } from "@/lib/access-policy";
import { baoFetch } from "@/lib/bao-client";
import { useMounts } from "@/lib/kv";
import { useNamespace } from "@/lib/namespace";

export type SharedGroup = {
  name: string; // e.g. "stripe"
  envs: string[]; // KV mounts where _shared/<name> exists
};

type KvMount = { mount: string; v2: boolean };

function kvMountsOf(mounts: Record<string, { type: string; options?: Record<string, string> | null }> | undefined): KvMount[] {
  return Object.entries(mounts ?? {})
    .filter(([, v]) => v.type === "kv" || v.type === "generic")
    .map(([p, v]) => ({ mount: p.replace(/\/$/, ""), v2: v.options?.version === "2" }));
}

const sharedPath = (m: KvMount, name: string, sub = "config") =>
  m.v2
    ? `${m.mount}/data/${SHARED_PREFIX}/${name}/${sub}`
    : `${m.mount}/${SHARED_PREFIX}/${name}/${sub}`;

/**
 * Shared key bundles — named sets of key/values (e.g. "stripe") that live at
 * `<env>/_shared/<name>/` and can be granted (read-only) into multiple apps so
 * the values are defined once. Discovered as folders under `_shared/` across
 * every KV mount.
 */
export function useSharedGroups() {
  const { namespace } = useNamespace();
  const { data: mounts } = useMounts();
  const kvMounts = kvMountsOf(mounts);
  return useQuery({
    queryKey: ["shared-groups", namespace, kvMounts.map((m) => m.mount).join(",")],
    enabled: !!mounts,
    queryFn: async (): Promise<SharedGroup[]> => {
      const byName: Record<string, string[]> = {};
      await Promise.all(
        kvMounts.map(async ({ mount, v2 }) => {
          try {
            const res = await baoFetch<{ data: { keys: string[] } }>({
              path: v2 ? `${mount}/metadata/${SHARED_PREFIX}` : `${mount}/${SHARED_PREFIX}`,
              namespace,
              list: true,
            });
            for (const k of res.data?.keys ?? []) {
              if (k.endsWith("/")) (byName[k.replace(/\/$/, "")] ??= []).push(mount);
            }
          } catch {
            // mount has no _shared/ yet
          }
        }),
      );
      return Object.entries(byName)
        .map(([name, envs]) => ({ name, envs: envs.sort() }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
  });
}

/** Read a shared bundle's current key/values from one environment (for editing). */
export function useSharedGroupValues(name: string, mount: string, enabled = true) {
  const { namespace } = useNamespace();
  const { data: mounts } = useMounts();
  const km = kvMountsOf(mounts).find((m) => m.mount === mount);
  return useQuery({
    queryKey: ["shared-group-values", namespace, name, mount],
    enabled: enabled && !!name && !!km,
    queryFn: async (): Promise<Record<string, string>> => {
      if (!km) return {};
      const res = await baoFetch<{ data: { data?: Record<string, string> } | Record<string, string> }>({
        path: sharedPath(km, name),
        namespace,
      });
      const d = res.data as { data?: Record<string, string> } & Record<string, string>;
      return (km.v2 ? d.data : d) ?? {};
    },
  });
}

/** Create/update a shared bundle: write `<env>/_shared/<name>/config` with the
 *  given key/values into each chosen environment. */
export function useSaveSharedGroup() {
  const qc = useQueryClient();
  const { namespace } = useNamespace();
  const { data: mounts } = useMounts();
  const all = kvMountsOf(mounts);
  return useMutation({
    meta: { success: "Shared keys saved", silentError: true },
    mutationFn: async (vars: { name: string; data: Record<string, string>; envs: string[] }) => {
      for (const mount of vars.envs) {
        const km = all.find((m) => m.mount === mount);
        if (!km) continue;
        await baoFetch({
          path: sharedPath(km, vars.name),
          method: "POST",
          namespace,
          body: km.v2 ? { data: vars.data } : vars.data,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shared-groups", namespace] });
      qc.invalidateQueries({ queryKey: ["shared-group-values", namespace] });
    },
  });
}
