"use client";

import { Monitor, Moon, Sun } from "lucide-react";

import { ThemePref, useTheme } from "@/components/theme";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const OPTIONS: { value: ThemePref; label: string; icon: React.ElementType }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

export default function PreferencesPage() {
  const { theme, setTheme } = useTheme();

  function reset() {
    try {
      localStorage.removeItem("theme");
      document.cookie = "bao_ns=; path=/; max-age=0";
    } catch {
      /* ignore */
    }
    location.reload();
  }

  return (
    <div className="mx-auto max-w-2xl p-8">
      <section className="rounded-xl border p-6">
        <h2 className="text-sm font-medium">Theme</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Choose how the UI looks. &quot;System&quot; follows your OS setting.
        </p>
        <div className="grid grid-cols-3 gap-3">
          {OPTIONS.map(({ value, label, icon: Icon }) => {
            const active = theme === value;
            return (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-lg border p-4 text-sm transition-colors hover:bg-accent",
                  active ? "border-primary bg-accent font-medium" : "text-muted-foreground",
                )}
              >
                <Icon className="size-5" />
                {label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-4 rounded-xl border p-6">
        <h2 className="text-sm font-medium">Local data</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Preferences (theme, selected namespace) are stored only in your browser.
          This does not affect your OpenBao session.
        </p>
        <Button variant="outline" size="sm" onClick={reset}>
          Reset local preferences
        </Button>
      </section>
    </div>
  );
}
