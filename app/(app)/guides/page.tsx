"use client";

import { BookOpen } from "lucide-react";
import * as React from "react";

import { CopyButton } from "@/components/copy-button";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label as FieldLabel } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { buildSnippets, type GuideAuth } from "@/lib/guides";
import { useMounts } from "@/lib/kv";
import { labelKey, useLabels } from "@/lib/labels";
import { cn } from "@/lib/utils";

export default function GuidesPage() {
  const { data: mounts, isLoading } = useMounts();
  const { data: labels } = useLabels();

  // "Environments" are the KV engines you can read secrets from.
  const envs = Object.entries(mounts ?? {})
    .filter(([, v]) => v.type === "kv" || v.type === "generic")
    .map(([p]) => p.replace(/\/$/, ""));

  const [mount, setMount] = React.useState<string>("");
  const [path, setPath] = React.useState("app/config");
  const [auth, setAuth] = React.useState<GuideAuth>("token");

  React.useEffect(() => {
    if (!mount && envs.length) setMount(envs[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounts]);

  const addr =
    typeof window !== "undefined" ? window.location.origin : "https://openbao.example.com";
  const snippets = React.useMemo(
    () => buildSnippets({ addr, mount: mount || "secret", path, auth }),
    [addr, mount, path, auth],
  );

  const envName = (m: string) => labels?.[labelKey("environment", `${m}/`)]?.label || m;

  return (
    <div className="mx-auto max-w-4xl p-8">
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <BookOpen className="size-6" /> Integration guides
          </span>
        }
        description="Copy-paste snippets to read this secret from your own app — wired to your environment, path, and auth method."
        className="mb-6"
      />

      {isLoading ? (
        <Skeleton className="h-40 w-full rounded-xl" />
      ) : envs.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No environments yet"
          description="Enable a KV secrets engine to get connection guides for it."
        />
      ) : (
        <>
          <div className="mb-6 flex flex-col gap-4 rounded-xl border bg-card p-4 shadow-sm">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <FieldLabel htmlFor="guide-env">Environment</FieldLabel>
                <select
                  id="guide-env"
                  value={mount}
                  onChange={(e) => setMount(e.target.value)}
                  className="h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                >
                  {envs.map((m) => (
                    <option key={m} value={m}>
                      {envName(m)} ({m})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <FieldLabel htmlFor="guide-path">Secret path</FieldLabel>
                <Input
                  id="guide-path"
                  value={path}
                  onChange={(e) => setPath(e.target.value)}
                  className="font-mono"
                  placeholder="app/config"
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <FieldLabel>Authentication</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["token", "Token"],
                    ["approle", "AppRole"],
                  ] as const
                ).map(([value, lbl]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setAuth(value)}
                    className={cn(
                      "rounded-md border px-2.5 py-1 text-sm",
                      auth === value
                        ? "border-primary bg-accent"
                        : "text-muted-foreground",
                    )}
                  >
                    {lbl}
                  </button>
                ))}
                <Badge variant="muted" className="self-center">
                  {auth === "approle"
                    ? "for services & CI"
                    : "quickest for local dev"}
                </Badge>
              </div>
            </div>
          </div>

          <Tabs defaultValue="cli">
            <TabsList className="flex-wrap">
              {snippets.map((s) => (
                <TabsTrigger key={s.id} value={s.id}>
                  {s.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {snippets.map((s) => (
              <TabsContent key={s.id} value={s.id}>
                <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
                  <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-1.5">
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">
                      {s.lang}
                    </span>
                    <CopyButton value={s.code} label="Copy" />
                  </div>
                  <pre className="overflow-x-auto p-4 text-xs leading-relaxed">
                    <code>{s.code}</code>
                  </pre>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </>
      )}
    </div>
  );
}
