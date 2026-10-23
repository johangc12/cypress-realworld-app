# Playwright tests – Taller Investigativo Tercer Corte

Pruebas y Calidad de Software – Universidad ECCI. Playwright suite for the Cypress Real World App.

| File | Module |
| --- | --- |
| `01-locators.spec.ts` | 1 – Locators |
| `02-actions.spec.ts` | 2 – Actions |
| `03-assertions.spec.ts` | 3 – Assertions |
| `04-decision-table.spec.ts` | 4 – Decision table (sign-in rule, parameterized) |
| `05-state-transition.spec.ts` | 5 – State transition (money request lifecycle) |
| `support/helpers.ts` | Shared helpers: database re-seed, sign in/out, seed users |

## Run

```bash
yarn install
npx playwright install chromium
yarn test:pw          # starts RWA (yarn dev) automatically if it is not running
yarn test:pw:ui       # UI Mode
yarn test:pw:report   # HTML report
```

Every test re-seeds the database through `POST /testData/seed`, so the suite runs with one worker.

`TC-ST-03` and `TC-ST-04` are marked with `test.fail()`: they document two defects in the RWA backend
(a rejected request can still be accepted through the API, and rejecting a request still moves money).
