"use client";

import { CheckCircle2, X, XCircle } from "lucide-react";
import * as React from "react";

import { usePreferences } from "@/lib/preferences";
import { toast, ToastItem } from "@/lib/toast";
import { cn } from "@/lib/utils";

export function Toaster() {
  const [items, setItems] = React.useState<ToastItem[]>([]);
  const { prefs } = usePreferences();
  // read the latest duration without re-subscribing on every change
  const durationRef = React.useRef(prefs.toastDurationMs);
  durationRef.current = prefs.toastDurationMs;

  React.useEffect(() => {
    return toast.subscribe((item) => {
      setItems((prev) => [...prev, item]);
      setTimeout(() => {
        setItems((prev) => prev.filter((i) => i.id !== item.id));
      }, durationRef.current);
    });
  }, []);

  const dismiss = (id: number) =>
    setItems((prev) => prev.filter((i) => i.id !== id));

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          role="status"
          className={cn(
            "pointer-events-auto flex items-start gap-2.5 rounded-xl border bg-card p-3 text-sm shadow-lg duration-200 animate-in slide-in-from-bottom-3 fade-in-0",
            t.kind === "error" ? "border-destructive/40" : "border-emerald-500/40",
          )}
        >
          {t.kind === "error" ? (
            <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
          ) : (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />
          )}
          <span className="min-w-0 flex-1 break-words">{t.message}</span>
          <button
            onClick={() => dismiss(t.id)}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Dismiss"
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
