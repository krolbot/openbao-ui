// Pure ACL-policy generator for "scoped access roles" — the mechanism behind
// shareable env groups and app-specific groups. Given a set of resolved
// environments × an optional app × a capability level, it emits OpenBao ACL
// HCL over the KV v2 data/metadata paths. No I/O — easy to unit-test and shown
// to the operator before it's written.
//
// Supports both physical layouts:
//   - mount per environment:        { mount: "prod" }              -> prod/data/<app>/*
//   - single mount with env folders:{ mount: "secret", envPath: "prod" } -> secret/data/prod/<app>/*

export type AccessLevel = "viewer" | "editor" | "admin";

/** A resolved environment target. `envPath` is the env folder for the
 *  single-mount layout; omit it when each environment is its own mount. */
export type EnvTarget = { mount: string; envPath?: string };

export type AccessScope = {
  envs: EnvTarget[];
  app?: string; // app folder; omit/empty = all apps in the environment
  level: AccessLevel;
};

const strip = (s: string) => s.replace(/^\/+|\/+$/g, "");
// Strip anything that isn't path-safe (notably `"` and newlines) so the
// user-editable mount / env / app names can't break out of the quoted HCL
// string and inject extra `path` blocks. The UI already constrains these, but
// the generator must never emit unsafe HCL. Slashes are kept — they're path
// separators (nested mounts).
const safe = (s: string) => s.replace(/[^A-Za-z0-9._\-/]/g, "");
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
 * Build an ACL policy (HCL) for a scoped access role. Paths are de-duplicated
 * and stably ordered. When an `app` is set the grant starts at the app folder
 * (so sibling apps' names aren't even listable); without an app it spans the
 * whole environment.
 */
export function buildAccessPolicy(scope: AccessScope): string {
  const app = scope.app ? safe(strip(scope.app)) : "";
  const tail = app ? `${app}/*` : `*`;

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
    add(`${dataPrefix}/${tail}`, DATA_CAPS[scope.level]);
    add(`${metaPrefix}/${tail}`, META_CAPS[scope.level]);
    // Allow listing the scoped folder node itself so the UI can browse into it
    // (the app folder when app-scoped, or the env root for a whole-env grant).
    add(app ? `${metaPrefix}/${app}` : metaPrefix, ["list"]);
  }

  const where = scope.envs
    .map((e) => seg(e.mount, e.envPath) || strip(e.mount))
    .join(", ");
  const header =
    `# scoped access — level: ${scope.level}` +
    `${app ? `, app: ${app}` : ", all apps"}\n` +
    `# environments: ${where}`;

  return `${header}\n${blocks.join("\n")}\n`;
}
