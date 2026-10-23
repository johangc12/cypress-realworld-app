import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for the Cypress Real World App (RWA).
 * Taller Investigativo – Tercer Corte (Pruebas y Calidad de Software, Universidad ECCI).
 *
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: "./playwright-tests",

  /*
   * Every test re-seeds the shared RWA database (POST /testData/seed), so the
   * tests must run one at a time to avoid interfering with each other.
   */
  fullyParallel: false,
  workers: 1,

  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,

  reporter: [["list"], ["html", { open: "never" }]],

  use: {
    /* Lets tests call page.goto("/signin") instead of the full URL. */
    baseURL: "http://localhost:3000",

    /*
     * RWA marks its elements with `data-test` instead of Playwright's default
     * `data-testid`, so getByTestId() must look at that attribute.
     * https://playwright.dev/docs/locators#set-a-custom-test-id-attribute
     */
    testIdAttribute: "data-test",

    /* EVIDENCE=1 keeps a screenshot of every test for the report. */
    screenshot: process.env.EVIDENCE ? "on" : "only-on-failure",
    trace: "retain-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  /* Starts RWA (frontend :3000 + API :3001) if it is not already running. */
  webServer: {
    command: "yarn dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
