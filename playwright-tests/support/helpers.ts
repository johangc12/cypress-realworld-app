import { expect, type APIRequestContext, type Page } from "@playwright/test";

export const API_URL = "http://localhost:3001";

/** Los datos semilla le dan la misma contraseña a todos los usuarios. */
export const PASSWORD = "s3cret";

/** Usuarios semilla que usa la suite (ver data/database-seed.json). */
export const USERS = {
  /** Ted Parisian – saldo inicial $1,509.53. */
  ted: { id: "uBmeaz5pX", username: "Heath93", fullName: "Ted Parisian" },
  /** Kristian Bradtke. */
  kristian: { id: "GjWovtg2hr", username: "Arvilla_Hegmann", fullName: "Kristian Bradtke" },
} as const;

/**
 * Restaura la base de datos de RWA a su estado semilla para que cada test
 * empiece con los mismos datos conocidos (RWA expone este endpoint para pruebas).
 */
export async function reseed(request: APIRequestContext) {
  const response = await request.post(`${API_URL}/testData/seed`);
  await expect(response).toBeOK();
}

/** Inicia sesión desde la interfaz y espera a que se muestre el feed de inicio. */
export async function signIn(page: Page, username: string, password = PASSWORD) {
  await page.goto("/signin");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByTestId("sidenav-username")).toHaveText(`@${username}`);
}

/** Cierra sesión desde el menú lateral. */
export async function signOut(page: Page) {
  await page.getByTestId("sidenav-signout").click();
  await expect(page).toHaveURL(/\/signin$/);
}
