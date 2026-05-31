"use client";

import { FileText, Info } from "lucide-react";

import { BaoError } from "@/lib/bao-client";
import { useAuditDevices } from "@/lib/operations";

const errMsg = (e: unknown) =>
  e instanceof BaoError ? e.errors.join(", ") : "Something went wrong";

export default function AuditPage() {
  const devices = useAuditDevices();

  return (
    <div className="mx-auto max-w-3xl p-8">
      <p className="mb-3 text-sm text-muted-foreground">
        Audit devices record every request &amp; response for compliance.
      </p>

      <div className="mb-4 flex items-start gap-2 rounded-md border bg-muted/40 p-3 text-sm">
        <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <span className="text-muted-foreground">
          OpenBao manages audit devices <span className="font-medium text-foreground">declaratively</span> via
          the server config file (enabling/disabling over the API is disabled). This view lists the devices
          currently configured.
        </span>
      </div>

      {devices.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : devices.isError ? (
        <p className="text-sm text-destructive">{errMsg(devices.error)}</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {(devices.data ?? []).map((d) => (
            <li key={d.path} className="flex items-center gap-3 px-3 py-2 text-sm">
              <FileText className="size-4 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <span className="font-mono">{d.path}</span>
                <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{d.type}</span>
                {d.options?.file_path ? (
                  <div className="truncate font-mono text-xs text-muted-foreground">{d.options.file_path}</div>
                ) : null}
              </div>
            </li>
          ))}
          {devices.data?.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">
              No audit devices configured.
            </li>
          ) : null}
        </ul>
      )}
    </div>
  );
}
