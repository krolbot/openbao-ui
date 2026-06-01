"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { Logo } from "@/components/logo";
import { SealGate } from "@/components/seal-gate";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const LOGIN_ENDPOINT = "/ui/api/auth/login";
const OIDC_START = "/ui/api/auth/oidc/start";

const METHODS = [
  { value: "token", label: "Token" },
  { value: "userpass", label: "Username & Password" },
  { value: "ldap", label: "LDAP" },
  { value: "approle", label: "AppRole" },
  { value: "oidc", label: "OIDC / JWT" },
];

export default function LoginPage() {
  return (
    <SealGate>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </SealGate>
  );
}

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [method, setMethod] = useState("token");
  const [f, setF] = useState({
    token: "",
    username: "",
    password: "",
    roleId: "",
    secretId: "",
    mount: "",
    role: "",
  });
  const [error, setError] = useState<string | null>(
    search.get("error") || null,
  );
  const [loading, setLoading] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF((s) => ({ ...s, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (method === "oidc") {
        const res = await fetch(OIDC_START, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mount: f.mount || undefined, role: f.role || undefined }),
        });
        const data = await res.json();
        if (!res.ok) return setError(data.error ?? "OIDC start failed");
        window.location.href = data.authUrl;
        return;
      }

      const payload: Record<string, unknown> = { method };
      if (method === "token") payload.token = f.token;
      if (method === "userpass") Object.assign(payload, { username: f.username, password: f.password });
      if (method === "ldap")
        Object.assign(payload, { username: f.username, password: f.password, mount: f.mount || undefined });
      if (method === "approle")
        Object.assign(payload, { roleId: f.roleId, secretId: f.secretId, mount: f.mount || undefined });

      const res = await fetch(LOGIN_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Login failed");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Network error — is OpenBao reachable?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-muted/30 to-muted/60 p-4">
      <Card className="w-full max-w-sm rounded-2xl shadow-xl duration-300 animate-in fade-in-0 zoom-in-95">
        <CardHeader>
          <Logo variant="vertical" className="mx-auto mb-2 h-20 w-auto" />
          <CardTitle className="text-center text-xl">Sign in to OpenBao</CardTitle>
          <CardDescription className="text-center">
            Authenticate to manage your secrets.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="method">Method</Label>
              <select
                id="method"
                value={method}
                onChange={(e) => {
                  setMethod(e.target.value);
                  setError(null);
                }}
                className="h-9 rounded-md border bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            {method === "token" ? (
              <Field label="Token">
                <Input id="token" type="password" autoComplete="off" placeholder="s.xxxx or root" value={f.token} onChange={set("token")} />
              </Field>
            ) : null}

            {method === "userpass" || method === "ldap" ? (
              <>
                {method === "ldap" ? (
                  <Field label="Mount path">
                    <Input placeholder="ldap" value={f.mount} onChange={set("mount")} className="font-mono" />
                  </Field>
                ) : null}
                <Field label="Username">
                  <Input id="username" autoComplete="username" value={f.username} onChange={set("username")} />
                </Field>
                <Field label="Password">
                  <Input id="password" type="password" autoComplete="current-password" value={f.password} onChange={set("password")} />
                </Field>
              </>
            ) : null}

            {method === "approle" ? (
              <>
                <Field label="Mount path">
                  <Input placeholder="approle" value={f.mount} onChange={set("mount")} className="font-mono" />
                </Field>
                <Field label="Role ID">
                  <Input value={f.roleId} onChange={set("roleId")} className="font-mono" />
                </Field>
                <Field label="Secret ID">
                  <Input type="password" value={f.secretId} onChange={set("secretId")} className="font-mono" />
                </Field>
              </>
            ) : null}

            {method === "oidc" ? (
              <>
                <Field label="Mount path">
                  <Input placeholder="oidc" value={f.mount} onChange={set("mount")} className="font-mono" />
                </Field>
                <Field label="Role (optional)">
                  <Input value={f.role} onChange={set("role")} className="font-mono" />
                </Field>
              </>
            ) : null}

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <Button type="submit" disabled={loading}>
              {loading
                ? "Signing in…"
                : method === "oidc"
                  ? "Continue with OIDC"
                  : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
