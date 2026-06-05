"use client";

import { useQuery } from "@tanstack/react-query";

import type { AuditRecord } from "@/lib/audit-parse";
import { usePreferences } from "@/lib/preferences";

export type { AuditRecord };

export function useAuditLog() {
  const { prefs } = usePreferences();
  return useQuery({
    queryKey: ["audit-log"],
    queryFn: async (): Promise<{ available: boolean; records: AuditRecord[] }> => {
      const res = await fetch("/ui/api/audit");
      if (!res.ok) return { available: false, records: [] };
      return res.json();
    },
    refetchInterval: prefs.auditRefreshMs > 0 ? prefs.auditRefreshMs : false,
  });
}
