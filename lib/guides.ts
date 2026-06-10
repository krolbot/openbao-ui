// Pure templates for the in-app integration guides. Given a user's real
// environment (KV mount) + secret path + auth approach, produce copy-paste
// snippets for consuming the secret from their own app.
//
// In the single-image deployment OpenBao is reachable through the UI's own
// origin (the BFF proxies /v1/* to OpenBao), so `addr` is the browser origin.

export type GuideAuth = "token" | "approle";

export type GuideOptions = {
  addr: string; // e.g. https://bao.example.com  (the /v1 API lives under here)
  mount: string; // KV v2 mount, e.g. "secret"
  path: string; // secret path within the mount, e.g. "app/config"
  auth: GuideAuth;
};

export type Snippet = { id: string; label: string; lang: string; code: string };

const clean = (s: string) => s.replace(/^\/+|\/+$/g, "");

/**
 * Admin-side commands to create an **app identity** (an AppRole) — the answer to
 * "how does my service get a token in production?". Produces a scoped read
 * policy, an AppRole bound to it, and the role_id / secret_id the app logs in
 * with. The consumption side is covered by buildSnippets(auth: "approle").
 */
export function buildAppRoleSetup(opts: { mount: string; path: string; role?: string }): string {
  const mount = clean(opts.mount) || "secret";
  const path = clean(opts.path) || "app/config";
  const role =
    (opts.role || path.split("/")[0] || "app").replace(/[^a-zA-Z0-9_-]/g, "-") || "app";
  return `# Run once as an admin to mint a machine identity for your service.

# 1) A policy granting read on just this secret (least privilege):
bao policy write ${role}-read - <<'EOF'
path "${mount}/data/${path}" {
  capabilities = ["read"]
}
path "${mount}/metadata/${path}" {
  capabilities = ["read"]
}
EOF

# 2) Enable the AppRole auth method (no-op if already enabled):
bao auth enable approle 2>/dev/null || true

# 3) Create a role bound to that policy, issuing short-lived tokens:
bao write auth/approle/role/${role} \\
  token_policies="${role}-read" \\
  token_ttl=1h token_max_ttl=4h secret_id_ttl=24h

# 4) Hand these two values to your app (env vars / secret manager / CI):
bao read  auth/approle/role/${role}/role-id       # -> ROLE_ID   (stable, low-secrecy)
bao write -f auth/approle/role/${role}/secret-id  # -> SECRET_ID (sensitive — rotate)

# The app exchanges them for a short-lived token at auth/approle/login
# (see the snippets below) and renews/re-logs in before token_ttl expires.`;
}

export function buildSnippets(opts: GuideOptions): Snippet[] {
  const addr = opts.addr.replace(/\/+$/, "") || "https://openbao.example.com";
  const mount = clean(opts.mount) || "secret";
  const path = clean(opts.path) || "app/config";
  const dataPath = `${mount}/data/${path}`;
  const approle = opts.auth === "approle";

  const cliAuth = approle
    ? `# Authenticate with AppRole and capture the client token
export BAO_TOKEN=$(bao write -field=token auth/approle/login \\
  role_id="$ROLE_ID" secret_id="$SECRET_ID")`
    : `# Use an existing token (e.g. from \`bao login\`)
export BAO_TOKEN="s.your-token"`;

  const cli = `export BAO_ADDR="${addr}"
${cliAuth}

# Read the secret
bao kv get -mount=${mount} ${path}

# Read a single field
bao kv get -mount=${mount} -field=PASSWORD ${path}`;

  const curlAuth = approle
    ? `# Exchange AppRole credentials for a token
BAO_TOKEN=$(curl -s --request POST \\
  --data '{"role_id":"'"$ROLE_ID"'","secret_id":"'"$SECRET_ID"'"}' \\
  "$BAO_ADDR/v1/auth/approle/login" | jq -r '.auth.client_token')`
    : `BAO_TOKEN="s.your-token"`;

  const curl = `export BAO_ADDR="${addr}"
${curlAuth}

curl -s -H "X-Vault-Token: $BAO_TOKEN" \\
  "$BAO_ADDR/v1/${dataPath}" | jq '.data.data'`;

  const goAuth = approle
    ? `	// AppRole login (self-contained; no extra packages)
	login, err := client.Logical().WriteWithContext(ctx, "auth/approle/login", map[string]interface{}{
		"role_id":   os.Getenv("ROLE_ID"),
		"secret_id": os.Getenv("SECRET_ID"),
	})
	if err != nil { log.Fatal(err) }
	client.SetToken(login.Auth.ClientToken)`
    : `	client.SetToken(os.Getenv("BAO_TOKEN"))`;

  const go = `package main

import (
	"context"
	"fmt"
	"log"
	"os"

	bao "github.com/openbao/openbao/api/v2"
)

func main() {
	ctx := context.Background()
	cfg := bao.DefaultConfig()
	cfg.Address = "${addr}"
	client, err := bao.NewClient(cfg)
	if err != nil { log.Fatal(err) }
${goAuth}

	s, err := client.KVv2("${mount}").Get(ctx, "${path}")
	if err != nil { log.Fatal(err) }
	fmt.Printf("%v\\n", s.Data)
}`;

  const pyAuth = approle
    ? `client.auth.approle.login(role_id=os.environ["ROLE_ID"], secret_id=os.environ["SECRET_ID"])`
    : `client.token = os.environ["BAO_TOKEN"]`;

  const python = `import os
import hvac  # the Vault/OpenBao Python client

client = hvac.Client(url="${addr}")
${pyAuth}

resp = client.secrets.kv.v2.read_secret_version(
    mount_point="${mount}", path="${path}"
)
print(resp["data"]["data"])`;

  const nodeAuth = approle
    ? `await fetch(\`\${ADDR}/v1/auth/approle/login\`, {
  method: "POST",
  body: JSON.stringify({ role_id: process.env.ROLE_ID, secret_id: process.env.SECRET_ID }),
}).then((r) => r.json()).then((j) => j.auth.client_token)`
    : `process.env.BAO_TOKEN`;

  const node = `const ADDR = "${addr}";
const token = ${approle ? `await (async () => ${nodeAuth})()` : nodeAuth};

const res = await fetch(\`\${ADDR}/v1/${dataPath}\`, {
  headers: { "X-Vault-Token": token },
});
const { data } = await res.json();
console.log(data.data);`;

  const agent = `# openbao-agent.hcl — render the secret to a file, auto-renewed
vault { address = "${addr}" }

auto_auth {
  method "${approle ? "approle" : "token_file"}" {
    ${approle
      ? `config = {
      role_id_file_path   = "/etc/bao/role_id"
      secret_id_file_path = "/etc/bao/secret_id"
    }`
      : `config = { token_file_path = "/etc/bao/token" }`}
  }
}

template {
  destination = "/etc/app/config.env"
  contents    = <<-EOT
    {{- with secret "${dataPath}" }}
    {{- range $k, $v := .Data.data }}
    {{ $k }}={{ $v }}
    {{- end }}
    {{- end }}
  EOT
}`;

  return [
    { id: "cli", label: "CLI", lang: "bash", code: cli },
    { id: "curl", label: "curl", lang: "bash", code: curl },
    { id: "go", label: "Go", lang: "go", code: go },
    { id: "python", label: "Python", lang: "python", code: python },
    { id: "node", label: "Node.js", lang: "javascript", code: node },
    { id: "agent", label: "Agent", lang: "hcl", code: agent },
  ];
}
