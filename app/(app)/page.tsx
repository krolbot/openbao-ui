"use client";

import {
  ChevronRight,
  KeyRound,
  Lock,
  ShieldCheck,
  Unlock,
  Users,
} from "lucide-react";
import Link from "next/link";

import { Disclosure } from "@/components/ui/disclosure";
import { useResultantAcl } from "@/lib/acl";
import { useAuthMethods } from "@/lib/auth-methods";
import { useSession } from "@/lib/auth-hooks";
import { usePolicies } from "@/lib/access";
import { useMounts } from "@/lib/kv";
import { useSealStatus } from "@/lib/system";

export default function OverviewPage() {
  const seal = useSealStatus();
  const session = useSession();
  const mounts = useMounts();
  const auth = useAuthMethods();
  const policies = usePolicies();
  const acl = useResultantAcl();

  const sealed = seal.data?.sealed;

  return (
    <div className="mx-auto max-w-5xl p-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="text-muted-foreground">Your OpenBao at a glance.</p>
      </header>

      {/* hero: the two things you check first */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border p-5">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">
              Status
            </span>
            {sealed ? (
              <Lock className="size-4 text-destructive" />
            ) : (
              <Unlock className="size-4 text-emerald-500" />
            )}
          </div>
          <div className="text-2xl font-semibold">
            {seal.isLoading
              ? "…"
              : seal.isError
                ? "Unreachable"
                : sealed
                  ? "Sealed"
                  : "Unsealed"}
          </div>
          {seal.data ? (
            <p className="text-xs text-muted-foreground">
              v{seal.data.version} · {seal.data.type}
            </p>
          ) : null}
        </div>

        <div className="rounded-xl border p-5">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">
              Signed in as
            </span>
            <ShieldCheck className="size-4 text-muted-foreground" />
          </div>
          <div className="truncate text-2xl font-semibold">
            {session.data?.displayName ?? "…"}
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            {(session.data?.policies ?? []).map((p) => (
              <span
                key={p}
                className="rounded bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground"
              >
                {p}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* quick stats — each links you to the section */}
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <StatTile
          label="Secret engines"
          icon={<KeyRound className="size-4" />}
          value={mounts.isError ? null : Object.keys(mounts.data ?? {}).length}
          href="/secrets"
          loading={mounts.isLoading}
        />
        <StatTile
          label="Auth methods"
          icon={<Users className="size-4" />}
          value={auth.isError ? null : (auth.data?.length ?? null)}
          href="/access/auth"
          loading={auth.isLoading}
        />
        <StatTile
          label="Policies"
          icon={<ShieldCheck className="size-4" />}
          value={policies.isError ? null : (policies.data?.length ?? null)}
          href="/access"
          loading={policies.isLoading}
        />
      </div>

      {/* depth on demand */}
      <div className="mt-4">
        <Disclosure label="System details">
          <dl className="grid grid-cols-[10rem_1fr] gap-y-2 text-sm">
            <Detail k="Version" v={seal.data?.version} />
            <Detail k="Seal type" v={seal.data?.type} />
            <Detail
              k="Initialized"
              v={seal.data ? String(seal.data.initialized) : undefined}
            />
            <Detail k="Cluster" v={seal.data?.cluster_name || "—"} />
            <Detail
              k="Token access"
              v={acl.data?.root ? "root (full access)" : "scoped by policy"}
            />
          </dl>
        </Disclosure>
      </div>
    </div>
  );
}

function StatTile({
  label,
  icon,
  value,
  href,
  loading,
}: {
  label: string;
  icon: React.ReactNode;
  value: number | null;
  href: string;
  loading: boolean;
}) {
  const denied = value === null && !loading;
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-xl border p-4 transition-colors hover:bg-accent"
    >
      <div className="flex size-9 items-center justify-center rounded-md bg-secondary text-muted-foreground">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-2xl font-semibold">
          {loading ? "…" : denied ? "—" : value}
        </div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
      <ChevronRight className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </Link>
  );
}

function Detail({ k, v }: { k: string; v?: string }) {
  return (
    <>
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="font-mono">{v ?? "—"}</dd>
    </>
  );
}
