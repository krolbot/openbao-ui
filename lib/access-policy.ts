// Pure ACL-policy generator for scoped access. Given a set of resolved
// environments × the secret paths a client may touch × a capability level, it
// emits native OpenBao ACL HCL over the KV v2 data/metadata paths. No I/O — easy
// to unit-test and shown to the operator before it's written.
//
// Paths are env-relative suffixes that map 1:1 to policy paths:
//   "backend/*"            -> <mount>/data/backend/*        (a folder, recursive)
//   "shared/stripe/config" -> <mount>/data/shared/stripe/config  (one secret)
//   "*"                    -> <mount>/data/*                (the whole environment)
//
// Supports both physical layouts:
//   - mount per environment:        { mount: "prod" }                    -> prod/data/<p>
//   - single mount with env folders:{ mount: "secret", envPath: "prod" } -> secret/data/prod/<p>

export type AccessLevel = "viewer" | "editor" | "admin";

/** A resolved environment target. `envPath` is the env folder for the
 *  single-mount layout; omit it when each environment is its own mount. */
export type EnvTarget = { mount: string; envPath?: string };

export type AccessScope = {
  envs: EnvTarget[];
  level: AccessLevel;
  paths?: string[]; // env-relative path suffixes; empty = whole environment ("*")
};

const strip = (s: string) => s.replace(/^\/+|\/+$/g, "");
// Strip anything that isn't path-safe (notably `"` and newlines) so a
// user-editable mount / env name can't break out of the quoted HCL string and
// inject extra `path` blocks. Slashes are kept (path separators).
const safe = (s: string) => s.replace(/[^A-Za-z0-9._\-/]/g, "");
// Like `safe`, but for the selected path suffix where `*` and `+` are legitimate
// OpenBao glob wildcards.
const safePath = (s: string) => strip(s).replace(/[^A-Za-z0-9._\-/*+]/g, "");
const seg = (...parts: (string | undefined)[]) =>
  parts
    .map((p) => safe(strip(p ?? "")))
    .filter(Boolean)
    .join("/");

// KV v2 secret data lives under <mount>/data/..., listing/versioning under
// <mount>/metadata/.... Editors get full CRUD on data; metadata stays read/list
// (browse + version history) except for admins who can purge it.
const DATA_CAPS: Record<AccessLevel, string[]> = {
  viewer: ["read", "list"],
  editor: ["create", "read", "update", "delete", "list"],
  admin: ["create", "read", "update", "delete", "list", "sudo"],
};
const META_CAPS: Record<AccessLevel, string[]> = {
  viewer: ["read", "list"],
  editor: ["read", "list"],
  admin: ["create", "read", "update", "delete", "list"],
};

const capsList = (c: string[]) => c.map((x) => `"${x}"`).join(", ");

/**
 * Build an ACL policy (HCL) granting `level` on the chosen `paths` within each
 * environment. Paths are de-duplicated and stably ordered. Empty `paths` grants
 * the whole environment.
 */
export function buildAccessPolicy(scope: AccessScope): string {
  const paths = (scope.paths ?? []).map(safePath).filter(Boolean);
  const list = paths.length ? paths : ["*"];

  const blocks: string[] = [];
  const seen = new Set<string>();
  const add = (path: string, caps: string[]) => {
    if (seen.has(path)) return;
    seen.add(path);
    blocks.push(`path "${path}" {\n  capabilities = [${capsList(caps)}]\n}`);
  };

  for (const env of scope.envs) {
    const dataPrefix = seg(env.mount, "data", env.envPath);
    const metaPrefix = seg(env.mount, "metadata", env.envPath);
    for (const p of list) {
      add(`${dataPrefix}/${p}`, DATA_CAPS[scope.level]);
      add(`${metaPrefix}/${p}`, META_CAPS[scope.level]);
    }
  }

  const where = scope.envs
    .map((e) => seg(e.mount, e.envPath) || strip(e.mount))
    .join(", ");
  const header =
    `# scoped access — level: ${scope.level}, paths: ${list.join(" ")}\n` +
    `# environments: ${where}`;

  return `${header}\n${blocks.join("\n")}\n`;
}
