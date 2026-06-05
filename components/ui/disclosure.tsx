"use client";

import { ChevronRight } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Inline progressive disclosure: keeps a view simple by default and reveals
 * advanced/rare/dangerous detail only when asked. Use `tone="danger"` for
 * destructive sections.
 */
export function Disclosure({
  label,
  children,
  defaultOpen = false,
  count,
  tone = "default",
  className,
}: {
  label: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  count?: number;
  tone?: "default" | "danger";
  className?: string;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div className={cn("rounded-md border", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cn(
          "flex w-full items-center gap-2 px-3 py-2 text-sm font-medium",
          tone === "danger" && "text-destructive",
        )}
      >
        <ChevronRight
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-90",
            tone === "danger" && "text-destructive/70",
          )}
        />
        <span className="flex-1 text-left">{label}</span>
        {count != null ? (
          <span className="text-xs text-muted-foreground">{count}</span>
        ) : null}
      </button>
      {open ? <div className="border-t p-3">{children}</div> : null}
    </div>
  );
}
