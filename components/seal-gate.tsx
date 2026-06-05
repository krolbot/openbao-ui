"use client";

import { Lock, ShieldAlert } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CopyButton } from "@/components/copy-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SealStatus = {
  initialized: boolean;
  sealed: boolean;
  t: number;
  n: number;
  progress: number;
  version?: string;
};

// sys/seal-status, sys/init and sys/unseal are unauthenticated, so we hit the
// raw /v1 proxy directly (no token). This gate renders the bootstrap flows
// (initialize / unseal) before falling through to the login form.
async function getStatus(): Promise<SealStatus | null> {
  try {
    const res = await fetch("/v1/sys/seal-status");
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export function SealGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = React.useState<SealStatus | null | undefined>(
    undefined,
  );
  const reload = React.useCallback(async () => setStatus(await getStatus()), []);
  React.useEffect(() => {
    reload();
  }, [reload]);

  if (status === undefined) {
    return <Centered><p className="text-sm text-muted-foreground">Connecting…</p></Centered>;
  }
  // status === null means seal-status was unreachable; let the login form try.
  if (status && !status.initialized) {
    return <Centered><InitWizard onDone={reload} /></Centered>;
  }
  if (status && status.sealed) {
    return <Centered><UnsealFlow status={status} onChange={reload} /></Centered>;
  }
  return <>{children}</>;
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/40 p-4">
      {children}
    </main>
  );
}

function InitWizard({ onDone }: { onDone: () => void }) {
  const [shares, setShares] = React.useState("5");
  const [threshold, setThreshold] = React.useState("3");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<{ keys: string[]; root_token: string } | null>(null);

  async function init(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/v1/sys/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret_shares: Number(shares),
          secret_threshold: Number(threshold),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.errors?.join(", ") ?? "Initialization failed");
        return;
      }
      setResult({ keys: data.keys_base64 ?? data.keys, root_token: data.root_token });
    } catch {
      setError("Could not reach OpenBao");
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <ShieldAlert className="size-5 text-amber-500" /> Save your keys
          </CardTitle>
          <CardDescription>
            These unseal keys and the root token are shown <strong>once</strong>.
            Store them securely now — they cannot be recovered.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div>
            <Label>Unseal keys ({result.keys.length})</Label>
            <ul className="mt-2 flex flex-col gap-1">
              {result.keys.map((k, i) => (
                <li key={i} className="flex items-center gap-2 rounded-md border bg-muted/50 p-2">
                  <code className="min-w-0 flex-1 truncate text-xs">{k}</code>
                  <CopyButton value={k} />
                </li>
              ))}
            </ul>
          </div>
          <div>
            <Label>Root token</Label>
            <div className="mt-2 flex items-center gap-2 rounded-md border bg-muted/50 p-2">
              <code className="min-w-0 flex-1 truncate text-sm">{result.root_token}</code>
              <CopyButton value={result.root_token} />
            </div>
          </div>
          <Button onClick={onDone}>I&apos;ve saved them — continue to unseal</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl">Initialize OpenBao</CardTitle>
        <CardDescription>
          This instance is new. Choose how the master key is split into unseal
          key shares.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={init} className="flex flex-col gap-4">
          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="shares">Key shares</Label>
              <Input id="shares" value={shares} onChange={(e) => setShares(e.target.value)} />
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="threshold">Threshold</Label>
              <Input id="threshold" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
            </div>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" disabled={busy}>
            {busy ? "Initializing…" : "Initialize"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function UnsealFlow({
  status,
  onChange,
}: {
  status: SealStatus;
  onChange: () => void;
}) {
  const [key, setKey] = React.useState("");
  const [progress, setProgress] = React.useState(status.progress);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/v1/sys/unseal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: key.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.errors?.join(", ") ?? "Invalid key");
        return;
      }
      setKey("");
      setProgress(data.progress ?? 0);
      if (!data.sealed) onChange(); // fully unsealed -> fall through to login
    } catch {
      setError("Could not reach OpenBao");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Lock className="size-5 text-destructive" /> Unseal OpenBao
        </CardTitle>
        <CardDescription>
          Enter unseal key shares one at a time. {status.t} of {status.n}{" "}
          required.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${Math.min(100, (progress / status.t) * 100)}%` }}
          />
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          Progress: {progress} / {status.t}
        </p>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="key">Unseal key</Label>
            <Input
              id="key"
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              autoComplete="off"
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" disabled={busy || !key.trim()}>
            {busy ? "Submitting…" : "Submit key"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
