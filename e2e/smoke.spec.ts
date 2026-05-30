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
});
