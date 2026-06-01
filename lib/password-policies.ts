"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { baoFetch } from "@/lib/bao-client";
import { useNamespace } from "@/lib/namespace";

export function usePasswordPolicies() {
  const { namespace } = useNamespace();
  return useQuery({
    queryKey: ["password-policies", namespace],
    queryFn: async () => {
      try {
        const res = await baoFetch<{ data: { keys: string[] } }>({
          path: "sys/policies/password",
          namespace,
          list: true,
        });
        return (res.data?.keys ?? []).sort();
      } catch {
        return [] as string[];
      }
    },
  });
}

export function usePasswordPolicy(name: string | null) {
  const { namespace } = useNamespace();
  return useQuery({
    queryKey: ["password-policy", namespace, name],
    enabled: !!name,
    queryFn: async () => {
      const res = await baoFetch<{ data: { policy: string } }>({
        path: `sys/policies/password/${name}`,
        namespace,
      });
      return res.data.policy ?? "";
    },
  });
}

export function useWritePasswordPolicy() {
  const qc = useQueryClient();
  const { namespace } = useNamespace();
  return useMutation({
    meta: { success: "Policy saved", silentError: true },
    mutationFn: async (vars: { name: string; policy: string }) =>
      baoFetch({
        path: `sys/policies/password/${vars.name}`,
        method: "POST",
        namespace,
        body: { policy: vars.policy },
      }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["password-policies", namespace] });
      qc.invalidateQueries({ queryKey: ["password-policy", namespace, vars.name] });
    },
  });
}

export function useDeletePasswordPolicy() {
  const qc = useQueryClient();
  const { namespace } = useNamespace();
  return useMutation({
    meta: { success: "Policy deleted" },
    mutationFn: async (name: string) =>
      baoFetch({ path: `sys/policies/password/${name}`, method: "DELETE", namespace }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["password-policies", namespace] }),
  });
}

export function useGeneratePassword() {
  const { namespace } = useNamespace();
  return useMutation({
    mutationFn: async (name: string) => {
      const res = await baoFetch<{ data: { password: string } }>({
        path: `sys/policies/password/${name}/generate`,
        namespace,
      });
      return res.data.password;
    },
  });
}
