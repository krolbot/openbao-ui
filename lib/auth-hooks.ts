"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { API_BASE } from "@/lib/base-path";

export type Session = {
  displayName: string;
  policies: string[];
  ttl: number;
  renewable: boolean;
};

export function useSession() {
  return useQuery({
    queryKey: ["session"],
    queryFn: async (): Promise<Session | null> => {
      const res = await fetch(`${API_BASE}/auth/session`);
      if (!res.ok) return null;
      return res.json();
    },
    // keep ttl reasonably fresh
    refetchInterval: 60_000,
  });
}

export function useRenew() {
  const qc = useQueryClient();
  return useMutation({
    meta: { success: "Token renewed" },
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}/auth/renew`, { method: "POST" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Renew failed (${res.status})`);
      }
      return res.json() as Promise<{ ttl: number }>;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["session"] }),
  });
}
