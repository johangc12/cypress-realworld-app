import { test } from "@playwright/test";
import { reseed, USERS, PASSWORD } from "./support/helpers";

/**
 * MODULE 2 – ACTIONS
 * Short flow: sign in and send a $25 payment to another user.
 * Actions used: fill(), check(), press(), click(), hover() and pressSequentially().
 *
 * Module 3 (03-assertions.spec.ts) takes this same flow and adds assertions.
 */
test.describe("Module 2 - Actions", () => {
  test.beforeEach(async ({ request }) => {
    await reseed(request);
  });

  test("sign in and send a payment", async ({ page }) => {
    await page.goto("/signin");

    // fill(): sets the whole value at once. Right for plain text fields – the
    // sign-in form only validates the final value, not each keystroke.
    await page.getByLabel("Username").fill(USERS.ted.username);
    await page.getByLabel("Password").fill(PASSWORD);

    // check(): idempotent – it only clicks if the box is not already checked and
    // then verifies it really became checked.
    await page.getByRole("checkbox", { name: "Remember me" }).check();

    // press(): submits the form with the keyboard, as many users do.
    await page.getByLabel("Password").press("Enter");

    // hover() + click(): open the "New" transaction screen.
    const newButton = page.getByRole("link", { name: "New" });
    await newButton.hover();
    await newButton.click();

    // pressSequentially(): the user search box fires a server search on every
    // keystroke (onChange). Typing key by key reproduces that real behaviour.
    // fill() would also work here, but this field is the one place in the flow
    // where per-key events are part of the behaviour under test.
    await page.getByPlaceholder("Search...").pressSequentially("Kristian", { delay: 50 });
    await page.getByText(USERS.kristian.fullName).click();

    // fill() on the amount field: it has a currency mask ("$" + thousands
    // separator), but the mask reacts to the final input value, so fill() is
    // enough and faster than typing character by character.
    await page.getByPlaceholder("Amount").fill("25");
    await page.getByPlaceholder("Add a note").fill("Pizza night");

    // click(): Playwright first waits until the button is visible, stable,
    // enabled and able to receive events (actionability checks).
    await page.getByRole("button", { name: "Pay" }).click();

    await page.getByRole("link", { name: "Return To Transactions" }).click();
  });
});
