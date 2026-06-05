/**
 * Embedded SQLite store for UI-only metadata that OpenBao does not model.
 *
 * This is the BFF's small stateful layer. It holds NON-SECRET presentation and
 * configuration data — friendly "nicer naming" labels for namespaces / mounts /
 * paths, and UI config (branding, login customization). Secrets, identity and
 * all real authorization stay native to OpenBao.
 *
 * Server-only: imported exclusively by route handlers (Node runtime). The file
 * lives on the same writable volume as OpenBao's storage (default
 * /bao/file/ui.db); override with UI_DB_PATH (":memory:" is honored for tests).
 *
 * Uses Node's built-in `node:sqlite` (no native dependency, no extra image
 * layers). Available unflagged on the Node 22 the runtime image ships.
 */
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

export type LabelScope = "workspace" | "environment" | "application";

/** A friendly-naming row keyed to a native OpenBao path. */
export type Label = {
  namespace: string; // OpenBao namespace the ref lives in ("" = root)
  scope: LabelScope; // workspace=namespace, environment=mount, application=path
  ref: string; // the native key (namespace path, mount path, or app path)
  label: string | null;
  description: string | null;
  color: string | null;
  env_group: string | null; // e.g. "dev" | "staging" | "prod" for environments
  updated_at: number;
};

function dbPath(): string {
  return process.env.UI_DB_PATH ?? "/bao/file/ui.db";
}

let _db: DatabaseSync | null = null;

function db(): DatabaseSync {
  if (_db) return _db;
  const path = dbPath();
  if (path !== ":memory:") {
    try {
      mkdirSync(dirname(path), { recursive: true });
    } catch {
      // directory already exists / not creatable — let the open call surface it
    }
  }
  const d = new DatabaseSync(path);
  d.exec(
    "PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;",
  );
  migrate(d);
  _db = d;
  return d;
}

function migrate(d: DatabaseSync) {
  d.exec(`
    CREATE TABLE IF NOT EXISTS labels (
      namespace   TEXT NOT NULL,
      scope       TEXT NOT NULL,
      ref         TEXT NOT NULL,
      label       TEXT,
      description TEXT,
      color       TEXT,
      env_group   TEXT,
      updated_at  INTEGER NOT NULL,
      PRIMARY KEY (namespace, scope, ref)
    );
    CREATE TABLE IF NOT EXISTS config (
      key        TEXT PRIMARY KEY,
      json       TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
}

/** Test-only: close and forget the connection so a fresh UI_DB_PATH is picked up. */
export function __closeDb() {
  if (_db) {
    _db.close();
    _db = null;
  }
}

const clean = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length ? t : null;
};

// --- labels ---------------------------------------------------------------

/** All labels for a namespace, optionally narrowed to one scope. */
export function listLabels(namespace: string, scope?: LabelScope): Label[] {
  const rows = scope
    ? db()
        .prepare(
          "SELECT * FROM labels WHERE namespace = ? AND scope = ? ORDER BY ref",
        )
        .all(namespace, scope)
    : db()
        .prepare("SELECT * FROM labels WHERE namespace = ? ORDER BY scope, ref")
        .all(namespace);
  return rows as unknown as Label[];
}

export type LabelInput = {
  namespace: string;
  scope: LabelScope;
  ref: string;
  label?: unknown;
  description?: unknown;
  color?: unknown;
  env_group?: unknown;
};

/**
 * Insert/update a label. If every field is empty the row is removed instead —
 * so "clear all fields + save" is how a user resets to the native name.
 * Returns the stored row, or null when it was cleared.
 */
export function upsertLabel(input: LabelInput): Label | null {
  const { namespace, scope, ref } = input;
  const label = clean(input.label);
  const description = clean(input.description);
  const color = clean(input.color);
  const env_group = clean(input.env_group);

  if (!label && !description && !color && !env_group) {
    db()
      .prepare("DELETE FROM labels WHERE namespace = ? AND scope = ? AND ref = ?")
      .run(namespace, scope, ref);
    return null;
  }

  const updated_at = Date.now();
  db()
    .prepare(
      `INSERT INTO labels (namespace, scope, ref, label, description, color, env_group, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(namespace, scope, ref) DO UPDATE SET
         label = excluded.label,
         description = excluded.description,
         color = excluded.color,
         env_group = excluded.env_group,
         updated_at = excluded.updated_at`,
    )
    .run(namespace, scope, ref, label, description, color, env_group, updated_at);

  return { namespace, scope, ref, label, description, color, env_group, updated_at };
}

// --- config ---------------------------------------------------------------

export function getConfig<T = unknown>(key: string): T | null {
  const row = db().prepare("SELECT json FROM config WHERE key = ?").get(key) as
    | { json: string }
    | undefined;
  return row ? (JSON.parse(row.json) as T) : null;
}

export function setConfig(key: string, value: unknown): void {
  db()
    .prepare(
      `INSERT INTO config (key, json, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at`,
    )
    .run(key, JSON.stringify(value), Date.now());
}
