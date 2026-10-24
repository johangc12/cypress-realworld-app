import { test, expect, type Page, type APIRequestContext } from "@playwright/test";
import { API_URL, reseed, signIn, signOut, USERS } from "./support/helpers";

/**
 * MÓDULO 5 – TRANSICIÓN DE ESTADOS (ISTQB CTFL 4.0.1, §4.2.4)
 *
 * Objeto bajo prueba: una transacción de SOLICITUD de dinero en RWA.
 *   Ted (solicitante) le pide dinero a Kristian (pagador); Kristian acepta o rechaza.
 *
 * Estados
 *   S0 Draft     – el formulario de "New transaction", aún no se guarda nada
 *   S1 Pending   – solicitud guardada, requestStatus = "pending"
 *   S2 Accepted  – requestStatus = "accepted" (dinero movido, status "complete")
 *   S3 Rejected  – requestStatus = "rejected"
 *
 * Eventos: E1 enviar "Request", E2 aceptar, E3 rechazar, E4 comentar
 *
 * Transiciones válidas      evento [guarda] / acción
 *   T1 S0 -> S1  enviar "Request" [monto y nota válidos] / notificar al pagador
 *   T2 S1 -> S2  aceptar  [el usuario actual es el pagador] / mover dinero, notificar al solicitante
 *   T3 S1 -> S3  rechazar [el usuario actual es el pagador]
 *   T4 S1 -> S1  comentar / se agrega el comentario, sigue pendiente
 *   T5 S2 -> S2  comentar / se agrega el comentario, sigue aceptada
 *   T6 S3 -> S3  comentar / se agrega el comentario, sigue rechazada
 *
 * Transiciones inválidas (no hay Accept/Reject una vez resuelta la solicitud):
 *   S2 -E2->, S2 -E3->, S3 -E2->, S3 -E3->
 * La principal que se intenta es S3 -- aceptar -->, por la interfaz y por la API.
 *
 * Estado observable en la interfaz (detalle de la transacción, visto por el pagador):
 *   Pending  : título "<solicitante> requested <pagador>", botones Accept/Reject visibles
 *   Accepted : título "<solicitante> charged <pagador>",   sin botones Accept/Reject
 *   Rejected : título "<solicitante> requested <pagador>", sin botones Accept/Reject
 */

const AMOUNT = "30";

test.describe("Module 5 - State transition: payment request", () => {
  test.beforeEach(async ({ request }) => {
    await reseed(request);
  });

  test("TC-ST-01 valid sequence: S0 -T1-> S1 -T4-> S1 -T2-> S2 -T5-> S2", async ({ page, request }) => {
    const note = `Concert tickets ${Date.now()}`;

    // T1: S0 Draft -> S1 Pending (Ted envía la solicitud)
    await signIn(page, USERS.ted.username);
    await createRequest(page, USERS.kristian.fullName, AMOUNT, note);
    const id = await findTransactionId(request, note);
    expect(await getRequestStatus(request, id)).toBe("pending");
    await signOut(page);

    // Kristian (el pagador) abre la solicitud: el estado Pending es observable.
    await signIn(page, USERS.kristian.username);
    await page.goto(`/transaction/${id}`);
    await expectPending(page, id);

    // T4: S1 -> S1 (un comentario no cambia el estado)
    await addComment(page, "Sure, sending it now");
    await expectPending(page, id);

    // T2: S1 Pending -> S2 Accepted
    await page.getByTestId(`transaction-accept-request-${id}`).click();
    await expect(page.getByTestId(`transaction-action-${id}`)).toHaveText("charged");
    await expect(page.getByTestId(`transaction-accept-request-${id}`)).toHaveCount(0);
    await expect(page.getByTestId(`transaction-reject-request-${id}`)).toHaveCount(0);
    expect(await getRequestStatus(request, id)).toBe("accepted");

    // T5: S2 -> S2 (comentar la deja aceptada)
    await addComment(page, "Thanks!");
    await expect(page.getByTestId(`transaction-action-${id}`)).toHaveText("charged");
  });

  test("TC-ST-02 invalid transition: S1 -T3-> S3 -T6-> S3, then try accept on S3", async ({
    page,
    request,
  }) => {
    const note = `Shared taxi ${Date.now()}`;

    await signIn(page, USERS.ted.username);
    await createRequest(page, USERS.kristian.fullName, AMOUNT, note);
    const id = await findTransactionId(request, note);

    // Comprobación de la guarda: el solicitante no puede aceptar ni rechazar su propia solicitud.
    await page.goto(`/transaction/${id}`);
    await expect(page.getByTestId(`transaction-accept-request-${id}`)).toHaveCount(0);
    await signOut(page);

    // T3: S1 Pending -> S3 Rejected
    await signIn(page, USERS.kristian.username);
    await page.goto(`/transaction/${id}`);
    await expectPending(page, id);
    await page.getByTestId(`transaction-reject-request-${id}`).click();
    expect(await getRequestStatus(request, id)).toBe("rejected");

    // T6: S3 -> S3 (comentar la deja rechazada)
    await page.reload();
    await addComment(page, "Sorry, not this time");

    // Evento inválido "aceptar" en el estado S3: no hay forma de volver a aceptarla.
    await expect(page.getByTestId(`transaction-action-${id}`)).toHaveText("requested");
    await expect(page.getByTestId(`transaction-accept-request-${id}`)).toHaveCount(0);
    await expect(page.getByTestId(`transaction-reject-request-${id}`)).toHaveCount(0);
    expect(await getRequestStatus(request, id)).toBe("rejected");
  });

  test("TC-ST-03 invalid transition through the API: accept a rejected request", async ({
    page,
    request,
  }) => {
    test.fail(
      true,
      "Defecto conocido: PATCH /transactions/:id no revisa el estado actual, así que una solicitud rechazada todavía se puede aceptar"
    );
    const note = `Gym fee ${Date.now()}`;

    await signIn(page, USERS.ted.username);
    await createRequest(page, USERS.kristian.fullName, AMOUNT, note);
    const id = await findTransactionId(request, note);
    await signOut(page);

    await signIn(page, USERS.kristian.username);
    await page.goto(`/transaction/${id}`);
    await page.getByTestId(`transaction-reject-request-${id}`).click();
    await expect.poll(() => getRequestStatus(request, id)).toBe("rejected");

    // page.request comparte con el navegador la cookie de sesión de Kristian.
    const response = await page.request.patch(`${API_URL}/transactions/${id}`, {
      data: { requestStatus: "accepted" },
    });

    // Lo que espera el modelo de estados: el servidor lo rechaza y el estado sigue en S3.
    expect(response.status()).toBeGreaterThanOrEqual(400);
    expect(await getRequestStatus(request, id)).toBe("rejected");
  });
});

test.describe("Module 5 - State transition: action of T3", () => {
  test.beforeEach(async ({ request }) => {
    await reseed(request);
  });

  test("TC-ST-04 T3 (reject) must not move money", async ({ page, request }) => {
    test.fail(
      true,
      "Defecto conocido: updateTransactionById le cobra al pagador en cualquier actualización de una solicitud, incluido el rechazo"
    );
    const note = `Lunch ${Date.now()}`;

    await signIn(page, USERS.ted.username);
    await createRequest(page, USERS.kristian.fullName, AMOUNT, note);
    const id = await findTransactionId(request, note);
    await signOut(page);

    await signIn(page, USERS.kristian.username);
    const balance = page.getByTestId("sidenav-user-balance");
    const before = await balance.textContent();

    await page.goto(`/transaction/${id}`);
    await page.getByTestId(`transaction-reject-request-${id}`).click();
    await expect.poll(() => getRequestStatus(request, id)).toBe("rejected");

    // Lo que espera el modelo: T3 no tiene la acción "mover dinero", así que el
    // saldo no cambia. Volver a iniciar sesión refresca el saldo del menú lateral.
    await signOut(page);
    await signIn(page, USERS.kristian.username);
    await expect(balance).toHaveText(before!);
  });
});

/** T1: llena el asistente de "New transaction" y lo envía como Request. */
async function createRequest(page: Page, payerName: string, amount: string, note: string) {
  await page.getByRole("link", { name: "New" }).click();
  await page.getByPlaceholder("Search...").fill(payerName.split(" ")[0]);
  await page.getByText(payerName).click();
  await page.getByPlaceholder("Amount").fill(amount);
  await page.getByPlaceholder("Add a note").fill(note);
  await page.getByRole("button", { name: "Request" }).click();
  await expect(page.getByRole("heading", { level: 2, name: /^Requested/ })).toContainText(note);
}

/** E4: agrega un comentario a la transacción abierta. */
async function addComment(page: Page, text: string) {
  const comment = page.getByPlaceholder("Write a comment...");
  await comment.fill(text);
  await comment.press("Enter");
  await expect(page.getByText(text)).toBeVisible();
}

/** Estado observable S1 Pending, visto por el pagador. */
async function expectPending(page: Page, id: string) {
  await expect(page.getByTestId(`transaction-action-${id}`)).toHaveText("requested");
  await expect(page.getByTestId(`transaction-accept-request-${id}`)).toBeVisible();
  await expect(page.getByTestId(`transaction-reject-request-${id}`)).toBeVisible();
}

async function findTransactionId(request: APIRequestContext, description: string) {
  const response = await request.get(`${API_URL}/testData/transactions`);
  await expect(response).toBeOK();
  const { results } = await response.json();
  const transaction = results.find((t: { description: string }) => t.description === description);
  expect(transaction, `la transacción "${description}" debería existir`).toBeTruthy();
  return transaction.id as string;
}

async function getRequestStatus(request: APIRequestContext, id: string) {
  const response = await request.get(`${API_URL}/testData/transactions`);
  const { results } = await response.json();
  return results.find((t: { id: string }) => t.id === id)?.requestStatus as string;
}
