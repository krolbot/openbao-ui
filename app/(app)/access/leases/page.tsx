"use client";

import { ChevronRight, FileClock, Folder, Home } from "lucide-react";
import * as React from "react";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { BaoError } from "@/lib/bao-client";
import {
  LeaseDetail,
  useLeaseList,
  useLeaseLookup,
  useRenewLease,
  useRevokeLease,
} from "@/lib/access";

const join = (...p: string[]) =>
  p.filter(Boolean).join("/").replace(/\/+/g, "/");

export default function LeasesPage() {
  const [prefix, setPrefix] = React.useState("");
  const list = useLeaseList(prefix);
  const lookup = useLeaseLookup();
  const renew = useRenewLease();
  const revoke = useRevokeLease();
  const [detail, setDetail] = React.useState<LeaseDetail | null>(null);
  const [confirmPrefix, setConfirmPrefix] = React.useState(false);

  const keys = list.data ?? [];
  const folders = keys.filter((k) => k.endsWith("/"));
  const leaves = keys.filter((k) => !k.endsWith("/"));
  const segments = prefix.split("/").filter(Boolean);

  async function open(leaseId: string) {
    try {
      setDetail(await lookup.mutateAsync(leaseId));
    } catch {
      setDetail(null);
    }
  }

  return (
    <div className="flex h-full">
      <div className="w-80 shrink-0 overflow-auto border-r">
        {/* breadcrumb */}
        <div className="flex flex-wrap items-center gap-1 border-b px-4 py-3 text-sm">
          <button onClick={() => setPrefix("")} title="root">
            <Home className="size-4 text-muted-foreground" />
          </button>
          {segments.map((s, i) => (
            <React.Fragment key={i}>
              <ChevronRight className="size-3.5 text-muted-foreground" />
              <button
                onClick={() => setPrefix(segments.slice(0, i + 1).join("/"))}
                className="hover:underline"
              >
                {s}
              </button>
            </React.Fragment>
          ))}
          {prefix ? (
            <button
              className="ml-auto text-xs text-destructive hover:underline"
              onClick={() => setConfirmPrefix(true)}
            >
              revoke prefix
            </button>
          ) : null}
        </div>

        {list.isLoading ? (
          <p className="p-4 text-sm text-muted-foreground">Loading…</p>
        ) : keys.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            No leases under this prefix.
          </p>
        ) : (
          <ul className="p-2">
            {folders.map((f) => (
              <li key={f}>
                <button
                  onClick={() => setPrefix(join(prefix, f))}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                >
                  <Folder className="size-4 text-muted-foreground" />
                  <span className="truncate">{f.replace(/\/$/, "")}</span>
                </button>
              </li>
            ))}
            {leaves.map((l) => {
              const id = join(prefix, l);
              return (
                <li key={l}>
                  <button
                    onClick={() => open(id)}
                    className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent ${
                      detail?.id === id ? "bg-accent font-medium" : ""
                    }`}
                  >
                    <FileClock className="size-4 text-muted-foreground" />
                    <span className="truncate font-mono text-xs">{l}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* detail */}
      <div className="min-w-0 flex-1 p-6">
        {!detail ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Browse a lease prefix and select a lease.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="font-mono text-sm break-all">{detail.id}</div>
            <dl className="grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
              <dt className="text-muted-foreground">TTL</dt>
              <dd>{detail.ttl}s</dd>
              <dt className="text-muted-foreground">Renewable</dt>
              <dd>{detail.renewable ? "yes" : "no"}</dd>
              <dt className="text-muted-foreground">Issued</dt>
              <dd>{new Date(detail.issue_time).toLocaleString()}</dd>
              <dt className="text-muted-foreground">Expires</dt>
              <dd>{new Date(detail.expire_time).toLocaleString()}</dd>
            </dl>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={!detail.renewable || renew.isPending}
                onClick={async () => {
                  await renew.mutateAsync({ lease_id: detail.id });
                  open(detail.id);
                }}
              >
                Renew
              </Button>
              <Button
                variant="destructive"
                disabled={revoke.isPending}
                onClick={async () => {
                  await revoke.mutateAsync({ lease_id: detail.id });
                  setDetail(null);
                }}
              >
                Revoke
              </Button>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmPrefix}
        onClose={() => setConfirmPrefix(false)}
        onConfirm={async () => {
          await revoke.mutateAsync({ lease_id: prefix, prefix: true });
          setConfirmPrefix(false);
          setDetail(null);
        }}
        title={`Revoke all leases under "${prefix}"?`}
        description="Revokes every lease beneath this prefix. This cannot be undone."
        confirmText="revoke"
        confirmLabel="Revoke prefix"
        pending={revoke.isPending}
      />
    </div>
  );
}
