import { expect, type APIRequestContext, type Page } from "@playwright/test";

export const API_URL = "http://localhost:3001";

/** The seed data gives every user the same password. */
export const PASSWORD = "s3cret";

/** Seed users used across the suite (see data/database-seed.json). */
export const USERS = {
  /** Ted Parisian – seed balance $1,509.53. */
  ted: { id: "uBmeaz5pX", username: "Heath93", fullName: "Ted Parisian" },
  /** Kristian Bradtke. */
  kristian: { id: "GjWovtg2hr", username: "Arvilla_Hegmann", fullName: "Kristian Bradtke" },
} as const;

/**
 * Restores the RWA database to its seed state so every test starts from the
 * same, known data (RWA exposes this endpoint for testing purposes).
 */
export async function reseed(request: APIRequestContext) {
  const response = await request.post(`${API_URL}/testData/seed`);
  await expect(response).toBeOK();
}

/** Signs in through the UI and waits until the home feed is shown. */
export async function signIn(page: Page, username: string, password = PASSWORD) {
  await page.goto("/signin");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByTestId("sidenav-username")).toHaveText(`@${username}`);
}

/** Signs out through the side navigation drawer. */
export async function signOut(page: Page) {
  await page.getByTestId("sidenav-signout").click();
  await expect(page).toHaveURL(/\/signin$/);
}
