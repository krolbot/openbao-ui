"use client";

import { Key, Plus, Trash2 } from "lucide-react";
import * as React from "react";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { CopyButton } from "@/components/copy-button";
import { Button } from "@/components/ui/button";
import { Dialog, DialogHeader } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BaoError } from "@/lib/bao-client";
import {
  AuthMount,
  useApproleRoleId,
  useApproleRoles,
  useAuthMethods,
  useCreateApproleRole,
  useCreateUserpassUser,
  useDeleteApproleRole,
  useDeleteUserpassUser,
  useDisableAuth,
  useEnableAuth,
  useGenerateSecretId,
  useUserpassUsers,
} from "@/lib/auth-methods";

const ENABLE_TYPES = ["userpass", "approle", "ldap", "jwt", "oidc", "cert", "kubernetes", "radius"];
const errMsg = (e: unknown) =>
  e instanceof BaoError ? e.errors.join(", ") : "Something went wrong";

export default function AuthMethodsPage() {
  const methods = useAuthMethods();
  const [selected, setSelected] = React.useState<AuthMount | null>(null);
  const [enabling, setEnabling] = React.useState(false);
  const [disabling, setDisabling] = React.useState<AuthMount | null>(null);
  const disable = useDisableAuth();

  const current =
    methods.data?.find((m) => m.path === selected?.path) ?? null;

  return (
    <div className="flex h-full">
      <div className="w-72 shrink-0 overflow-auto border-r p-3">
        <Button size="sm" className="mb-2 w-full" onClick={() => setEnabling(true)}>
          <Plus /> Enable method
        </Button>
        {methods.isLoading ? (
          <p className="p-2 text-sm text-muted-foreground">Loading…</p>
        ) : methods.isError ? (
          <p className="p-2 text-sm text-destructive">{errMsg(methods.error)}</p>
        ) : (
          <ul>
            {(methods.data ?? []).map((mth) => (
              <li key={mth.path}>
                <button
                  onClick={() => setSelected(mth)}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent ${
                    current?.path === mth.path ? "bg-accent" : ""
                  }`}
                >
                  <Key className="size-4 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono">{mth.path}</span>
                    <span className="block text-xs text-muted-foreground">{mth.type}</span>
                  </span>
                  {mth.path !== "token/" ? (
                    <span
                      role="button"
                      title="Disable"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDisabling(mth);
                      }}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="min-w-0 flex-1 overflow-auto p-6">
        {!current ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Select an auth method, or enable a new one.
          </div>
        ) : (
          <MethodConfig method={current} />
        )}
      </div>

      {enabling ? (
        <EnableDialog
          onClose={() => setEnabling(false)}
          onEnabled={(p) => {
            setEnabling(false);
            const found = methods.data?.find((m) => m.path === p);
            if (found) setSelected(found);
          }}
        />
      ) : null}

      <ConfirmDialog
        open={!!disabling}
        onClose={() => setDisabling(null)}
        onConfirm={async () => {
          await disable.mutateAsync(disabling!.path);
          if (selected?.path === disabling!.path) setSelected(null);
          setDisabling(null);
        }}
        title={`Disable ${disabling?.path}?`}
        description="Tokens issued via this method will stop working."
        confirmText={disabling?.path.replace(/\/$/, "")}
        confirmLabel="Disable method"
        pending={disable.isPending}
      />
    </div>
  );
}

function MethodConfig({ method }: { method: AuthMount }) {
  return (
    <div>
      <div className="mb-6">
        <h2 className="font-mono text-lg font-semibold">{method.path}</h2>
        <p className="text-sm text-muted-foreground">
          type <span className="font-medium text-foreground">{method.type}</span>
          {method.description ? ` · ${method.description}` : ""}
        </p>
      </div>
      {method.type === "userpass" ? (
        <UserpassConfig mount={method.path} />
      ) : method.type === "approle" ? (
        <ApproleConfig mount={method.path} />
      ) : (
        <p className="text-sm text-muted-foreground">
          Dedicated configuration UI for <span className="font-mono">{method.type}</span> is coming
          in a later phase. The method is enabled and usable via the API/CLI.
        </p>
      )}
    </div>
  );
}

// --- userpass: users ---
function UserpassConfig({ mount }: { mount: string }) {
  const users = useUserpassUsers(mount);
  const create = useCreateUserpassUser(mount);
  const del = useDeleteUserpassUser(mount);
  const [open, setOpen] = React.useState(false);
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [policies, setPolicies] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium">Users</h3>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          <Plus /> Add user
        </Button>
      </div>
      <ul className="divide-y rounded-md border">
        {(users.data ?? []).map((u) => (
          <li key={u} className="flex items-center justify-between px-3 py-2 text-sm">
            <span className="font-mono">{u}</span>
            <Button variant="ghost" size="icon" title="Delete" onClick={() => del.mutate(u)}>
              <Trash2 />
            </Button>
          </li>
        ))}
        {users.data?.length === 0 ? (
          <li className="px-3 py-6 text-center text-sm text-muted-foreground">No users yet.</li>
        ) : null}
      </ul>

      {open ? (
        <Dialog open onClose={() => setOpen(false)}>
          <DialogHeader title="Add user" onClose={() => setOpen(false)} />
          <form
            className="flex flex-col gap-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setError(null);
              try {
                await create.mutateAsync({
                  username: username.trim(),
                  password,
                  policies: policies ? policies.split(",").map((p) => p.trim()).filter(Boolean) : [],
                });
                setOpen(false);
                setUsername("");
                setPassword("");
                setPolicies("");
              } catch (err) {
                setError(errMsg(err));
              }
            }}
          >
            <Field label="Username">
              <Input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
            </Field>
            <Field label="Password">
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            <Field label="Token policies (comma-separated)">
              <Input value={policies} onChange={(e) => setPolicies(e.target.value)} className="font-mono" placeholder="default" />
            </Field>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={create.isPending}>Add</Button>
            </div>
          </form>
        </Dialog>
      ) : null}
    </div>
  );
}

// --- approle: roles + role-id / secret-id ---
function ApproleConfig({ mount }: { mount: string }) {
  const roles = useApproleRoles(mount);
  const create = useCreateApproleRole(mount);
  const del = useDeleteApproleRole(mount);
  const roleId = useApproleRoleId();
  const secretId = useGenerateSecretId();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [policies, setPolicies] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [creds, setCreds] = React.useState<{ role: string; roleId?: string; secretId?: string } | null>(null);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium">Roles</h3>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          <Plus /> Add role
        </Button>
      </div>
      <ul className="divide-y rounded-md border">
        {(roles.data ?? []).map((r) => (
          <li key={r} className="flex items-center justify-between px-3 py-2 text-sm">
            <span className="font-mono">{r}</span>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  const id = await roleId.mutateAsync({ mount, role: r });
                  setCreds({ role: r, roleId: id });
                }}
              >
                Get role-id
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  const sid = await secretId.mutateAsync({ mount, role: r });
                  setCreds((c) => ({ role: r, roleId: c?.role === r ? c.roleId : undefined, secretId: sid }));
                }}
              >
                Generate secret-id
              </Button>
              <Button variant="ghost" size="icon" title="Delete" onClick={() => del.mutate(r)}>
                <Trash2 />
              </Button>
            </div>
          </li>
        ))}
        {roles.data?.length === 0 ? (
          <li className="px-3 py-6 text-center text-sm text-muted-foreground">No roles yet.</li>
        ) : null}
      </ul>

      {creds ? (
        <div className="mt-4 rounded-md border bg-muted/40 p-3">
          <div className="mb-2 text-sm font-medium">Credentials for {creds.role}</div>
          {creds.roleId ? (
            <CredRow label="role_id" value={creds.roleId} />
          ) : null}
          {creds.secretId ? (
            <CredRow label="secret_id" value={creds.secretId} />
          ) : null}
          <p className="mt-2 text-xs text-muted-foreground">
            Use these with the AppRole login method. The secret_id is shown once.
          </p>
        </div>
      ) : null}

      {open ? (
        <Dialog open onClose={() => setOpen(false)}>
          <DialogHeader title="Add role" onClose={() => setOpen(false)} />
          <form
            className="flex flex-col gap-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setError(null);
              try {
                await create.mutateAsync({
                  name: name.trim(),
                  policies: policies ? policies.split(",").map((p) => p.trim()).filter(Boolean) : [],
                });
                setOpen(false);
                setName("");
                setPolicies("");
              } catch (err) {
                setError(errMsg(err));
              }
            }}
          >
            <Field label="Role name">
              <Input value={name} onChange={(e) => setName(e.target.value)} className="font-mono" autoFocus />
            </Field>
            <Field label="Token policies (comma-separated)">
              <Input value={policies} onChange={(e) => setPolicies(e.target.value)} className="font-mono" placeholder="default" />
            </Field>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={create.isPending}>Add</Button>
            </div>
          </form>
        </Dialog>
      ) : null}
    </div>
  );
}

function CredRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="w-20 text-xs text-muted-foreground">{label}</span>
      <code className="min-w-0 flex-1 truncate text-sm">{value}</code>
      <CopyButton value={value} />
    </div>
  );
}

function EnableDialog({
  onClose,
  onEnabled,
}: {
  onClose: () => void;
  onEnabled: (path: string) => void;
}) {
  const enable = useEnableAuth();
  const [type, setType] = React.useState("userpass");
  const [path, setPath] = React.useState("userpass");
  const [error, setError] = React.useState<string | null>(null);

  return (
    <Dialog open onClose={onClose}>
      <DialogHeader title="Enable auth method" onClose={onClose} />
      <form
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          try {
            await enable.mutateAsync({ path: path.trim(), type });
            onEnabled(`${path.trim()}/`);
          } catch (err) {
            setError(errMsg(err));
          }
        }}
      >
        <Field label="Type">
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setPath(e.target.value);
            }}
            className="h-9 rounded-md border bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {ENABLE_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field label="Mount path">
          <Input value={path} onChange={(e) => setPath(e.target.value)} className="font-mono" />
        </Field>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={enable.isPending}>Enable</Button>
        </div>
      </form>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
