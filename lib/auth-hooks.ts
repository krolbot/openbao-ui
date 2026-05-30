"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

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
      const res = await fetch("/ui/api/auth/session");
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
      const res = await fetch("/ui/api/auth/renew", { method: "POST" });
      if (!res.ok) throw new Error("renew failed");
      return res.json() as Promise<{ ttl: number }>;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["session"] }),
  });
}
