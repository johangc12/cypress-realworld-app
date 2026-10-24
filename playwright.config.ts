import { defineConfig, devices } from "@playwright/test";

/**
 * Configuración de Playwright para Cypress Real World App (RWA).
 * Taller Investigativo – Tercer Corte (Pruebas y Calidad de Software, Universidad ECCI).
 *
 * Ver https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: "./playwright-tests",

  /*
   * Cada test vuelve a sembrar la base de datos compartida de RWA
   * (POST /testData/seed), así que los tests deben correr de uno en uno para
   * no interferir entre sí.
   */
  fullyParallel: false,
  workers: 1,

  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,

  reporter: [["list"], ["html", { open: "never" }]],

  use: {
    /* Permite escribir page.goto("/signin") en lugar de la URL completa. */
    baseURL: "http://localhost:3000",

    /*
     * RWA marca sus elementos con `data-test` y no con `data-testid` (el que
     * Playwright usa por defecto), así que getByTestId() debe buscar ese atributo.
     * https://playwright.dev/docs/locators#set-a-custom-test-id-attribute
     */
    testIdAttribute: "data-test",

    /* Con EVIDENCE=1 se guarda una captura de cada test para el informe. */
    screenshot: process.env.EVIDENCE ? "on" : "only-on-failure",
    trace: "retain-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  /* Levanta RWA (frontend :3000 + API :3001) si no está corriendo ya. */
  webServer: {
    command: "yarn dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
