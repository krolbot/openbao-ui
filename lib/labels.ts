"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useNamespace } from "@/lib/namespace";

// Client-side access to the BFF "nicer naming" label store (/ui/api/labels).
// workspace = namespace, environment = mount, application = path. Labels are
// presentation-only; the underlying OpenBao paths are never renamed.

export type LabelScope = "workspace" | "environment" | "application";

export type Label = {
  namespace: string;
  scope: LabelScope;
  ref: string;
  label: string | null;
  description: string | null;
  color: string | null;
  env_group: string | null;
  updated_at: number;
};

export type LabelMap = Record<string, Label>; // key = `${scope}:${ref}`

export const labelKey = (scope: LabelScope, ref: string) => `${scope}:${ref}`;

/** Pick a label out of a map, falling back to the native name. */
export function nameFor(
  labels: LabelMap | undefined,
  scope: LabelScope,
  ref: string,
  fallback: string,
): string {
  return labels?.[labelKey(scope, ref)]?.label || fallback;
}

/**
 * Labels for a namespace. Defaults to the current namespace; pass "" to read
 * the root-scoped workspace labels (namespaces are labeled globally there).
 */
export function useLabels(ns?: string) {
  const { namespace } = useNamespace();
  const target = ns ?? namespace;
  return useQuery({
    queryKey: ["ui-labels", target],
    queryFn: async (): Promise<LabelMap> => {
      const res = await fetch(
        `/ui/api/labels?namespace=${encodeURIComponent(target)}`,
        { headers: { "x-vault-namespace": target } },
      );
      if (!res.ok) return {};
      const data = (await res.json()) as { labels?: Label[] };
      const map: LabelMap = {};
      for (const l of data.labels ?? []) map[labelKey(l.scope, l.ref)] = l;
      return map;
    },
    staleTime: 30_000,
  });
}

export type SetLabelInput = {
  scope: LabelScope;
  ref: string;
  label?: string;
  description?: string;
  color?: string;
  env_group?: string;
};

export function useSetLabel(ns?: string) {
  const qc = useQueryClient();
  const { namespace } = useNamespace();
  const target = ns ?? namespace;
  return useMutation({
    meta: { success: "Saved" },
    mutationFn: async (input: SetLabelInput) => {
      const res = await fetch(`/ui/api/labels`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-vault-namespace": target,
        },
        body: JSON.stringify({ namespace: target, ...input }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          errors?: string[];
        };
        throw new Error(data.errors?.[0] ?? `Request failed (${res.status})`);
      }
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ui-labels", target] }),
  });
}
