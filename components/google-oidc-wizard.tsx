"use client";

import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogHeader } from "@/components/ui/dialog";
import { Disclosure } from "@/components/ui/disclosure";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { baoFetch, BaoError } from "@/lib/bao-client";
import { useNamespace } from "@/lib/namespace";
import { oidcCallbackUrl, useSetUiConfig, useUiConfig } from "@/lib/ui-config";

// One-click-ish setup for "Sign in with Google" on top of OpenBao's native
// OIDC method. Composes the primitives: enable the mount, write provider config
// (Google discovery), create a default JIT role wired to this app's callback,
// surface the method on the login page (listing_visibility=unauth), and record
// it as the default login method in the UI config.
const GOOGLE_DISCOVERY = "https://accounts.google.com";

const errMsg = (e: unknown) =>
  e instanceof BaoError ? e.errors.join(", ") : e instanceof Error ? e.message : "Something went wrong";

export function GoogleOidcWizard({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: () => void;
}) {
  const { namespace } = useNamespace();
  const setUiConfig = useSetUiConfig();
  const uiConfig = useUiConfig();
  const qc = useQueryClient();

  const [clientId, setClientId] = React.useState("");
  const [clientSecret, setClientSecret] = React.useState("");
  const [policies, setPolicies] = React.useState("default");
  const [mount, setMount] = React.useState("oidc");
  const [role, setRole] = React.useState("default");
  const [groupsClaim, setGroupsClaim] = React.useState("");
  const [makeDefault, setMakeDefault] = React.useState(true);

  const [busy, setBusy] = React.useState(false);
  const [step, setStep] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  // Prefer the OPENBAO_UI_PUBLIC_URL override (if configured) so the role's
  // allowed_redirect_uris matches the redirect_uri the login route will send.
  const redirectUri = oidcCallbackUrl(uiConfig.data?.publicUrl);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!clientId.trim() || !clientSecret.trim()) {
      setError("Client ID and secret are required");
      return;
    }
    const m = mount.trim().replace(/\/$/, "") || "oidc";
    const r = role.trim() || "default";
    setBusy(true);
    try {
      // 1. enable the OIDC auth mount (ignore "already in use")
      setStep("Enabling the OIDC method…");
      try {
        await baoFetch({
          path: `sys/auth/${m}`,
          method: "POST",
          namespace,
          body: { type: "oidc", description: "Sign in with Google" },
        });
      } catch (err) {
        if (!(err instanceof BaoError && /already in use|path is already/i.test(err.errors.join(" ")))) {
          throw err;
        }
      }

      // 2. provider config (Google discovery). OpenBao validates the discovery
      //    URL here, so this step needs outbound access to accounts.google.com.
      setStep("Configuring the Google provider…");
      await baoFetch({
        path: `auth/${m}/config`,
        method: "POST",
        namespace,
        body: {
          oidc_discovery_url: GOOGLE_DISCOVERY,
          oidc_client_id: clientId.trim(),
          oidc_client_secret: clientSecret.trim(),
          default_role: r,
        },
      });

      // 3. default JIT role — Google users authenticate into this role
      setStep("Creating the default sign-in role…");
      await baoFetch({
        path: `auth/${m}/role/${r}`,
        method: "POST",
        namespace,
        body: {
          role_type: "oidc",
          user_claim: "email",
          oidc_scopes: ["openid", "email", "profile"],
          allowed_redirect_uris: [redirectUri],
          token_policies: policies
            .split(",")
            .map((p) => p.trim())
            .filter(Boolean),
          ...(groupsClaim.trim() ? { groups_claim: groupsClaim.trim() } : {}),
        },
      });

      // 4. surface it on the (unauthenticated) login page
      setStep("Showing it on the login page…");
      await baoFetch({
        path: `sys/auth/${m}/tune`,
        method: "POST",
        namespace,
        body: { listing_visibility: "unauth", description: "Sign in with Google" },
      });

      // 5. record it as the default method in the UI config
      if (makeDefault) {
        setStep("Saving UI preferences…");
        await setUiConfig.mutateAsync({ defaultLoginMethod: m });
      }

      qc.invalidateQueries({ queryKey: ["auth-methods", namespace] });
      setStep(null);
      setDone(true);
    } catch (err) {
      setError(errMsg(err));
      setStep(null);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <Dialog open onClose={onDone}>
        <DialogHeader title="Google sign-in is ready" onClose={onDone} />
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3 rounded-md border bg-emerald-500/10 p-3 text-sm">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
            <div>
              Users can now choose <strong>Sign in with Google</strong> on the login
              page. New users are provisioned automatically into the
              <span className="font-mono"> {role || "default"}</span> role.
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={onDone}>Done</Button>
          </div>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog open onClose={onClose} className="max-w-lg">
      <DialogHeader
        title="Set up Google sign-in"
        description="Create a Google OAuth client (Authorized redirect URI below), then paste its credentials here."
        onClose={onClose}
      />
      <form className="flex flex-col gap-4" onSubmit={submit}>
        <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-2 text-xs">
          <span className="shrink-0 text-muted-foreground">Redirect URI</span>
          <code className="min-w-0 flex-1 truncate">{redirectUri}</code>
        </div>

        <Field label="Client ID">
          <Input value={clientId} onChange={(e) => setClientId(e.target.value)} className="font-mono" autoFocus />
        </Field>
        <Field label="Client secret">
          <Input type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} className="font-mono" />
        </Field>
        <Field label="Default token policies (comma-separated)">
          <Input value={policies} onChange={(e) => setPolicies(e.target.value)} className="font-mono" placeholder="default" />
        </Field>

        <Disclosure label="Advanced">
          <div className="flex flex-col gap-3">
            <Field label="Mount path">
              <Input value={mount} onChange={(e) => setMount(e.target.value)} className="font-mono" />
            </Field>
            <Field label="Role name">
              <Input value={role} onChange={(e) => setRole(e.target.value)} className="font-mono" />
            </Field>
            <Field label="Groups claim (optional)">
              <Input value={groupsClaim} onChange={(e) => setGroupsClaim(e.target.value)} className="font-mono" placeholder="groups" />
            </Field>
          </div>
        </Disclosure>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={makeDefault} onChange={(e) => setMakeDefault(e.target.checked)} />
          Make Google the default sign-in method
        </label>

        {step ? <p className="text-sm text-muted-foreground">{step}</p> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="flex justify-end gap-2 border-t pt-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Setting up…" : "Set up Google sign-in"}
          </Button>
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
