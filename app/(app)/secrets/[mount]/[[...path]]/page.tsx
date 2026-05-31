"use client";

import { useParams } from "next/navigation";

import { KvBrowser } from "@/components/kv/kv-browser";
import { DatabaseDashboard } from "@/components/engines/database-dashboard";
import { PkiDashboard } from "@/components/engines/pki-dashboard";
import { SshDashboard } from "@/components/engines/ssh-dashboard";
import { TransitDashboard } from "@/components/engines/transit-dashboard";
import { useMounts } from "@/lib/kv";

export default function MountPage() {
  const params = useParams<{ mount: string; path?: string[] }>();
  const mount = decodeURIComponent(params.mount);
  const segments = (params.path ?? []).map(decodeURIComponent);

  const mounts = useMounts();
  const info = mounts.data?.[`${mount}/`];
  const type = info?.type;

  // While we don't know the type yet, optimistically assume KV (the common case)
  // so the browser renders without a flash.
  if (mounts.isLoading || !type || type === "kv" || type === "generic") {
    return (
      <div className="h-dvh">
        <KvBrowser mount={mount} segments={segments} />
      </div>
    );
  }

  if (type === "transit") return <div className="h-dvh"><TransitDashboard mount={mount} /></div>;
  if (type === "pki") return <div className="h-dvh"><PkiDashboard mount={mount} /></div>;
  if (type === "ssh") return <div className="h-dvh"><SshDashboard mount={mount} /></div>;
  if (type === "database") return <div className="h-dvh"><DatabaseDashboard mount={mount} /></div>;

  return (
    <div className="flex h-dvh items-center justify-center p-8 text-center text-sm text-muted-foreground">
      <div>
        <p className="font-mono text-foreground">{mount}/</p>
        <p>A dashboard for <span className="font-mono">{type}</span> engines is coming soon.</p>
      </div>
    </div>
  );
}
