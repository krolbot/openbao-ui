"use client";

import { useQuery } from "@tanstack/react-query";

import { baoFetch } from "@/lib/bao-client";
import { useNamespace } from "@/lib/namespace";

export type SealStatus = {
  type: string;
  initialized: boolean;
  sealed: boolean;
  version: string;
  cluster_name?: string;
};

// sys/seal-status returns the status object at the top level (not under `data`).
export function useSealStatus() {
  const { namespace } = useNamespace();
  return useQuery({
    queryKey: ["seal-status", namespace],
    queryFn: () => baoFetch<SealStatus>({ path: "sys/seal-status", namespace }),
  });
}
