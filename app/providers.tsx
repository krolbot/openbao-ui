"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";

import { ThemeProvider } from "@/components/theme";
import { NamespaceProvider } from "@/lib/namespace";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(
    () =>
      new QueryClient({
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
        <NamespaceProvider>{children}</NamespaceProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
