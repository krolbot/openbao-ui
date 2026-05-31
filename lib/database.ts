"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { baoFetch } from "@/lib/bao-client";
import { useNamespace } from "@/lib/namespace";

const m = (s: string) => s.replace(/\/$/, "");

export function useDbConnections(mount: string) {
  const { namespace } = useNamespace();
  return useQuery({
    queryKey: ["db-connections", namespace, m(mount)],
    queryFn: async () => {
      try {
        const res = await baoFetch<{ data: { keys: string[] } }>({
          path: `${m(mount)}/config`,
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

export function useCreateDbConnection(mount: string) {
  const qc = useQueryClient();
  const { namespace } = useNamespace();
  return useMutation({
    meta: { success: "Connection saved", silentError: true },
    mutationFn: async (vars: {
      name: string;
      plugin_name: string;
      connection_url: string;
      username?: string;
      password?: string;
      allowed_roles?: string[];
    }) =>
      baoFetch({
        path: `${m(mount)}/config/${vars.name}`,
        method: "POST",
        namespace,
        body: {
          plugin_name: vars.plugin_name,
          connection_url: vars.connection_url,
          username: vars.username || undefined,
          password: vars.password || undefined,
          allowed_roles: vars.allowed_roles ?? ["*"],
        },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["db-connections", namespace, m(mount)] }),
  });
}

export function useDbRoles(mount: string) {
  const { namespace } = useNamespace();
  return useQuery({
    queryKey: ["db-roles", namespace, m(mount)],
    queryFn: async () => {
      try {
        const res = await baoFetch<{ data: { keys: string[] } }>({
          path: `${m(mount)}/roles`,
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

export function useCreateDbRole(mount: string) {
  const qc = useQueryClient();
  const { namespace } = useNamespace();
  return useMutation({
    meta: { success: "Role saved", silentError: true },
    mutationFn: async (vars: {
      name: string;
      db_name: string;
      creation_statements: string;
      default_ttl?: string;
      max_ttl?: string;
    }) =>
      baoFetch({
        path: `${m(mount)}/roles/${vars.name}`,
        method: "POST",
        namespace,
        body: {
          db_name: vars.db_name,
          creation_statements: vars.creation_statements
            ? [vars.creation_statements]
            : [],
          default_ttl: vars.default_ttl || undefined,
          max_ttl: vars.max_ttl || undefined,
        },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["db-roles", namespace, m(mount)] }),
  });
}

export function useDeleteDbRole(mount: string) {
  const qc = useQueryClient();
  const { namespace } = useNamespace();
  return useMutation({
    meta: { success: "Role deleted" },
    mutationFn: async (name: string) =>
      baoFetch({ path: `${m(mount)}/roles/${name}`, method: "DELETE", namespace }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["db-roles", namespace, m(mount)] }),
  });
}

export type DbCreds = { username: string; password: string };

export function useGenerateDbCreds(mount: string) {
  const { namespace } = useNamespace();
  return useMutation({
    mutationFn: async (role: string) => {
      const res = await baoFetch<{ data: DbCreds }>({
        path: `${m(mount)}/creds/${role}`,
        namespace,
      });
      return res.data;
    },
  });
}
