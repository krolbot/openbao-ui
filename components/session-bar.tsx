"use client";

import { RefreshCw } from "lucide-react";
import * as React from "react";

import { LogoutButton } from "@/components/logout-button";
import { useRenew, useSession } from "@/lib/auth-hooks";

function fmt(seconds: number): string {
  if (seconds <= 0) return "∞";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function SessionBar({ displayName }: { displayName: string }) {
  const { data } = useSession();
  const renew = useRenew();
  const ttl = data?.ttl ?? 0;
  const renewable = data?.renewable ?? false;

  // local countdown anchored to the last fetched ttl
  const [remaining, setRemaining] = React.useState(ttl);
  React.useEffect(() => setRemaining(ttl), [ttl]);
  React.useEffect(() => {
    if (ttl <= 0) return; // non-expiring (e.g. root)
    const id = setInterval(
      () => setRemaining((r) => (r > 0 ? r - 1 : 0)),
      1000,
    );
    return () => clearInterval(id);
  }, [ttl]);

  const name = data?.displayName || displayName;
  const expiring = ttl > 0;

  return (
    <div className="border-t p-3">
      <div className="px-3 py-2 text-xs text-muted-foreground">
        Signed in as
        <div className="truncate font-medium text-foreground">{name}</div>
        <div className="mt-1 flex items-center gap-2">
          <span>{expiring ? `expires in ${fmt(remaining)}` : "never expires"}</span>
          {expiring && renewable ? (
            <button
              onClick={() => renew.mutate()}
              disabled={renew.isPending}
              title="Renew token"
              className="inline-flex items-center text-foreground hover:opacity-70"
            >
              <RefreshCw className={`size-3 ${renew.isPending ? "animate-spin" : ""}`} />
            </button>
          ) : null}
        </div>
      </div>
      <LogoutButton />
    </div>
  );
}
