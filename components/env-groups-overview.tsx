"use client";

import { Layers, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { EnvGroupManager } from "@/components/env-group-manager";
import { ColorDot } from "@/components/label-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useMounts } from "@/lib/kv";
import { labelKey, useLabels } from "@/lib/labels";

/**
 * At-a-glance map of environment groups → their member environments (KV mounts
 * tagged with the same env_group), with a Manage affordance. Mirrors how a
 * scoped role's "by group" selector resolves. Hidden until at least one KV
 * environment exists.
 */
export function EnvGroupsOverview() {
  const { data: mounts } = useMounts();
  const { data: labels } = useLabels();
  const [managing, setManaging] = React.useState(false);

  const kvCount = Object.values(mounts ?? {}).filter(
    (v) => v.type === "kv" || v.type === "generic",
  ).length;

  const groups = new Map<string, { mount: string; name: string; color?: string }[]>();
  for (const [path, info] of Object.entries(mounts ?? {})) {
    if (info.type !== "kv" && info.type !== "generic") continue;
    const lbl = labels?.[labelKey("environment", path)];
    if (!lbl?.env_group) continue;
    const mount = path.replace(/\/$/, "");
    const arr = groups.get(lbl.env_group) ?? [];
    arr.push({ mount, name: lbl.label || mount, color: lbl.color ?? undefined });
    groups.set(lbl.env_group, arr);
  }

  if (kvCount === 0) return null;

  return (
    <div className="mb-6 rounded-xl border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Layers className="size-4 text-muted-foreground" /> Environment groups
        </h2>
        <Button variant="outline" size="sm" onClick={() => setManaging(true)}>
          <SlidersHorizontal /> Manage
        </Button>
      </div>

      {groups.size > 0 ? (
        <ul className="flex flex-col gap-2.5">
          {[...groups.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([group, members]) => (
              <li key={group} className="flex flex-wrap items-center gap-2">
                <Badge variant="primary" className="capitalize">{group}</Badge>
                <span className="text-xs text-muted-foreground">→</span>
                {members.map((m) => (
                  <Link
                    key={m.mount}
                    href={`/secrets/${m.mount}`}
                    className="flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-sm hover:bg-accent"
                  >
                    {m.color ? <ColorDot color={m.color} className="size-2" /> : null}
                    {m.name}
                  </Link>
                ))}
              </li>
            ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          No groups yet — <button type="button" onClick={() => setManaging(true)} className="underline hover:text-foreground">assign environments to a group</button> so you can grant them together.
        </p>
      )}

      {groups.size > 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Grant a whole group at once in{" "}
          <Link href="/access/team" className="underline hover:text-foreground">
            Access → Team
          </Link>
          .
        </p>
      ) : null}

      {managing ? <EnvGroupManager onClose={() => setManaging(false)} /> : null}
    </div>
  );
}
