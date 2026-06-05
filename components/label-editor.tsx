"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogHeader } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label as FieldLabel } from "@/components/ui/label";
import { useSetLabel, type Label, type LabelScope } from "@/lib/labels";
import { cn } from "@/lib/utils";

// Friendly-name colors. Kept as named tokens (not raw classes) so they can be
// rendered consistently as dots/badges across the app via colorDot().
export const LABEL_COLORS = [
  "slate",
  "emerald",
  "amber",
  "red",
  "blue",
  "violet",
  "pink",
] as const;

const DOTS: Record<string, string> = {
  slate: "bg-slate-400",
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
  blue: "bg-blue-500",
  violet: "bg-violet-500",
  pink: "bg-pink-500",
};

export function colorDot(color: string | null | undefined): string {
  return (color && DOTS[color]) || "bg-muted-foreground/40";
}

// Free-text now (so operators can define their own groups); these are just
// quick suggestions surfaced via a datalist.
const ENV_GROUP_PRESETS = ["dev", "staging", "prod"];

export function LabelEditor({
  open,
  onClose,
  scope,
  refPath,
  current,
  ns,
  nativeName,
  showEnvGroup = false,
}: {
  open: boolean;
  onClose: () => void;
  scope: LabelScope;
  refPath: string;
  current?: Label;
  /** namespace to store under; pass "" for workspace (namespace) labels */
  ns?: string;
  nativeName: string;
  showEnvGroup?: boolean;
}) {
  const set = useSetLabel(ns);
  const [label, setLabel] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [color, setColor] = React.useState("");
  const [envGroup, setEnvGroup] = React.useState("");

  // Re-seed the form whenever the dialog opens for a (possibly different) ref.
  React.useEffect(() => {
    if (!open) return;
    setLabel(current?.label ?? "");
    setDescription(current?.description ?? "");
    setColor(current?.color ?? "");
    setEnvGroup(current?.env_group ?? "");
  }, [open, current]);

  if (!open) return null;

  return (
    <Dialog open onClose={onClose}>
      <DialogHeader
        title="Customize display"
        description={
          <>
            Friendly naming for{" "}
            <span className="font-mono text-foreground">{nativeName}</span>. This
            only changes how it appears in this UI.
          </>
        }
        onClose={onClose}
      />
      <form
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          await set.mutateAsync({
            scope,
            ref: refPath,
            label,
            description,
            color,
            env_group: showEnvGroup ? envGroup : undefined,
          });
          onClose();
        }}
      >
        <div className="flex flex-col gap-2">
          <FieldLabel htmlFor="lbl-name">Display name</FieldLabel>
          <Input
            id="lbl-name"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={nativeName}
            autoFocus
          />
        </div>

        <div className="flex flex-col gap-2">
          <FieldLabel htmlFor="lbl-desc">Description</FieldLabel>
          <Input
            id="lbl-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional — what this is for"
          />
        </div>

        <div className="flex flex-col gap-2">
          <FieldLabel>Color</FieldLabel>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setColor("")}
              className={cn(
                "flex size-7 items-center justify-center rounded-full border text-xs",
                !color && "ring-2 ring-ring ring-offset-2 ring-offset-background",
              )}
              title="No color"
            >
              <span className="size-3 rounded-full bg-muted-foreground/40" />
            </button>
            {LABEL_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={cn(
                  "flex size-7 items-center justify-center rounded-full border",
                  color === c &&
                    "ring-2 ring-ring ring-offset-2 ring-offset-background",
                )}
                title={c}
              >
                <span className={cn("size-3 rounded-full", colorDot(c))} />
              </button>
            ))}
          </div>
        </div>

        {showEnvGroup ? (
          <div className="flex flex-col gap-2">
            <FieldLabel htmlFor="lbl-envgroup">Environment group</FieldLabel>
            <Input
              id="lbl-envgroup"
              value={envGroup}
              onChange={(e) => setEnvGroup(e.target.value)}
              list="env-group-presets"
              placeholder="e.g. prod — or your own; shareable across environments"
            />
            <datalist id="env-group-presets">
              {ENV_GROUP_PRESETS.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
            <p className="text-xs text-muted-foreground">
              Environments sharing a group can be granted together in Access → Team.
            </p>
          </div>
        ) : null}

        <div className="flex justify-end gap-2 border-t pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={set.isPending}>
            Save
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
