import { test, expect, type Page } from "@playwright/test";
import { reseed, USERS, PASSWORD } from "./support/helpers";

/**
 * MODULE 4 – DECISION TABLE TESTING (ISTQB CTFL 4.0.1, §4.2.3)
 *
 * Business rule under test (RWA sign-in):
 *   "A user can sign in only when a username is entered, the password has at
 *    least 4 characters and the credentials match a registered user. While the
 *    form is invalid the Sign In button is disabled; valid-looking but wrong
 *    credentials show the error 'Username or password is invalid'."
 *
 * Conditions                         R1  R2  R3  R4  R5
 *   C1 Username entered               T   T   T   F   F
 *   C2 Password >= 4 characters       T   T   F   T   F
 *   C3 Credentials match a user       T   F   –   –   –
 * Actions
 *   A1 Sign In button disabled                X   X   X
 *   A2 Show "invalid" error alert         X
 *   A3 Sign in and open home feed     X
 *
 * "–" = don't care: when C1 or C2 is false the form never reaches the server,
 * so C3 cannot influence the result. The 8 combinations of the full table
 * collapse to 5 feasible rules (see the report).
 *
 * A single parameterized script automates every rule.
 */

type Outcome = "home" | "invalid-credentials" | "button-disabled";

interface Rule {
  id: string;
  username: string;
  password: string;
  expected: Outcome;
  /** Field-level validation message expected for disabled-button rules. */
  helperText?: string;
}

const rules: Rule[] = [
  { id: "R1", username: USERS.ted.username, password: PASSWORD, expected: "home" },
  { id: "R2", username: USERS.ted.username, password: "wrong-pass", expected: "invalid-credentials" },
  {
    id: "R3",
    username: USERS.ted.username,
    password: "abc",
    expected: "button-disabled",
    helperText: "Password must contain at least 4 characters",
  },
  {
    id: "R4",
    username: "",
    password: PASSWORD,
    expected: "button-disabled",
    helperText: "Username is required",
  },
  {
    id: "R5",
    username: "",
    password: "abc",
    expected: "button-disabled",
    helperText: "Username is required",
  },
];

test.describe("Module 4 - Decision table: sign-in rule", () => {
  test.beforeEach(async ({ request }) => {
    await reseed(request);
  });

  for (const rule of rules) {
    test(`${rule.id}: user="${rule.username}" password="${rule.password}" -> ${rule.expected}`, async ({
      page,
    }) => {
      await page.goto("/signin");
      await fillSignInForm(page, rule.username, rule.password);

      const signInButton = page.getByRole("button", { name: "Sign In" });

      switch (rule.expected) {
        case "home":
          // A3: signed in and redirected to the home feed.
          await signInButton.click();
          await expect(page).toHaveURL("/");
          await expect(page.getByTestId("sidenav-username")).toHaveText(`@${rule.username}`);
          break;

        case "invalid-credentials":
          // A2: the form is valid, the server rejects it and an error is shown.
          await expect(signInButton).toBeEnabled();
          await signInButton.click();
          await expect(page.getByTestId("signin-error")).toHaveText("Username or password is invalid");
          await expect(page).toHaveURL(/\/signin$/);
          break;

        case "button-disabled":
          // A1: client-side validation blocks the submission.
          await expect(signInButton).toBeDisabled();
          await expect(page.getByText(rule.helperText!)).toBeVisible();
          await expect(page).toHaveURL(/\/signin$/);
          break;
      }
    });
  }
});

/**
 * Types into both fields and leaves them "touched" (focus moves away), which is
 * what makes Formik show the field-level validation messages.
 */
async function fillSignInForm(page: Page, username: string, password: string) {
  const usernameField = page.getByLabel("Username");
  const passwordField = page.getByLabel("Password");

  await usernameField.fill(username);
  await usernameField.blur();
  await passwordField.fill(password);
  await passwordField.blur();
}
