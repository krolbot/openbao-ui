"use client";

import {
  MutationCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import * as React from "react";

import { ThemeProvider } from "@/components/theme";
import { Toaster } from "@/components/toaster";
import { BaoError } from "@/lib/bao-client";
import { NamespaceProvider } from "@/lib/namespace";
import { PreferencesProvider } from "@/lib/preferences";
import { toast } from "@/lib/toast";

function formatError(err: unknown): string {
  if (err instanceof BaoError) return err.errors.join(", ");
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(
    () =>
      new QueryClient({
        // App-wide mutation feedback: every failed mutation surfaces an error
        // toast (unless it opts out with meta.silentError, e.g. forms that show
        // inline errors); successes show a toast when they set meta.success.
        mutationCache: new MutationCache({
          onError: (err, _vars, _ctx, mutation) => {
            if (mutation.meta?.silentError) return;
            toast.error(formatError(err));
          },
          onSuccess: (_data, _vars, _ctx, mutation) => {
            const msg = mutation.meta?.success;
            if (typeof msg === "string") toast.success(msg);
          },
        }),
        defaultOptions: {
          queries: {
            staleTime: 5_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <PreferencesProvider>
          <NamespaceProvider>{children}</NamespaceProvider>
          <Toaster />
        </PreferencesProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
