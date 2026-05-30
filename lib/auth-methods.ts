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
    meta: { success: "Auth method enabled", silentError: true },
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
    meta: { success: "Auth method disabled" },
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
    meta: { success: "User added", silentError: true },
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
    meta: { success: "User deleted" },
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
    meta: { success: "Role added", silentError: true },
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
    meta: { success: "Role deleted" },
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

// ---------------------------------------------------------------------------
// Tune (applies to every auth mount): description + lease TTLs
// ---------------------------------------------------------------------------

export type AuthTune = {
  description?: string;
  default_lease_ttl: number;
  max_lease_ttl: number;
  token_type?: string;
};

export function useAuthTune(path: string) {
  const { namespace } = useNamespace();
  return useQuery({
    queryKey: ["auth-tune", namespace, m(path)],
    queryFn: async () => {
      const res = await baoFetch<{ data: AuthTune }>({
        path: `sys/auth/${m(path)}/tune`,
        namespace,
      });
      return res.data;
    },
  });
}

export function useSetAuthTune(path: string) {
  const qc = useQueryClient();
  const { namespace } = useNamespace();
  return useMutation({
    meta: { success: "Tune saved", silentError: true },
    mutationFn: async (vars: {
      description?: string;
      default_lease_ttl?: string;
      max_lease_ttl?: string;
    }) =>
      baoFetch({
        path: `sys/auth/${m(path)}/tune`,
        method: "POST",
        namespace,
        body: vars,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["auth-tune", namespace, m(path)] });
      qc.invalidateQueries({ queryKey: ["auth-methods", namespace] });
    },
  });
}

// ---------------------------------------------------------------------------
// LDAP connection config (a common method)
// ---------------------------------------------------------------------------

export type LdapConfig = {
  url?: string;
  binddn?: string;
  userdn?: string;
  groupdn?: string;
  userattr?: string;
  groupattr?: string;
  insecure_tls?: boolean;
};

export function useLdapConfig(mount: string) {
  const { namespace } = useNamespace();
  return useQuery({
    queryKey: ["ldap-config", namespace, m(mount)],
    queryFn: async (): Promise<LdapConfig | null> => {
      try {
        const res = await baoFetch<{ data: LdapConfig }>({
          path: `auth/${m(mount)}/config`,
          namespace,
        });
        return res.data;
      } catch {
        return null; // not configured yet
      }
    },
  });
}

export function useSetLdapConfig(mount: string) {
  const qc = useQueryClient();
  const { namespace } = useNamespace();
  return useMutation({
    meta: { success: "Connection saved", silentError: true },
    mutationFn: async (cfg: LdapConfig & { bindpass?: string }) =>
      baoFetch({
        path: `auth/${m(mount)}/config`,
        method: "POST",
        namespace,
        body: cfg,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ldap-config", namespace, m(mount)] }),
  });
}
