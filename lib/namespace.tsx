"use client";

import * as React from "react";

// Current namespace is held in React context and mirrored to a readable cookie
// so it survives reloads. It is sent as the X-Vault-Namespace header on every
// BFF call (see lib/bao-client.ts) and forwarded to OpenBao by the proxy.
const NS_COOKIE = "bao_ns";

type NamespaceContextValue = {
  namespace: string; // "" == root
  setNamespace: (ns: string) => void;
};

const NamespaceContext = React.createContext<NamespaceContextValue | null>(null);

function readCookie(name: string): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(
    new RegExp("(?:^|; )" + name + "=([^;]*)"),
  );
  return match ? decodeURIComponent(match[1]) : "";
}

export function NamespaceProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [namespace, setNamespaceState] = React.useState<string>(() =>
    readCookie(NS_COOKIE),
  );

  const setNamespace = React.useCallback((ns: string) => {
    const clean = ns.replace(/^\/+|\/+$/g, "");
    setNamespaceState(clean);
    // 30-day persistence; not httpOnly because the client needs to read it.
    document.cookie = `${NS_COOKIE}=${encodeURIComponent(clean)}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
  }, []);

  return (
    <NamespaceContext.Provider value={{ namespace, setNamespace }}>
      {children}
    </NamespaceContext.Provider>
  );
}

export function useNamespace() {
  const ctx = React.useContext(NamespaceContext);
  if (!ctx)
    throw new Error("useNamespace must be used within <NamespaceProvider>");
  return ctx;
}

export { NS_COOKIE };
