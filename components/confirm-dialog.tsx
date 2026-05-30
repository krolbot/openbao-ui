"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogHeader } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Guardrail for destructive actions. When `confirmText` is set the user must
 * type it to enable the action (typed-confirm), per the roadmap's safety rules.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  confirmText,
  destructive = true,
  pending = false,
  error,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  confirmText?: string;
  destructive?: boolean;
  pending?: boolean;
  error?: string | null;
}) {
  const [typed, setTyped] = React.useState("");
  React.useEffect(() => {
    if (open) setTyped("");
  }, [open]);

  const blocked = !!confirmText && typed !== confirmText;

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogHeader title={title} description={description} onClose={onClose} />
      {confirmText ? (
        <div className="mb-4 flex flex-col gap-2">
          <Label htmlFor="confirm-input">
            Type <span className="font-mono font-semibold">{confirmText}</span>{" "}
            to confirm
          </Label>
          <Input
            id="confirm-input"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
          />
        </div>
      ) : null}
      {error ? (
        <p className="mb-3 text-sm text-destructive">{error}</p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button
          variant={destructive ? "destructive" : "default"}
          onClick={onConfirm}
          disabled={blocked || pending}
        >
          {pending ? "Working…" : confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
