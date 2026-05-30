"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { baoFetch } from "@/lib/bao-client";
import { useNamespace } from "@/lib/namespace";

export type AuthMount = {
  path: string; // e.g. "userpass/"
  type: string;
  description?: string;
  accessor?: string;
};

// ---------------------------------------------------------------------------
// Auth method mounts (sys/auth)
// ---------------------------------------------------------------------------

export function useAuthMethods() {
  const { namespace } = useNamespace();
  return useQuery({
    queryKey: ["auth-methods", namespace],
    queryFn: async (): Promise<AuthMount[]> => {
      const res = await baoFetch<{
        data: Record<string, { type: string; description?: string; accessor?: string }>;
      }>({ path: "sys/auth", namespace });
      return Object.entries(res.data)
        .filter(([, v]) => v && typeof v === "object" && "type" in v)
        .map(([path, v]) => ({ path, type: v.type, description: v.description, accessor: v.accessor }));
    },
  });
}

export function useEnableAuth() {
  const qc = useQueryClient();
  const { namespace } = useNamespace();
  return useMutation({
    mutationFn: async (vars: { path: string; type: string; description?: string }) =>
      baoFetch({
        path: `sys/auth/${vars.path.replace(/\/$/, "")}`,
        method: "POST",
        namespace,
        body: { type: vars.type, description: vars.description },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["auth-methods", namespace] }),
  });
}

export function useDisableAuth() {
  const qc = useQueryClient();
  const { namespace } = useNamespace();
  return useMutation({
    mutationFn: async (path: string) =>
      baoFetch({
        path: `sys/auth/${path.replace(/\/$/, "")}`,
        method: "DELETE",
        namespace,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["auth-methods", namespace] }),
  });
}

// ---------------------------------------------------------------------------
// userpass: users
// ---------------------------------------------------------------------------

const m = (s: string) => s.replace(/\/$/, "");

export function useUserpassUsers(mount: string) {
  const { namespace } = useNamespace();
  return useQuery({
    queryKey: ["userpass-users", namespace, m(mount)],
    queryFn: async () => {
      try {
        const res = await baoFetch<{ data: { keys: string[] } }>({
          path: `auth/${m(mount)}/users`,
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

export function useCreateUserpassUser(mount: string) {
  const qc = useQueryClient();
  const { namespace } = useNamespace();
  return useMutation({
    mutationFn: async (vars: { username: string; password: string; policies?: string[] }) =>
      baoFetch({
        path: `auth/${m(mount)}/users/${vars.username}`,
        method: "POST",
        namespace,
        body: { password: vars.password, token_policies: vars.policies ?? [] },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["userpass-users", namespace, m(mount)] }),
  });
}

export function useDeleteUserpassUser(mount: string) {
  const qc = useQueryClient();
  const { namespace } = useNamespace();
  return useMutation({
    mutationFn: async (username: string) =>
      baoFetch({ path: `auth/${m(mount)}/users/${username}`, method: "DELETE", namespace }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["userpass-users", namespace, m(mount)] }),
  });
}

// ---------------------------------------------------------------------------
// approle: roles + role-id / secret-id
// ---------------------------------------------------------------------------

export function useApproleRoles(mount: string) {
  const { namespace } = useNamespace();
  return useQuery({
    queryKey: ["approle-roles", namespace, m(mount)],
    queryFn: async () => {
      try {
        const res = await baoFetch<{ data: { keys: string[] } }>({
          path: `auth/${m(mount)}/role`,
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

export function useCreateApproleRole(mount: string) {
  const qc = useQueryClient();
  const { namespace } = useNamespace();
  return useMutation({
    mutationFn: async (vars: { name: string; policies?: string[]; ttl?: string }) =>
      baoFetch({
        path: `auth/${m(mount)}/role/${vars.name}`,
        method: "POST",
        namespace,
        body: { token_policies: vars.policies ?? [], token_ttl: vars.ttl || undefined },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["approle-roles", namespace, m(mount)] }),
  });
}

export function useDeleteApproleRole(mount: string) {
  const qc = useQueryClient();
  const { namespace } = useNamespace();
  return useMutation({
    mutationFn: async (name: string) =>
      baoFetch({ path: `auth/${m(mount)}/role/${name}`, method: "DELETE", namespace }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["approle-roles", namespace, m(mount)] }),
  });
}

export function useApproleRoleId() {
  const { namespace } = useNamespace();
  return useMutation({
    mutationFn: async (vars: { mount: string; role: string }) => {
      const res = await baoFetch<{ data: { role_id: string } }>({
        path: `auth/${m(vars.mount)}/role/${vars.role}/role-id`,
        namespace,
      });
      return res.data.role_id;
    },
  });
}

export function useGenerateSecretId() {
  const { namespace } = useNamespace();
  return useMutation({
    mutationFn: async (vars: { mount: string; role: string }) => {
      const res = await baoFetch<{ data: { secret_id: string } }>({
        path: `auth/${m(vars.mount)}/role/${vars.role}/secret-id`,
        method: "POST",
        namespace,
        body: {},
      });
      return res.data.secret_id;
    },
  });
}
