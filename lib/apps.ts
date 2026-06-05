"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";

import { baoFetch } from "@/lib/bao-client";
import { useMounts } from "@/lib/kv";
import { labelKey, useLabels, useSetLabel, type Label } from "@/lib/labels";
import { useNamespace } from "@/lib/namespace";

export type AppInfo = {
  app: string; // folder name, e.g. "payments"
  label?: Label; // application-scope label (friendly name / color / owner)
  envs: string[]; // KV mounts the app folder exists in
  groups: string[]; // env groups those mounts belong to
};

type KvMount = { mount: string; v2: boolean };

function kvMountsOf(mounts: Record<string, { type: string; options?: Record<string, string> | null }> | undefined): KvMount[] {
  return Object.entries(mounts ?? {})
    .filter(([, v]) => v.type === "kv" || v.type === "generic")
    .map(([p, v]) => ({ mount: p.replace(/\/$/, ""), v2: v.options?.version === "2" }));
}

/**
 * Apps are top-level folders inside KV environments. This discovers them across
 * every KV mount and merges any `application`-scope labels (friendly name,
 * color, owner) — including label-only apps that have no secrets yet.
 */
export function useApps() {
  const { namespace } = useNamespace();
  const { data: mounts } = useMounts();
  const { data: labels } = useLabels();
  const kvMounts = kvMountsOf(mounts);

  const discovery = useQuery({
    queryKey: ["app-folders", namespace, kvMounts.map((m) => m.mount).join(",")],
    enabled: !!mounts,
    queryFn: async (): Promise<Record<string, string[]>> => {
      const byApp: Record<string, string[]> = {};
      await Promise.all(
        kvMounts.map(async ({ mount, v2 }) => {
          try {
            const res = await baoFetch<{ data: { keys: string[] } }>({
              path: v2 ? `${mount}/metadata` : `${mount}`,
              namespace,
              list: true,
            });
            for (const k of res.data?.keys ?? []) {
              if (k.endsWith("/")) (byApp[k.replace(/\/$/, "")] ??= []).push(mount);
            }
          } catch {
            // unlistable / empty mount — skip
          }
        }),
      );
      return byApp;
    },
  });

  const apps = React.useMemo<AppInfo[]>(() => {
    const byApp = discovery.data ?? {};
    const groupOf = (m: string) => labels?.[labelKey("environment", `${m}/`)]?.env_group ?? null;
    const map = new Map<string, AppInfo>();
    for (const [app, envs] of Object.entries(byApp)) {
      map.set(app, {
        app,
        label: labels?.[labelKey("application", app)],
        envs: envs.slice().sort(),
        groups: Array.from(new Set(envs.map(groupOf).filter(Boolean) as string[])).sort(),
      });
    }
    for (const l of Object.values(labels ?? {})) {
      if (l.scope === "application" && !map.has(l.ref)) {
        map.set(l.ref, { app: l.ref, label: l, envs: [], groups: [] });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.app.localeCompare(b.app));
  }, [discovery.data, labels]);

  return { apps, isLoading: discovery.isLoading, kvMounts };
}

/** Register an app: write its application label and (optionally) seed an empty
 *  `<app>/config` secret in the chosen environments so the folder exists. */
export function useCreateApp() {
  const qc = useQueryClient();
  const { namespace } = useNamespace();
  const setLabel = useSetLabel();
  return useMutation({
    meta: { success: "App created", silentError: true },
    mutationFn: async (vars: {
      app: string;
      label?: string;
      color?: string;
      description?: string;
      envs?: KvMount[];
    }) => {
      for (const e of vars.envs ?? []) {
        await baoFetch({
          path: e.v2 ? `${e.mount}/data/${vars.app}/config` : `${e.mount}/${vars.app}/config`,
          method: "POST",
          namespace,
          body: e.v2 ? { data: {} } : {},
        }).catch(() => {});
      }
      await setLabel.mutateAsync({
        scope: "application",
        ref: vars.app,
        label: vars.label,
        color: vars.color,
        description: vars.description,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["app-folders", namespace] });
    },
  });
}
