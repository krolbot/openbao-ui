"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// fetch() does not get the basePath prefixed automatically, so the BFF path is
// written out in full. router navigation (below) does respect basePath.
const LOGIN_ENDPOINT = "/ui/api/auth/login";

export default function LoginPage() {
  const router = useRouter();
  const [method, setMethod] = useState("token");
  const [token, setToken] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const payload =
      method === "token"
        ? { method: "token", token }
        : { method: "userpass", username, password };

    try {
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
    <main className="flex min-h-dvh items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Sign in to OpenBao</CardTitle>
          <CardDescription>
            Authenticate to manage your secrets.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={method} onValueChange={setMethod}>
            <TabsList>
              <TabsTrigger value="token">Token</TabsTrigger>
              <TabsTrigger value="userpass">Username</TabsTrigger>
            </TabsList>

            <form onSubmit={submit} className="mt-4 flex flex-col gap-4">
              <TabsContent value="token" className="flex flex-col gap-2">
                <Label htmlFor="token">Token</Label>
                <Input
                  id="token"
                  type="password"
                  autoComplete="off"
                  placeholder="s.xxxxxxxx or root"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                />
              </TabsContent>

              <TabsContent value="userpass" className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </TabsContent>

              {error ? (
                <p className="text-sm text-destructive">{error}</p>
              ) : null}

              <Button type="submit" disabled={loading}>
                {loading ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          </Tabs>
        </CardContent>
      </Card>
    </main>
  );
}
