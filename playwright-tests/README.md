# Pruebas con Playwright – Taller Investigativo Tercer Corte

Pruebas y Calidad de Software – Universidad ECCI. Suite de Playwright sobre Cypress Real World App (RWA).

**Autores:** Johan Alejandro Gonzalez Cortes y Miguel Angel Reyes.

| Archivo | Módulo |
| --- | --- |
| `01-locators.spec.ts` | 1 – Localizadores |
| `02-actions.spec.ts` | 2 – Acciones |
| `03-assertions.spec.ts` | 3 – Aserciones |
| `04-decision-table.spec.ts` | 4 – Tabla de decisión (regla de inicio de sesión, parametrizada) |
| `05-state-transition.spec.ts` | 5 – Transición de estados (ciclo de vida de una solicitud de dinero) |
| `support/helpers.ts` | Utilidades compartidas: re-sembrar la base de datos, iniciar/cerrar sesión, usuarios semilla |

## Cómo ejecutar

```bash
yarn install
npx playwright install chromium
yarn test:pw          # levanta RWA (yarn dev) automáticamente si no está corriendo
yarn test:pw:ui       # UI Mode
yarn test:pw:report   # reporte HTML
```

Cada test vuelve a sembrar la base de datos con `POST /testData/seed`, por eso la suite corre con un solo worker.

`TC-ST-03` y `TC-ST-04` están marcados con `test.fail()`: documentan dos defectos del backend de RWA
(una solicitud rechazada todavía se puede aceptar por la API, y rechazar una solicitud igual mueve el dinero).
