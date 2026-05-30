import { CheckCircle2, Lock, ShieldCheck, Unlock } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { openbao, OpenBaoRequestError } from "@/lib/openbao";
import { getToken } from "@/lib/session";

// Server Component. Pulls live data straight from OpenBao to prove the full
// path works: React (RSC) -> lib/openbao -> OpenBao API.
export default async function OverviewPage() {
  const token = (await getToken())!; // guaranteed by the (app) layout

  const seal = await openbao.sealStatus().catch(() => null);
  const lookup = await openbao.lookupSelf(token).catch(() => null);

  let mounts: [string, { type: string; description: string }][] = [];
  let mountsError: string | null = null;
  try {
    const res = await openbao.listMounts(token);
    mounts = Object.entries(res.data).filter(([path]) => path.endsWith("/"));
  } catch (err) {
    mountsError =
      err instanceof OpenBaoRequestError
        ? err.errors.join(", ")
        : "Failed to load mounts";
  }

  return (
    <div className="mx-auto max-w-5xl p-8">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="text-muted-foreground">
          Live status of your OpenBao instance.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Seal status</CardTitle>
            {seal?.sealed ? (
              <Lock className="size-4 text-destructive" />
            ) : (
              <Unlock className="size-4 text-emerald-500" />
            )}
          </CardHeader>
          <CardContent>
            {seal ? (
              <>
                <div className="text-2xl font-semibold">
                  {seal.sealed ? "Sealed" : "Unsealed"}
                </div>
                <p className="text-xs text-muted-foreground">
                  v{seal.version} · {seal.type}
                  {seal.initialized ? " · initialized" : " · uninitialized"}
                </p>
              </>
            ) : (
              <p className="text-sm text-destructive">Unreachable</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Your token</CardTitle>
            <ShieldCheck className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {lookup ? (
              <>
                <div className="truncate text-2xl font-semibold">
                  {lookup.data.display_name || "token"}
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {lookup.data.policies.map((p) => (
                    <span
                      key={p}
                      className="rounded bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-destructive">Lookup failed</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Secret engines</CardTitle>
          <CardDescription>Enabled mounts on this instance.</CardDescription>
        </CardHeader>
        <CardContent>
          {mountsError ? (
            <p className="text-sm text-destructive">{mountsError}</p>
          ) : (
            <ul className="divide-y">
              {mounts.map(([path, info]) => (
                <li
                  key={path}
                  className="flex items-center gap-3 py-2 text-sm"
                >
                  <CheckCircle2 className="size-4 text-emerald-500" />
                  <span className="font-mono">{path}</span>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                    {info.type}
                  </span>
                  {info.description ? (
                    <span className="truncate text-muted-foreground">
                      {info.description}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
