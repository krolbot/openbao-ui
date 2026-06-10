"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { API_BASE } from "@/lib/base-path";

// Client access to UI configuration (/ui2/api/ui-config). Phase 1 wires the
// plumbing; Phase 2 (login customization) populates branding / default method.

export type UiConfig = {
  branding?: {
    title?: string;
    subtitle?: string;
    logoUrl?: string;
    accent?: string;
  };
  defaultLoginMethod?: string;
  hideTokenLogin?: boolean;
  loginMethodOrder?: string[];
};

export function useUiConfig() {
  return useQuery({
    queryKey: ["ui-config"],
    queryFn: async (): Promise<UiConfig> => {
      const res = await fetch(`${API_BASE}/ui-config`);
      if (!res.ok) return {};
      const data = (await res.json()) as { config?: UiConfig };
      return data.config ?? {};
    },
    staleTime: 60_000,
  });
}

export function useSetUiConfig() {
  const qc = useQueryClient();
  return useMutation({
    meta: { success: "Settings saved" },
    mutationFn: async (patch: UiConfig) => {
      const res = await fetch(`${API_BASE}/ui-config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          errors?: string[];
        };
        throw new Error(data.errors?.[0] ?? `Request failed (${res.status})`);
      }
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ui-config"] }),
  });
}
