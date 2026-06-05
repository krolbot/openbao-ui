"use client";

import { ArrowLeft, KeyRound, Package, Pencil, Plus, ShieldCheck } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { GrantAccessDialog } from "@/components/grant-access-dialog";
import { IssueCredentialDialog } from "@/components/issue-credential-dialog";
import { ColorDot, LabelEditor } from "@/components/label-editor";
import { NewAppDialog } from "@/components/new-app-dialog";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAccessRoles } from "@/lib/access-roles";
import { useAppCredentials } from "@/lib/app-credentials";
import { useApps } from "@/lib/apps";
import { labelKey, useLabels } from "@/lib/labels";

export default function AppsPage() {
  const { apps, isLoading } = useApps();
  const { data: labels } = useLabels();
  const accessRoles = useAccessRoles();
  const appCreds = useAppCredentials();
  const envName = (m: string) => labels?.[labelKey("environment", `${m}/`)]?.label || m;

  const [creating, setCreating] = React.useState(false);
  const [issuing, setIssuing] = React.useState<string | null>(null);
  const [granting, setGranting] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<string | null>(null);

  return (
    <div className="mx-auto max-w-5xl p-8">
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <Package className="size-6" /> Apps
          </span>
        }
        description="Your applications — folders of secrets across environments. Issue credentials or grant access per app."
        className="mb-6"
        actions={
          <>
            <Link href="/secrets">
              <Button variant="outline" size="sm">
                <ArrowLeft /> Secrets
              </Button>
            </Link>
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus /> New app
            </Button>
          </>
        }
      />

      {isLoading ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <li key={i} className="rounded-xl border bg-card p-4 shadow-sm">
              <Skeleton className="mb-3 h-5 w-32" />
              <Skeleton className="h-4 w-48" />
            </li>
          ))}
        </ul>
      ) : apps.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No apps yet"
          description="Apps are top-level folders inside your environments (e.g. payments/). Add one, or create a secret under a new folder."
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {apps.map((a) => (
            <li
              key={a.app}
              className="group/card flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
            >
              <div className="flex items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Package className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {a.label?.color ? <ColorDot color={a.label.color} className="size-2.5 shrink-0" /> : null}
                    <span className="font-medium">{a.label?.label || a.app}</span>
                    {a.label?.label ? <Badge variant="muted" className="font-mono">{a.app}</Badge> : null}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {a.label?.description || `${a.envs.length || "no"} environment${a.envs.length === 1 ? "" : "s"}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditing(a.app)}
                  title="Edit app"
                  aria-label={`Edit ${a.app}`}
                  className="shrink-0 rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100 group-hover/card:opacity-100"
                >
                  <Pencil className="size-3.5" />
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {a.envs.length ? (
                  a.envs.map((e) => (
                    <Badge key={e} variant="outline">{envName(e)}</Badge>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">No secrets yet</span>
                )}
              </div>

              <div className="mt-auto flex flex-wrap gap-2 border-t pt-3">
                <Button size="sm" variant="outline" onClick={() => setIssuing(a.app)}>
                  <KeyRound /> Issue credential
                </Button>
                <Button size="sm" variant="outline" onClick={() => setGranting(a.app)}>
                  <ShieldCheck /> Grant access
                </Button>
                {a.envs[0] ? (
                  <Link href={`/secrets/${a.envs[0]}/${a.app}`} className="ml-auto">
                    <Button size="sm" variant="ghost">Open →</Button>
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {creating ? <NewAppDialog onClose={() => setCreating(false)} /> : null}
      {issuing ? (
        <IssueCredentialDialog existing={appCreds.data ?? []} initialApp={issuing} onClose={() => setIssuing(null)} />
      ) : null}
      {granting ? (
        <GrantAccessDialog existing={accessRoles.data ?? []} initialApp={granting} onClose={() => setGranting(null)} />
      ) : null}
      {editing ? (
        <LabelEditor
          open
          onClose={() => setEditing(null)}
          scope="application"
          refPath={editing}
          current={labels?.[labelKey("application", editing)]}
          nativeName={editing}
        />
      ) : null}
    </div>
  );
}
