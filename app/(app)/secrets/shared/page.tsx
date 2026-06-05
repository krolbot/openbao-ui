"use client";

import { ArrowLeft, KeySquare, Plus } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { NewSharedKeysDialog } from "@/components/new-shared-keys-dialog";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SHARED_PREFIX } from "@/lib/access-policy";
import { labelKey, useLabels } from "@/lib/labels";
import { useSharedGroups } from "@/lib/shared-groups";

export default function SharedKeysPage() {
  const groups = useSharedGroups();
  const { data: labels } = useLabels();
  const envName = (m: string) => labels?.[labelKey("environment", `${m}/`)]?.label || m;
  const [creating, setCreating] = React.useState(false);
  const list = groups.data ?? [];

  return (
    <div className="mx-auto max-w-5xl p-8">
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <KeySquare className="size-6" /> Shared keys
          </span>
        }
        description="Bundles of secrets (e.g. stripe) shared read-only into multiple apps — define the values once, include them wherever they're needed."
        className="mb-6"
        actions={
          <>
            <Link href="/secrets">
              <Button variant="outline" size="sm">
                <ArrowLeft /> Secrets
              </Button>
            </Link>
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus /> New shared keys
            </Button>
          </>
        }
      />

      {groups.isLoading ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <li key={i} className="rounded-xl border bg-card p-4 shadow-sm">
              <Skeleton className="mb-3 h-5 w-28" />
              <Skeleton className="h-4 w-40" />
            </li>
          ))}
        </ul>
      ) : list.length === 0 ? (
        <EmptyState
          icon={KeySquare}
          title="No shared keys yet"
          description="Create a bundle like “stripe” once, then include it when you issue credentials or grant access to your apps."
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {list.map((g) => (
            <li key={g.name} className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <KeySquare className="size-4" />
                </div>
                <div className="min-w-0">
                  <div className="font-mono font-medium">{g.name}</div>
                  <p className="text-xs text-muted-foreground">in {g.envs.length} environment{g.envs.length === 1 ? "" : "s"}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 border-t pt-3">
                {g.envs.map((e) => (
                  <Link key={e} href={`/secrets/${e}/${SHARED_PREFIX}/${g.name}/config`}>
                    <Badge variant="outline" className="cursor-pointer hover:bg-accent">{envName(e)} →</Badge>
                  </Link>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}

      {creating ? <NewSharedKeysDialog onClose={() => setCreating(false)} /> : null}
    </div>
  );
}
