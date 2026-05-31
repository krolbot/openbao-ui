"use client";

import { useQuery } from "@tanstack/react-query";

import type { AuditRecord } from "@/lib/audit-parse";

export type { AuditRecord };

export function useAuditLog() {
  return useQuery({
    queryKey: ["audit-log"],
    queryFn: async (): Promise<{ available: boolean; records: AuditRecord[] }> => {
      const res = await fetch("/ui/api/audit");
      if (!res.ok) return { available: false, records: [] };
      return res.json();
    },
    refetchInterval: 10_000,
  });
}
