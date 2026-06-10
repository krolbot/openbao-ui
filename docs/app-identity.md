# Giving your app an identity (how it gets a token in production)

You should **never** ship a human/root token with your app. Instead you mint a
**machine identity** that logs in at runtime and gets a short‑lived token scoped
to exactly the secrets it needs. The standard mechanism in OpenBao is
**AppRole**: your app presents a `role_id` (stable, like a username) and a
`secret_id` (sensitive, like a password) and receives a token in return.

> In the UI this is generated for you: **Guides → Authentication: AppRole** shows
> these exact commands wired to the environment + secret path you pick, plus the
> code to read the secret from your app.

## 1. Create the identity (run once, as an admin)

```bash
# A policy granting read on just the secret(s) this app needs:
bao policy write payments-read - <<'EOF'
path "prod/data/payments/*" {
  capabilities = ["read"]
}
path "prod/metadata/payments/*" {
  capabilities = ["read"]
}
EOF

# Enable AppRole once:
bao auth enable approle 2>/dev/null || true

# A role bound to that policy, issuing short-lived tokens:
bao write auth/approle/role/payments \
  token_policies="payments-read" \
  token_ttl=1h token_max_ttl=4h secret_id_ttl=24h

# The two credentials your app needs:
bao read  auth/approle/role/payments/role-id       # -> ROLE_ID
bao write -f auth/approle/role/payments/secret-id  # -> SECRET_ID
```

## 2. Log in from your app

Give the app `ROLE_ID` and `SECRET_ID` via environment variables, your platform's
secret store, or your CI's secret injection — **not** committed to git. The app
exchanges them for a token:

```bash
export BAO_ADDR="https://bao.example.com"
export BAO_TOKEN=$(bao write -field=token auth/approle/login \
  role_id="$ROLE_ID" secret_id="$SECRET_ID")

bao kv get -mount=prod payments
```

(See **Guides** in the UI for Go / Python / Node / curl / OpenBao Agent versions.)

## Production tips

- **Least privilege** — one role per app, policy scoped to just its paths.
- **Short TTLs** — keep `token_ttl` small; have the app re-login or renew before
  expiry. OpenBao Agent (the `agent` snippet in Guides) automates this and
  renders secrets to a file.
- **Protect the `secret_id`** — it's the sensitive half. Prefer delivering it
  through your platform (Kubernetes, Nomad, cloud secret managers) and rotate it
  (`secret_id_ttl`, `secret_id_num_uses`). The `role_id` is far less sensitive.
- **Response wrapping / push secret_id** — for higher security you can have a
  trusted orchestrator fetch a *wrapped* `secret_id` and hand the app only the
  single‑use unwrap token.
- **CI/CD** is just another app identity — give your pipeline its own AppRole
  with a tightly scoped policy.

## Alternatives

- **Kubernetes / JWT / OIDC auth** — if your app runs on k8s or a cloud with
  workload identity, those methods let the platform vouch for the app so you
  don't manage a `secret_id` at all. Enable them under **Access → Auth methods**.
- **Tokens** — fine for local dev and quick scripts (`bao login`), not for
  long‑running services.
