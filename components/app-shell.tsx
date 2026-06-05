import { AppSidebar } from "@/components/app-sidebar";

export function AppShell({
  displayName,
  children,
}: {
  displayName: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh">
      <AppSidebar displayName={displayName} />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
