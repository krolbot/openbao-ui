"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useNamespace } from "@/lib/namespace";

// Client access to per-namespace onboarding progress (/ui/api/onboarding).
export type Onboarding = { dismissed?: boolean; steps?: Record<string, boolean> };

export function useOnboarding() {
  const { namespace } = useNamespace();
  return useQuery({
    queryKey: ["onboarding", namespace],
    queryFn: async (): Promise<Onboarding> => {
      const res = await fetch(
        `/ui/api/onboarding?namespace=${encodeURIComponent(namespace)}`,
        { headers: { "x-vault-namespace": namespace } },
      );
      if (!res.ok) return {};
      const data = (await res.json()) as { onboarding?: Onboarding };
      return data.onboarding ?? {};
    },
    staleTime: 30_000,
  });
}

export function useSetOnboarding() {
  const qc = useQueryClient();
  const { namespace } = useNamespace();
  return useMutation({
    mutationFn: async (patch: Onboarding) => {
      const res = await fetch(`/ui/api/onboarding`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-vault-namespace": namespace,
        },
        body: JSON.stringify({ namespace, ...patch }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { errors?: string[] };
        throw new Error(data.errors?.[0] ?? `Request failed (${res.status})`);
      }
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["onboarding", namespace] }),
  });
}
