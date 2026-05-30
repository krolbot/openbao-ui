"use client";

import { ChevronsUpDown, Layers } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogHeader } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useNamespaces } from "@/lib/kv";
import { useNamespace } from "@/lib/namespace";

export function NamespaceSwitcher() {
  const { namespace, setNamespace } = useNamespace();
  const [open, setOpen] = React.useState(false);
  const [manual, setManual] = React.useState("");
  const { data: children = [], isLoading } = useNamespaces();

  // child namespaces are relative to the current one; build full paths
  const options = children.map((c) =>
    [namespace, c.replace(/\/$/, "")].filter(Boolean).join("/"),
  );

  function choose(ns: string) {
    setNamespace(ns);
    setOpen(false);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm hover:bg-accent"
      >
        <Layers className="size-4 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate">
          <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">
            Namespace
          </span>
          <span className="block truncate font-medium">
            {namespace || "root"}
          </span>
        </span>
        <ChevronsUpDown className="size-4 text-muted-foreground" />
      </button>

      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogHeader
          title="Switch namespace"
          description="Sets the scope (X-Vault-Namespace) for all requests."
          onClose={() => setOpen(false)}
        />

        <div className="flex flex-col gap-1">
          <button
            onClick={() => choose("")}
            className={`rounded-md px-3 py-2 text-left text-sm hover:bg-accent ${namespace === "" ? "bg-accent font-medium" : ""}`}
          >
            root
          </button>
          {isLoading ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">Loading…</p>
          ) : (
            options.map((ns) => (
              <button
                key={ns}
                onClick={() => choose(ns)}
                className={`rounded-md px-3 py-2 text-left text-sm hover:bg-accent ${namespace === ns ? "bg-accent font-medium" : ""}`}
              >
                {ns}
              </button>
            ))
          )}
        </div>

        <form
          className="mt-4 flex gap-2 border-t pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (manual.trim()) choose(manual.trim());
          }}
        >
          <Input
            placeholder="enter namespace path…"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
          />
          <Button type="submit" variant="outline">
            Go
          </Button>
        </form>
      </Dialog>
    </>
  );
}
