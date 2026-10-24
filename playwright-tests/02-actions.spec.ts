import { test } from "@playwright/test";
import { reseed, USERS, PASSWORD } from "./support/helpers";

/**
 * MÓDULO 2 – ACCIONES (ACTIONS)
 * Flujo corto: iniciar sesión y enviar un pago de $25 a otro usuario.
 * Acciones usadas: fill(), check(), press(), click(), hover() y pressSequentially().
 *
 * El módulo 3 (03-assertions.spec.ts) toma este mismo flujo y le agrega aserciones.
 */
test.describe("Module 2 - Actions", () => {
  test.beforeEach(async ({ request }) => {
    await reseed(request);
  });

  test("sign in and send a payment", async ({ page }) => {
    await page.goto("/signin");

    // fill(): asigna el valor completo de una vez. Es lo correcto para campos de
    // texto simples: el formulario de login solo valida el valor final, no cada tecla.
    await page.getByLabel("Username").fill(USERS.ted.username);
    await page.getByLabel("Password").fill(PASSWORD);

    // check(): es idempotente – solo hace clic si la casilla no está marcada y
    // luego verifica que de verdad quedó marcada.
    await page.getByRole("checkbox", { name: "Remember me" }).check();

    // press(): envía el formulario con el teclado, como hacen muchos usuarios.
    await page.getByLabel("Password").press("Enter");

    // hover() + click(): abre la pantalla de nueva transacción.
    const newButton = page.getByRole("link", { name: "New" });
    await newButton.hover();
    await newButton.click();

    // pressSequentially(): el buscador de usuarios lanza una búsqueda al servidor
    // en cada tecla (onChange). Escribir tecla por tecla reproduce ese
    // comportamiento real. fill() también funcionaría, pero este campo es el
    // único del flujo donde los eventos por tecla son parte de lo que se prueba.
    await page.getByPlaceholder("Search...").pressSequentially("Kristian", { delay: 50 });
    await page.getByText(USERS.kristian.fullName).click();

    // fill() en el campo de monto: tiene una máscara de moneda ("$" y separador
    // de miles), pero la máscara reacciona al valor final, así que fill() basta y
    // es más rápido que escribir carácter por carácter.
    await page.getByPlaceholder("Amount").fill("25");
    await page.getByPlaceholder("Add a note").fill("Pizza night");

    // click(): antes, Playwright espera a que el botón esté visible, estable,
    // habilitado y pueda recibir eventos (comprobaciones de actionability).
    await page.getByRole("button", { name: "Pay" }).click();

    await page.getByRole("link", { name: "Return To Transactions" }).click();
  });
});
