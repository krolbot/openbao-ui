import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { openbao } from "@/lib/openbao";
import { getToken } from "@/lib/session";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const token = await getToken();
  if (!token) redirect("/login");

  let displayName = "unknown";
  try {
    const lookup = await openbao.lookupSelf(token);
    displayName = lookup.data.display_name || "token";
  } catch {
    // Token no longer valid — bounce to login.
    redirect("/login");
  }

  return <AppShell displayName={displayName}>{children}</AppShell>;
}
