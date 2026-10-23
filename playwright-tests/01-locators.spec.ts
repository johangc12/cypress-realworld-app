import { test, expect } from "@playwright/test";
import { reseed, signIn, USERS } from "./support/helpers";

/**
 * MODULE 1 – LOCATORS
 * Locates elements of RWA with different strategies. Each locator carries a
 * comment with the reason it fits that element.
 */
test.describe("Module 1 - Locators", () => {
  test.beforeEach(async ({ request }) => {
    await reseed(request);
  });

  test("locates sign-in elements with user-facing strategies", async ({ page }) => {
    await page.goto("/signin");

    // (1) Username field – getByLabel: the input has a visible <label>, so this
    // is exactly how a user (and a screen reader) identifies it.
    const username = page.getByLabel("Username");

    // (2) Sign In button – getByRole: role + accessible name is the strategy
    // Playwright recommends first, and it also checks the element is a real button.
    const signInButton = page.getByRole("button", { name: "Sign In" });

    // (3) Sign-up link – getByRole with the "link" role: the user sees and clicks
    // a link, so role + visible text is the most user-facing choice.
    const signUpLink = page.getByRole("link", { name: /Sign Up/ });

    // (4) "Remember me" checkbox – getByRole: checkboxes expose a role and an
    // accessible name taken from their label.
    const rememberMe = page.getByRole("checkbox", { name: "Remember me" });

    await expect(username).toBeVisible();
    await expect(signInButton).toBeVisible();
    await expect(signUpLink).toHaveAttribute("href", "/signup");
    await expect(rememberMe).not.toBeChecked();
  });

  test("locates home and new-transaction elements", async ({ page }) => {
    await signIn(page, USERS.ted.username);

    // (5) Account balance – getByTestId: "$1,509.53" is dynamic data and has no
    // label or role of its own, so a stable test id is the safest contract.
    const balance = page.getByTestId("sidenav-user-balance");
    await expect(balance).toHaveText("$1,509.53");

    // (6) "New" button in the top bar – getByRole with an accessible name.
    await page.getByRole("link", { name: "New" }).click();

    // (7) User search box – getByPlaceholder: the field has no label, only the
    // placeholder "Search...", which is what the user reads.
    const search = page.getByPlaceholder("Search...");
    await expect(search).toBeEditable();

    // (8) A specific user in the list – getByText: the user's full name is the
    // visible, unique content the user looks for in the list.
    await expect(page.getByText(USERS.kristian.fullName)).toBeVisible();

    // (9) CSS locator() – only as a last resort. Here it relies on the RWA test
    // attribute (not on DOM structure or generated CSS classes), so it is still stable.
    const usersList = page.locator('[data-test="users-list"]');
    await expect(usersList).toBeVisible();
  });

  test("strictness: a locator that matches several elements fails on actions", async ({ page }) => {
    await page.goto("/signin");

    // There are three <input> elements (Username, Password, Remember me), so this
    // locator is ambiguous. Playwright refuses to guess which one to fill.
    const anyTextbox = page.locator("input");
    await expect(anyTextbox).toHaveCount(3); // username, password and the remember-me checkbox
    await expect(anyTextbox.fill("Heath93", { timeout: 2_000 })).rejects.toThrow(
      /strict mode violation/
    );

    // first()/nth() remove the ambiguity, but they depend on DOM order: if the
    // form is reordered the test silently targets another field. Prefer a
    // locator that is unique by meaning, such as getByLabel("Username").
    await anyTextbox.first().fill("Heath93");
    await expect(page.getByLabel("Username")).toHaveValue("Heath93");
  });
});
