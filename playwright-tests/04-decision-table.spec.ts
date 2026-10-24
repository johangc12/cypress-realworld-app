import { test, expect, type Page } from "@playwright/test";
import { reseed, USERS, PASSWORD } from "./support/helpers";

/**
 * MÓDULO 4 – TABLAS DE DECISIÓN (ISTQB CTFL 4.0.1, §4.2.3)
 *
 * Regla de negocio bajo prueba (inicio de sesión en RWA):
 *   "Un usuario solo puede iniciar sesión si escribe un nombre de usuario, la
 *    contraseña tiene al menos 4 caracteres y las credenciales coinciden con un
 *    usuario registrado. Mientras el formulario sea inválido el botón Sign In
 *    está deshabilitado; con credenciales de formato válido pero incorrectas se
 *    muestra el error 'Username or password is invalid'."
 *
 * Condiciones                        R1  R2  R3  R4  R5
 *   C1 Usuario escrito                T   T   T   F   F
 *   C2 Contraseña >= 4 caracteres     T   T   F   T   F
 *   C3 Credenciales correctas         T   F   –   –   –
 * Acciones
 *   A1 Botón Sign In deshabilitado            X   X   X
 *   A2 Mostrar alerta "invalid"           X
 *   A3 Iniciar sesión y abrir el inicio X
 *
 * "–" = indiferente: si C1 o C2 son falsas el formulario nunca llega al
 * servidor, así que C3 no puede influir en el resultado. Las 8 combinaciones de
 * la tabla completa se reducen a 5 reglas factibles (ver el informe).
 *
 * Un único script parametrizado automatiza todas las reglas.
 */

type Outcome = "home" | "invalid-credentials" | "button-disabled";

interface Rule {
  id: string;
  username: string;
  password: string;
  expected: Outcome;
  /** Mensaje de validación del campo esperado en las reglas con botón deshabilitado. */
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
          // A3: inicia sesión y redirige al feed de inicio.
          await signInButton.click();
          await expect(page).toHaveURL("/");
          await expect(page.getByTestId("sidenav-username")).toHaveText(`@${rule.username}`);
          break;

        case "invalid-credentials":
          // A2: el formulario es válido, el servidor lo rechaza y se muestra un error.
          await expect(signInButton).toBeEnabled();
          await signInButton.click();
          await expect(page.getByTestId("signin-error")).toHaveText("Username or password is invalid");
          await expect(page).toHaveURL(/\/signin$/);
          break;

        case "button-disabled":
          // A1: la validación del lado del cliente bloquea el envío.
          await expect(signInButton).toBeDisabled();
          await expect(page.getByText(rule.helperText!)).toBeVisible();
          await expect(page).toHaveURL(/\/signin$/);
          break;
      }
    });
  }
});

/**
 * Escribe en ambos campos y los deja "tocados" (el foco sale de ellos), que es
 * lo que hace que Formik muestre los mensajes de validación de cada campo.
 */
async function fillSignInForm(page: Page, username: string, password: string) {
  const usernameField = page.getByLabel("Username");
  const passwordField = page.getByLabel("Password");

  await usernameField.fill(username);
  await usernameField.blur();
  await passwordField.fill(password);
  await passwordField.blur();
}
