"use client";

import { useQuery } from "@tanstack/react-query";

import { baoFetch } from "@/lib/bao-client";
import { useNamespace } from "@/lib/namespace";

type AclData = {
  root: boolean;
  exact: Record<string, string[]>;
  glob: Record<string, string[]>;
};

type RawCaps = Record<string, { capabilities?: string[] }>;
const mapCaps = (o: RawCaps = {}) =>
  Object.fromEntries(
    Object.entries(o).map(([k, v]) => [k, v.capabilities ?? []]),
  );

/** The current token's resultant ACL — used to make the nav capability-aware. */
export function useResultantAcl() {
  const { namespace } = useNamespace();
  return useQuery({
    queryKey: ["resultant-acl", namespace],
    queryFn: async (): Promise<AclData> => {
      try {
        const res = await baoFetch<{
          data: { root?: boolean; exact_paths?: RawCaps; glob_paths?: RawCaps };
        }>({ path: "sys/internal/ui/resultant-acl", namespace });
        return {
          root: !!res.data.root,
          exact: mapCaps(res.data.exact_paths),
          glob: mapCaps(res.data.glob_paths),
        };
      } catch {
        return { root: false, exact: {}, glob: {} };
      }
    },
  });
}

function canPath(acl: AclData | undefined, path: string): boolean {
  if (!acl) return true; // optimistic while loading
  if (acl.root) return true;
  const ok = (caps?: string[]) => !!caps && caps.some((c) => c !== "deny");
  if (ok(acl.exact[path])) return true;
  for (const [prefix, caps] of Object.entries(acl.glob)) {
    if (path.startsWith(prefix) && ok(caps)) return true;
  }
  return false;
}

/** Returns a `can(path)` predicate for gating UI on token capabilities. */
export function useCan() {
  const { data } = useResultantAcl();
  return (path: string) => canPath(data, path);
}
