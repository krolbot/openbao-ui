import { expect, test } from "@playwright/test";

const TOKEN = process.env.E2E_TOKEN ?? "root";

// Smoke test of the Phase 2 happy path against a live stack:
// login -> overview status -> secret engines -> KV folder browser.
test("login and browse the KV engine", async ({ page }) => {
  // redirected to /ui/login
  await page.goto("/");
  await expect(page.getByText("Sign in to OpenBao")).toBeVisible();

  // token login -> overview
  await page.fill("#token", TOKEN);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await expect(page.getByText("Unsealed")).toBeVisible();

  // navigate to the secret engine list and into the KV mount
  await page.getByRole("link", { name: "Secrets" }).click();
  await expect(page.getByText("secret/")).toBeVisible();
  await page.getByRole("link", { name: "secret/" }).click();

  // the KV browser renders (breadcrumb shows the mount)
  await expect(page.getByRole("link", { name: "secret", exact: true })).toBeVisible();

  // comparison matrix page is reachable and renders
  await page.goto("/ui/secrets/compare");
  await expect(page.getByRole("heading", { name: "Compare environments" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Compare" })).toBeVisible();
});

test("kv lifecycle: create, view, delete a secret", async ({ page }) => {
  const name = `e2e/secret-${Date.now()}`;
  await page.goto("/");
  await page.fill("#token", TOKEN);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();

  await page.goto("/ui/secrets/secret");
  await page.getByRole("button", { name: "New secret" }).click();
  await page.fill("#secret-name", name);
  await page.getByPlaceholder("key").first().fill("api_key");
  await page.getByPlaceholder("value").first().fill("s3cr3t-value");
  await page.getByRole("button", { name: "Create secret" }).click();

  // the new secret is selected and its key is shown
  await expect(page.getByText("version 1")).toBeVisible();
  await expect(page.getByText("api_key")).toBeVisible();

  // delete it via the danger-zone disclosure + typed confirm
  await page.getByRole("button", { name: /Advanced & danger zone/ }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.locator("#confirm-input").fill("delete");
  await page.getByRole("button", { name: "Delete everything" }).click();

  // detail panel clears
  await expect(page.getByText("No secret selected")).toBeVisible();
});

test("access section: policies, capabilities, tokens", async ({ page }) => {
  await page.goto("/");
  await page.fill("#token", TOKEN);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();

  await page.getByRole("link", { name: "Access" }).click();

  // Policies tab lists the built-in policies and loads HCL into the editor
  await expect(page.getByRole("button", { name: "default" })).toBeVisible();
  await page.getByRole("button", { name: "default" }).click();
  await expect(page.locator("textarea")).toBeVisible();

  // Capabilities tester returns capabilities for a path
  await page.getByRole("link", { name: "Capabilities" }).click();
  await page.fill("#cap-path", "secret/data/anything");
  await page.getByRole("button", { name: "Check" }).click();
  await expect(page.getByText("Capabilities on")).toBeVisible();

  // Tokens tab shows the active-tokens table
  await page.getByRole("link", { name: "Tokens" }).click();
  await expect(page.getByText("active token")).toBeVisible();
});

test("foundation: command palette and dark mode", async ({ page }) => {
  await page.goto("/");
  await page.fill("#token", TOKEN);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();

  // ⌘K / Ctrl+K opens the command palette and can navigate
  await page.keyboard.press("Control+k");
  const input = page.getByPlaceholder("Jump to…");
  await expect(input).toBeVisible();
  await input.fill("secrets");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/ui\/secrets/);

  // dark mode toggles the root .dark class
  await page.getByRole("button", { name: "Switch to dark" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
});

test("access management: auth methods and identity", async ({ page }) => {
  await page.goto("/");
  await page.fill("#token", TOKEN);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();

  // Auth Methods tab lists enabled methods (token is always present)
  await page.goto("/ui/access/auth");
  await expect(page.getByRole("button", { name: /token\// })).toBeVisible();

  // Identity tab shows the Entities/Groups switcher
  await page.goto("/ui/access/identity");
  await expect(page.getByRole("tab", { name: "Entities" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Groups" })).toBeVisible();

  // MFA tab shows TOTP methods + login enforcements
  await page.goto("/ui/access/mfa");
  await expect(page.getByRole("heading", { name: "TOTP methods" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Login enforcements" })).toBeVisible();
});

test("operations: status, quotas, plugins", async ({ page }) => {
  await page.goto("/");
  await page.fill("#token", TOKEN);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();

  await page.getByRole("link", { name: "Operations" }).click();
  await expect(page.getByText("Seal status")).toBeVisible();
  await expect(page.getByText("Maintenance")).toBeVisible();

  await page.getByRole("link", { name: "Plugins" }).click();
  await expect(page.getByRole("heading", { name: "auth" })).toBeVisible();

  // audit-log viewer renders (Recent activity section)
  await page.getByRole("link", { name: "Audit" }).click();
  await expect(page.getByRole("heading", { name: "Recent activity" })).toBeVisible();
});

test("guides: generate an integration snippet for an environment", async ({ page }) => {
  await page.goto("/");
  await page.fill("#token", TOKEN);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();

  await page.getByRole("link", { name: "Guides" }).click();
  await expect(page.getByRole("heading", { name: "Integration guides" })).toBeVisible();

  // the default (token) CLI snippet is wired to the dev `secret` KV mount
  await expect(page.getByText("bao kv get -mount=secret")).toBeVisible();

  // switching to AppRole regenerates the snippet with the login flow
  await page.getByRole("button", { name: "AppRole" }).click();
  await expect(page.getByText("auth/approle/login").first()).toBeVisible();
});

test("environments: customize a friendly display name", async ({ page }) => {
  const friendly = `Prod ${Date.now()}`;
  await page.goto("/");
  await page.fill("#token", TOKEN);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();

  await page.goto("/ui/secrets");
  // root token is an operator, so the customize control is available
  await page.getByRole("button", { name: "Customize secret/" }).click();
  await page.fill("#lbl-name", friendly);
  await page.getByRole("button", { name: "Save" }).click();

  // the friendly name replaces the raw mount path as the card title
  await expect(page.getByText(friendly)).toBeVisible();
});

test("settings: profile, preferences, namespaces", async ({ page }) => {
  await page.goto("/");
  await page.fill("#token", TOKEN);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();

  await page.getByRole("link", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();

  // preferences: theme options present
  await page.getByRole("link", { name: "Preferences" }).click();
  await expect(page.getByRole("heading", { name: "Theme" })).toBeVisible();

  // namespaces management page
  await page.getByRole("link", { name: "Namespaces" }).click();
  await expect(page.getByRole("button", { name: "New namespace" })).toBeVisible();

  // password policies tab
  await page.getByRole("link", { name: "Password Policies" }).click();
  await expect(page.getByRole("button", { name: "New policy" })).toBeVisible();
});

