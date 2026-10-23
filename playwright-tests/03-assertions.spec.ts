import { test, expect } from "@playwright/test";
import { API_URL, reseed, USERS, PASSWORD } from "./support/helpers";

/**
 * MODULE 3 – ASSERTIONS
 * The Module 2 flow, now verifying the expected results of the test case:
 *
 *   Test case TC-PAY-01 – "A user pays another user"
 *   ER1  The Pay button stays disabled until amount and note are entered.   (state)
 *   ER2  The amount field shows the formatted value "$25".                  (value)
 *   ER3  The confirmation reads "Paid $25.00 for Pizza night".               (text)
 *   ER4  The user is back on the home page after returning.                  (page)
 *   ER5  No sign-in error is shown and the balance drops by exactly $25.     (negative / generic)
 */
test.describe("Module 3 - Assertions", () => {
  test.beforeEach(async ({ request }) => {
    await reseed(request);
  });

  test("TC-PAY-01: sign in and send a payment (with assertions)", async ({ page }) => {
    await page.goto("/signin");
    await expect(page).toHaveTitle("Cypress Real World App"); // page

    await page.getByLabel("Username").fill(USERS.ted.username);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("checkbox", { name: "Remember me" }).check();
    await expect(page.getByRole("checkbox", { name: "Remember me" })).toBeChecked(); // state
    await page.getByLabel("Password").press("Enter");

    // ER5 (negative): the error alert must NOT appear for valid credentials.
    await expect(page.getByTestId("signin-error")).not.toBeVisible();
    await expect(page).toHaveURL("/"); // page

    const balance = page.getByTestId("sidenav-user-balance");
    await expect(balance).toHaveText("$1,509.53");
    const balanceBefore = parseMoney(await balance.textContent());

    const newButton = page.getByRole("link", { name: "New" });
    await newButton.hover();
    await newButton.click();
    await expect(page).toHaveURL("/transaction/new"); // page

    // structure: the side navigation offers exactly four main links.
    await expect(page.getByTestId("sidenav").getByRole("list").first().getByRole("link")).toHaveCount(4);

    await page.getByPlaceholder("Search...").pressSequentially("Kristian", { delay: 50 });
    // content: the (debounced) search results include the wanted user.
    await expect(page.getByTestId("users-list")).toContainText(USERS.kristian.fullName);
    await page.getByText(USERS.kristian.fullName).click();

    // ER1 (state): nothing entered yet, so both buttons are disabled.
    const payButton = page.getByRole("button", { name: "Pay" });
    await expect(payButton).toBeDisabled();
    await expect(page.getByRole("button", { name: "Request" })).toBeDisabled();

    await page.getByPlaceholder("Amount").fill("25");
    await page.getByPlaceholder("Add a note").fill("Pizza night");

    // ER2 (value): the currency mask formats what was typed.
    await expect(page.getByPlaceholder("Amount")).toHaveValue("$25");
    // ER1 (state): with valid data the Pay button becomes enabled.
    await expect(payButton).toBeEnabled();

    await payButton.click();

    // ER3 (text): web-first assertion, retried until the confirmation renders.
    await expect(page.getByRole("heading", { level: 2, name: /^Paid/ })).toHaveText(
      "Paid $25.00 for Pizza night"
    );
    await expect(page.getByRole("alert")).toContainText("Transaction Submitted!"); // content

    await page.getByRole("link", { name: "Return To Transactions" }).click();

    // ER4 (page): back on the home feed.
    await expect(page).toHaveURL("/");

    // ER5 (generic): the new balance is exactly the old one minus $25.
    await expect(balance).toHaveText("$1,484.53");
    const balanceAfter = parseMoney(await balance.textContent());
    expect(balanceBefore - balanceAfter).toBe(25);
  });

  test(".not, expect.soft() and generic matchers", async ({ page, request }) => {
    // toBeOK(): API response assertion – status in the 200–299 range.
    const users = await request.get(`${API_URL}/testData/users`);
    await expect(users).toBeOK();
    const { results } = await users.json();

    // Generic assertions: evaluated once, immediately, on plain values.
    expect(results.length).toBeGreaterThan(1);
    expect(results.map((u: { username: string }) => u.username)).toContain(USERS.ted.username);
    expect(results[0]).toEqual(expect.objectContaining({ id: USERS.ted.id }));
    expect(USERS.kristian.fullName).toMatch(/^Kristian/);

    await page.goto("/signin");

    // .not inverts a matcher: the Sign In button must not be disabled initially.
    await expect(page.getByRole("button", { name: "Sign In" })).not.toBeDisabled();

    // expect.soft(): records a failure but lets the test continue, so one run
    // reports every broken check on the page instead of stopping at the first.
    await expect.soft(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect.soft(page.getByLabel("Username")).toBeEmpty();
    await expect.soft(page.getByLabel("Password")).toHaveAttribute("type", "password");
    await expect.soft(page.getByTestId("signin-error")).toBeHidden();
  });
});

/** "$1,509.53" -> 1509.53 */
function parseMoney(text: string | null): number {
  return Number((text ?? "").replace(/[$,]/g, ""));
}
