import { test, expect, type Page, type APIRequestContext } from "@playwright/test";
import { API_URL, reseed, signIn, signOut, USERS } from "./support/helpers";

/**
 * MODULE 5 – STATE TRANSITION TESTING (ISTQB CTFL 4.0.1, §4.2.4)
 *
 * Object under test: a money REQUEST transaction in RWA.
 *   Ted (requester) asks Kristian (payer) for money; Kristian accepts or rejects.
 *
 * States
 *   S0 Draft     – the "New transaction" form, nothing saved yet
 *   S1 Pending   – request saved, requestStatus = "pending"
 *   S2 Accepted  – requestStatus = "accepted" (money moved, status "complete")
 *   S3 Rejected  – requestStatus = "rejected"
 *
 * Events: E1 submit "Request", E2 accept, E3 reject, E4 comment
 *
 * Valid transitions        event [guard] / action
 *   T1 S0 -> S1  submit "Request" [amount and note valid] / notify payer
 *   T2 S1 -> S2  accept  [current user is the payer]   / move money, notify requester
 *   T3 S1 -> S3  reject  [current user is the payer]
 *   T4 S1 -> S1  comment / comment added, still pending
 *   T5 S2 -> S2  comment / comment added, still accepted
 *   T6 S3 -> S3  comment / comment added, still rejected
 *
 * Invalid transitions (no Accept/Reject once the request is resolved):
 *   S2 -E2->, S2 -E3->, S3 -E2->, S3 -E3->
 * The main one tried is S3 -- accept -->, through the UI and through the API.
 *
 * Observable state in the UI (transaction detail page, seen by the payer):
 *   Pending  : title "<requester> requested <payer>", Accept/Reject buttons visible
 *   Accepted : title "<requester> charged <payer>",   no Accept/Reject buttons
 *   Rejected : title "<requester> requested <payer>", no Accept/Reject buttons
 */

const AMOUNT = "30";

test.describe("Module 5 - State transition: payment request", () => {
  test.beforeEach(async ({ request }) => {
    await reseed(request);
  });

  test("TC-ST-01 valid sequence: S0 -T1-> S1 -T4-> S1 -T2-> S2 -T5-> S2", async ({ page, request }) => {
    const note = `Concert tickets ${Date.now()}`;

    // T1: S0 Draft -> S1 Pending (Ted submits the request)
    await signIn(page, USERS.ted.username);
    await createRequest(page, USERS.kristian.fullName, AMOUNT, note);
    const id = await findTransactionId(request, note);
    expect(await getRequestStatus(request, id)).toBe("pending");
    await signOut(page);

    // Kristian (the payer) opens the request: state Pending is observable.
    await signIn(page, USERS.kristian.username);
    await page.goto(`/transaction/${id}`);
    await expectPending(page, id);

    // T4: S1 -> S1 (a comment does not change the state)
    await addComment(page, "Sure, sending it now");
    await expectPending(page, id);

    // T2: S1 Pending -> S2 Accepted
    await page.getByTestId(`transaction-accept-request-${id}`).click();
    await expect(page.getByTestId(`transaction-action-${id}`)).toHaveText("charged");
    await expect(page.getByTestId(`transaction-accept-request-${id}`)).toHaveCount(0);
    await expect(page.getByTestId(`transaction-reject-request-${id}`)).toHaveCount(0);
    expect(await getRequestStatus(request, id)).toBe("accepted");

    // T5: S2 -> S2 (commenting keeps it accepted)
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

    // Guard check: the requester cannot accept or reject their own request.
    await page.goto(`/transaction/${id}`);
    await expect(page.getByTestId(`transaction-accept-request-${id}`)).toHaveCount(0);
    await signOut(page);

    // T3: S1 Pending -> S3 Rejected
    await signIn(page, USERS.kristian.username);
    await page.goto(`/transaction/${id}`);
    await expectPending(page, id);
    await page.getByTestId(`transaction-reject-request-${id}`).click();
    expect(await getRequestStatus(request, id)).toBe("rejected");

    // T6: S3 -> S3 (commenting keeps it rejected)
    await page.reload();
    await addComment(page, "Sorry, not this time");

    // Invalid event "accept" in state S3: there is no way to accept it again.
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
      "Known defect: PATCH /transactions/:id does not check the current state, so a rejected request can still be accepted"
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

    // page.request shares Kristian's session cookie with the browser.
    const response = await page.request.patch(`${API_URL}/transactions/${id}`, {
      data: { requestStatus: "accepted" },
    });

    // Expected by the state model: the server refuses, the state stays S3.
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
      "Known defect: updateTransactionById debits the payer for any request update, including a rejection"
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

    // Expected by the model: T3 has no "move money" action, so the balance is
    // unchanged. Signing in again refreshes the balance shown in the side nav.
    await signOut(page);
    await signIn(page, USERS.kristian.username);
    await expect(balance).toHaveText(before!);
  });
});

/** T1: fills the "New transaction" wizard and submits it as a Request. */
async function createRequest(page: Page, payerName: string, amount: string, note: string) {
  await page.getByRole("link", { name: "New" }).click();
  await page.getByPlaceholder("Search...").fill(payerName.split(" ")[0]);
  await page.getByText(payerName).click();
  await page.getByPlaceholder("Amount").fill(amount);
  await page.getByPlaceholder("Add a note").fill(note);
  await page.getByRole("button", { name: "Request" }).click();
  await expect(page.getByRole("heading", { level: 2, name: /^Requested/ })).toContainText(note);
}

/** E4: adds a comment to the open transaction. */
async function addComment(page: Page, text: string) {
  const comment = page.getByPlaceholder("Write a comment...");
  await comment.fill(text);
  await comment.press("Enter");
  await expect(page.getByText(text)).toBeVisible();
}

/** Observable state S1 Pending, seen by the payer. */
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
  expect(transaction, `transaction "${description}" should exist`).toBeTruthy();
  return transaction.id as string;
}

async function getRequestStatus(request: APIRequestContext, id: string) {
  const response = await request.get(`${API_URL}/testData/transactions`);
  const { results } = await response.json();
  return results.find((t: { id: string }) => t.id === id)?.requestStatus as string;
}
