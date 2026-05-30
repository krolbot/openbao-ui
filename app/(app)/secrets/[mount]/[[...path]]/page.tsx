"use client";

import { useParams } from "next/navigation";

import { KvBrowser } from "@/components/kv/kv-browser";

export default function KvMountPage() {
  const params = useParams<{ mount: string; path?: string[] }>();
  const mount = decodeURIComponent(params.mount);
  const segments = (params.path ?? []).map(decodeURIComponent);

  return (
    <div className="h-dvh">
      <KvBrowser mount={mount} segments={segments} />
    </div>
  );
}
