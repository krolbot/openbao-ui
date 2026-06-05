"use client";

import { Label } from "@/components/ui/label";
import { useSharedGroups } from "@/lib/shared-groups";
import { cn } from "@/lib/utils";

/**
 * Multi-select of shared key bundles to grant (read-only) alongside an app's own
 * secrets. Hidden when none exist yet.
 */
export function SharedKeysPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const { data } = useSharedGroups();
  const groups = data ?? [];
  if (groups.length === 0) return null;
  const toggle = (n: string) =>
    onChange(value.includes(n) ? value.filter((x) => x !== n) : [...value, n]);
  return (
    <div className="flex flex-col gap-2">
      <Label>Include shared keys (optional)</Label>
      <div className="flex flex-wrap gap-2">
        {groups.map((g) => (
          <label
            key={g.name}
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1 text-sm",
              value.includes(g.name) ? "border-primary bg-accent" : "text-muted-foreground",
            )}
          >
            <input type="checkbox" checked={value.includes(g.name)} onChange={() => toggle(g.name)} />
            {g.name}
          </label>
        ))}
      </div>
    </div>
  );
}
