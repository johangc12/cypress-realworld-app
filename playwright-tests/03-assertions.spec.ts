import { test, expect } from "@playwright/test";
import { API_URL, reseed, USERS, PASSWORD } from "./support/helpers";

/**
 * MÓDULO 3 – ASERCIONES (ASSERTIONS)
 * El flujo del módulo 2, ahora verificando los resultados esperados del caso de prueba:
 *
 *   Caso de prueba TC-PAY-01 – "Un usuario le paga a otro usuario"
 *   ER1  El botón Pay sigue deshabilitado hasta ingresar monto y nota.      (estado)
 *   ER2  El campo de monto muestra el valor formateado "$25".               (valor)
 *   ER3  La confirmación dice "Paid $25.00 for Pizza night".                (texto)
 *   ER4  Al volver, el usuario queda en la página de inicio.                (página)
 *   ER5  No aparece error de login y el saldo baja exactamente $25.         (negativa / genérica)
 */
test.describe("Module 3 - Assertions", () => {
  test.beforeEach(async ({ request }) => {
    await reseed(request);
  });

  test("TC-PAY-01: sign in and send a payment (with assertions)", async ({ page }) => {
    await page.goto("/signin");
    await expect(page).toHaveTitle("Cypress Real World App"); // página

    await page.getByLabel("Username").fill(USERS.ted.username);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("checkbox", { name: "Remember me" }).check();
    await expect(page.getByRole("checkbox", { name: "Remember me" })).toBeChecked(); // estado
    await page.getByLabel("Password").press("Enter");

    // ER5 (negativa): con credenciales válidas NO debe aparecer la alerta de error.
    await expect(page.getByTestId("signin-error")).not.toBeVisible();
    await expect(page).toHaveURL("/"); // página

    const balance = page.getByTestId("sidenav-user-balance");
    await expect(balance).toHaveText("$1,509.53");
    const balanceBefore = parseMoney(await balance.textContent());

    const newButton = page.getByRole("link", { name: "New" });
    await newButton.hover();
    await newButton.click();
    await expect(page).toHaveURL("/transaction/new"); // página

    // estructura: el menú lateral ofrece exactamente cuatro enlaces principales.
    await expect(page.getByTestId("sidenav").getByRole("list").first().getByRole("link")).toHaveCount(4);

    await page.getByPlaceholder("Search...").pressSequentially("Kristian", { delay: 50 });
    // contenido: los resultados de la búsqueda incluyen al usuario buscado.
    await expect(page.getByTestId("users-list")).toContainText(USERS.kristian.fullName);
    await page.getByText(USERS.kristian.fullName).click();

    // ER1 (estado): todavía no se ha ingresado nada, así que ambos botones están deshabilitados.
    const payButton = page.getByRole("button", { name: "Pay" });
    await expect(payButton).toBeDisabled();
    await expect(page.getByRole("button", { name: "Request" })).toBeDisabled();

    await page.getByPlaceholder("Amount").fill("25");
    await page.getByPlaceholder("Add a note").fill("Pizza night");

    // ER2 (valor): la máscara de moneda formatea lo que se escribió.
    await expect(page.getByPlaceholder("Amount")).toHaveValue("$25");
    // ER1 (estado): con datos válidos el botón Pay se habilita.
    await expect(payButton).toBeEnabled();

    await payButton.click();

    // ER3 (texto): aserción web-first, se reintenta hasta que aparece la confirmación.
    await expect(page.getByRole("heading", { level: 2, name: /^Paid/ })).toHaveText(
      "Paid $25.00 for Pizza night"
    );
    await expect(page.getByRole("alert")).toContainText("Transaction Submitted!"); // contenido

    await page.getByRole("link", { name: "Return To Transactions" }).click();

    // ER4 (página): de vuelta en el feed de inicio.
    await expect(page).toHaveURL("/");

    // ER5 (genérica): el nuevo saldo es exactamente el anterior menos $25.
    await expect(balance).toHaveText("$1,484.53");
    const balanceAfter = parseMoney(await balance.textContent());
    expect(balanceBefore - balanceAfter).toBe(25);
  });

  test(".not, expect.soft() and generic matchers", async ({ page, request }) => {
    // toBeOK(): aserción sobre una respuesta de API – estado entre 200 y 299.
    const users = await request.get(`${API_URL}/testData/users`);
    await expect(users).toBeOK();
    const { results } = await users.json();

    // Aserciones genéricas: se evalúan una sola vez, de inmediato, sobre valores simples.
    expect(results.length).toBeGreaterThan(1);
    expect(results.map((u: { username: string }) => u.username)).toContain(USERS.ted.username);
    expect(results[0]).toEqual(expect.objectContaining({ id: USERS.ted.id }));
    expect(USERS.kristian.fullName).toMatch(/^Kristian/);

    await page.goto("/signin");

    // .not invierte un matcher: al inicio el botón Sign In no debe estar deshabilitado.
    await expect(page.getByRole("button", { name: "Sign In" })).not.toBeDisabled();

    // expect.soft(): registra el fallo pero deja seguir el test, así una sola
    // ejecución reporta todas las comprobaciones que fallan en la página en vez
    // de detenerse en la primera.
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
