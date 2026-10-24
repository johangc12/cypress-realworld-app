import { test, expect } from "@playwright/test";
import { reseed, signIn, USERS } from "./support/helpers";

/**
 * MÓDULO 1 – LOCALIZADORES (LOCATORS)
 * Localiza elementos de RWA con distintas estrategias. Cada localizador lleva
 * un comentario con la razón por la que es adecuado para ese elemento.
 */
test.describe("Module 1 - Locators", () => {
  test.beforeEach(async ({ request }) => {
    await reseed(request);
  });

  test("locates sign-in elements with user-facing strategies", async ({ page }) => {
    await page.goto("/signin");

    // (1) Campo Username – getByLabel: el input tiene un <label> visible, que es
    // justo como lo identifica el usuario (y un lector de pantalla).
    const username = page.getByLabel("Username");

    // (2) Botón Sign In – getByRole: rol + nombre accesible es la estrategia que
    // Playwright recomienda primero, y además comprueba que sea un botón real.
    const signInButton = page.getByRole("button", { name: "Sign In" });

    // (3) Enlace de registro – getByRole con el rol "link": el usuario ve y hace
    // clic en un enlace, así que rol + texto visible es lo más cercano a él.
    const signUpLink = page.getByRole("link", { name: /Sign Up/ });

    // (4) Casilla "Remember me" – getByRole: las casillas exponen un rol y un
    // nombre accesible que toman de su etiqueta.
    const rememberMe = page.getByRole("checkbox", { name: "Remember me" });

    await expect(username).toBeVisible();
    await expect(signInButton).toBeVisible();
    await expect(signUpLink).toHaveAttribute("href", "/signup");
    await expect(rememberMe).not.toBeChecked();
  });

  test("locates home and new-transaction elements", async ({ page }) => {
    await signIn(page, USERS.ted.username);

    // (5) Saldo de la cuenta – getByTestId: "$1,509.53" es un dato dinámico y no
    // tiene etiqueta ni rol propio, así que un test id estable es lo más seguro.
    const balance = page.getByTestId("sidenav-user-balance");
    await expect(balance).toHaveText("$1,509.53");

    // (6) Botón "New" de la barra superior – getByRole con nombre accesible.
    await page.getByRole("link", { name: "New" }).click();

    // (7) Buscador de usuarios – getByPlaceholder: el campo no tiene etiqueta,
    // solo el placeholder "Search...", que es lo que lee el usuario.
    const search = page.getByPlaceholder("Search...");
    await expect(search).toBeEditable();

    // (8) Un usuario concreto de la lista – getByText: el nombre completo es el
    // contenido visible y único que el usuario busca en la lista.
    await expect(page.getByText(USERS.kristian.fullName)).toBeVisible();

    // (9) locator() con CSS – solo como último recurso. Aquí se apoya en el
    // atributo de pruebas de RWA (no en la estructura del DOM ni en clases CSS
    // generadas), así que sigue siendo estable.
    const usersList = page.locator('[data-test="users-list"]');
    await expect(usersList).toBeVisible();
  });

  test("strictness: a locator that matches several elements fails on actions", async ({ page }) => {
    await page.goto("/signin");

    // Hay tres elementos <input> (Username, Password, Remember me), así que este
    // localizador es ambiguo. Playwright se niega a adivinar cuál llenar.
    const anyTextbox = page.locator("input");
    await expect(anyTextbox).toHaveCount(3); // username, password y la casilla remember-me
    await expect(anyTextbox.fill("Heath93", { timeout: 2_000 })).rejects.toThrow(
      /strict mode violation/
    );

    // first()/nth() quitan la ambigüedad, pero dependen del orden del DOM: si el
    // formulario se reordena, el test apunta en silencio a otro campo. Es mejor
    // un localizador único por su significado, como getByLabel("Username").
    await anyTextbox.first().fill("Heath93");
    await expect(page.getByLabel("Username")).toHaveValue("Heath93");
  });
});
