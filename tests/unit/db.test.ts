import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  __closeDb,
  getConfig,
  listLabels,
  setConfig,
  upsertLabel,
} from "@/lib/db";

let dir: string;

beforeAll(() => {
  // Point the store at a throwaway file BEFORE the lazy connection opens.
  dir = mkdtempSync(join(tmpdir(), "ui-db-"));
  process.env.UI_DB_PATH = join(dir, "ui.db");
});

afterAll(() => {
  __closeDb();
  rmSync(dir, { recursive: true, force: true });
});

describe("labels store", () => {
  it("upserts and lists labels scoped by namespace and scope", () => {
    upsertLabel({
      namespace: "",
      scope: "environment",
      ref: "secret/",
      label: "Production",
      env_group: "prod",
      color: "emerald",
    });
    upsertLabel({
      namespace: "",
      scope: "workspace",
      ref: "team-a",
      label: "Team A",
    });

    const all = listLabels("");
    expect(all).toHaveLength(2);

    const envs = listLabels("", "environment");
    expect(envs).toHaveLength(1);
    expect(envs[0]).toMatchObject({
      ref: "secret/",
      label: "Production",
      env_group: "prod",
      color: "emerald",
    });
  });

  it("updates an existing label in place (no duplicate row)", () => {
    upsertLabel({ namespace: "", scope: "environment", ref: "secret/", label: "Staging" });
    const envs = listLabels("", "environment");
    expect(envs).toHaveLength(1);
    expect(envs[0].label).toBe("Staging");
    // unspecified fields are reset, not preserved
    expect(envs[0].env_group).toBeNull();
  });

  it("clears the row when every field is empty", () => {
    const result = upsertLabel({
      namespace: "",
      scope: "environment",
      ref: "secret/",
      label: "   ",
    });
    expect(result).toBeNull();
    expect(listLabels("", "environment")).toHaveLength(0);
  });

  it("isolates labels by namespace", () => {
    upsertLabel({ namespace: "team-a", scope: "environment", ref: "kv/", label: "Scoped" });
    expect(listLabels("team-a")).toHaveLength(1);
    expect(listLabels("other")).toHaveLength(0);
  });
});

describe("config store", () => {
  it("round-trips arbitrary JSON and overwrites by key", () => {
    expect(getConfig("ui")).toBeNull();
    setConfig("ui", { branding: { title: "Acme Vault" }, hideTokenLogin: true });
    expect(getConfig<{ branding: { title: string } }>("ui")).toMatchObject({
      branding: { title: "Acme Vault" },
      hideTokenLogin: true,
    });
    setConfig("ui", { branding: { title: "Acme Secrets" } });
    expect(getConfig<{ branding: { title: string } }>("ui")?.branding.title).toBe(
      "Acme Secrets",
    );
  });
});
