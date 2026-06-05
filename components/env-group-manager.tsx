"use client";

import * as React from "react";

import { ColorDot } from "@/components/label-editor";
import { Button } from "@/components/ui/button";
import { Dialog, DialogHeader } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useMounts } from "@/lib/kv";
import { labelKey, useLabels, useSetLabel } from "@/lib/labels";

/**
 * Manage env-group membership from one place: every environment with an inline
 * group field (datalist-suggested from existing groups). Membership is the
 * `env_group` label on each mount — set it here, grant the whole group in Team.
 */
export function EnvGroupManager({ onClose }: { onClose: () => void }) {
  const { data: mounts } = useMounts();
  const { data: labels } = useLabels();
  const setLabel = useSetLabel();

  const kvMounts = Object.entries(mounts ?? {})
    .filter(([, v]) => v.type === "kv" || v.type === "generic")
    .map(([p]) => p.replace(/\/$/, ""));
  const lblOf = (m: string) => labels?.[labelKey("environment", `${m}/`)];
  const groups = Array.from(
    new Set(
      Object.values(labels ?? {})
        .filter((l) => l.scope === "environment" && l.env_group)
        .map((l) => l.env_group as string),
    ),
  ).sort();

  async function save(mount: string, group: string) {
    const cur = lblOf(mount);
    await setLabel.mutateAsync({
      scope: "environment",
      ref: `${mount}/`,
      label: cur?.label ?? undefined,
      description: cur?.description ?? undefined,
      color: cur?.color ?? undefined,
      env_group: group.trim() || undefined,
    });
  }

  return (
    <Dialog open onClose={onClose} className="max-w-lg">
      <DialogHeader
        title="Manage environment groups"
        description="Assign each environment to a group. Environments in the same group are granted together in Access → Team."
        onClose={onClose}
      />
      <datalist id="env-group-options">
        {groups.map((g) => (
          <option key={g} value={g} />
        ))}
        {["dev", "staging", "prod"].filter((g) => !groups.includes(g)).map((g) => (
          <option key={g} value={g} />
        ))}
      </datalist>

      {kvMounts.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No environments yet — create one on the Secrets page first.
        </p>
      ) : (
        <ul className="divide-y rounded-md border">
          {kvMounts.map((m) => (
            <GroupRow
              key={m}
              friendly={lblOf(m)?.label || m}
              mount={m}
              color={lblOf(m)?.color}
              group={lblOf(m)?.env_group ?? ""}
              onSave={(g) => save(m, g)}
            />
          ))}
        </ul>
      )}

      <div className="flex justify-end border-t pt-4">
        <Button onClick={onClose}>Done</Button>
      </div>
    </Dialog>
  );
}

function GroupRow({
  friendly,
  mount,
  color,
  group,
  onSave,
}: {
  friendly: string;
  mount: string;
  color?: string | null;
  group: string;
  onSave: (group: string) => void | Promise<void>;
}) {
  const [value, setValue] = React.useState(group);
  React.useEffect(() => setValue(group), [group]);

  return (
    <li className="flex items-center gap-3 px-3 py-2">
      {color ? <ColorDot color={color} className="size-2.5 shrink-0" /> : null}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{friendly}</div>
        {friendly !== mount ? (
          <div className="truncate font-mono text-xs text-muted-foreground">{mount}</div>
        ) : null}
      </div>
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => { if (value.trim() !== group) onSave(value); }}
        list="env-group-options"
        placeholder="ungrouped"
        className="h-8 w-36 font-mono text-sm"
      />
    </li>
  );
}
