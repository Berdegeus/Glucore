# Glucore Web

Dashboard SPA (Vite + React + TypeScript). It talks only to the gateway, straight from the browser, with CORS.

## Setup

```bash
cd web
npm ci
cp .env.example .env    # VITE_API_URL = gateway origin
npm run dev             # http://localhost:5173
```

`VITE_API_URL` is read at build time and lands in the bundle, so it holds the public gateway origin only, never a secret.

## Scripts

| Script | What it checks |
| ------ | -------------- |
| `npm run typecheck` | `tsc -b`, strict mode |
| `npm run lint` | ESLint, zero warnings allowed |
| `npm run lint:arch` | dependency-cruiser layer and isolation rules over `src` |
| `npm run test` / `npm run test:coverage` | Vitest (coverage with v8) |
| `npm run dup` | jscpd duplication over `src` |
| `npm run build` | typecheck + production build into `dist` |
| `npm run size` | gzip size of the initial JavaScript against the 250 kB budget |

## Source layout

`src/{app,composition,shared,features}`. Each feature has `domain`, `application`, `infrastructure` and `presentation`. `composition/` is the only place that wires the layers. The rules live in `.dependency-cruiser.cjs`; the reasoning is in `.specs/features/web-dashboard/design.md`.

## Lighthouse (RSP-11)

Goal: accessibility score of at least 90 on the login page and on the patient dashboard, measured on the production build. `lighthouserc.json` lists the two URLs (`http://localhost:4173/login`, `http://localhost:4173/paciente`) and asserts `categories:accessibility >= 0.9` on every report.

This is measured in the validation phase, not in CI: the dashboard needs a real session, so the run needs the full backend up. In CI, accessibility is covered by `vitest-axe` in the component tests.

How the run authenticates: the access token lives in `sessionStorage` (ACC-12), which belongs to one browser tab, and `lhci collect` (and so `npx lhci autorun`) opens a fresh tab for each URL. Run that way, the dashboard would redirect to `/login` and the login page would be measured twice. So `scripts/lighthouseLogin.mjs` does the collection instead: it starts `vite preview` on port 4173, measures the login page, then signs in through the real login form in a new tab, waits for `/paciente`, and runs Lighthouse in that same tab with `disableStorageReset`. It fails if that run does not end on `/paciente`. Reports land in `.lighthouseci/` (`lhr-*.json` and `.html`), where `lhci assert` reads them.

Steps:

```bash
# 1. Backend: Postgres, then gateway (:3000), auth-service (:3002) and glucose-service (:3001), see backend/README.md.
#    If the gateway sets CORS_ORIGIN, it must include http://localhost:4173.
# 2. A local PATIENT account to sign in with (register one against the local backend; never a real account).
# 3. Chrome installed; set CHROME_PATH if it is not in the default location.
cd web
cp .env.example .env              # VITE_API_URL=http://localhost:3000, read by the build
LH_EMAIL=<local patient e-mail> LH_PASSWORD=<its password> npm run lighthouse
```

`npm run lighthouse` runs `npm run build`, then `node scripts/lighthouseLogin.mjs`, then `lhci assert --config=lighthouserc.json`, and exits non-zero if either page scores below 90. Open the `.html` reports in `.lighthouseci/` for the details. Tools, pinned exactly: `@lhci/cli` 0.15.1, `lighthouse` 12.6.1 (the version `@lhci/cli` bundles), `puppeteer-core` 24.43.1 (the version `lighthouse` resolves; `-core` downloads no browser on `npm ci`).

## Library versions

Pinned exactly in `package.json` and `package-lock.json`. Node 22.13+ (CI runs Node 22).

| Library | Version | Note |
| ------- | ------- | ---- |
| react, react-dom | 19.3.0 | |
| @dnd-kit/core, @dnd-kit/sortable | 6.3.1, 10.0.0 | peers accept React 19; the spike `sortable.smoke.test.tsx` reorders with the keyboard sensor, so Pragmatic Drag and Drop was not needed |
| react-router | 7.18.4 | 8.x is out but needs Node 22.22+; 7.x keeps the Node 22.13 floor. Peers `react >=18` |
| @tanstack/react-query | 5.104.1 | server state; peer `react ^18 \|\| ^19` |
| zod | 4.6.5 | runtime check of API payloads in `infrastructure` (`parseDto`); no peer dependencies |
| recharts | 3.10.1 | charts; imported only under `src/shared/presentation/charts/` (ARQ-11). Peers `react ^19`, `react-dom ^19` and `react-is ^19` are met by 19.3.0; no peer conflict |
| react-is | 19.3.0 | peer of recharts, pinned to the React version |
| vite | 8.3.2 | |
| @vitejs/plugin-react | 6.1.1 | |
| typescript | 6.0.3 | 7.x is out, but `typescript-eslint` 8 accepts `<6.1.0` |
| @types/react, @types/react-dom | 19.3.0 | |
| @types/node | 22.20.5 | matches the CI Node line |
| eslint, @eslint/js | 9.39.5 | maintenance line; 10.x is out, but `eslint-plugin-react` and `eslint-plugin-jsx-a11y` declare peers up to ESLint 9 |
| typescript-eslint | 8.71.0 | |
| eslint-plugin-react-hooks | 7.1.1 | |
| eslint-plugin-jsx-a11y | 6.10.2 | |
| eslint-plugin-react | 7.37.5 | only `react/no-danger` is enabled |
| @eslint-community/eslint-plugin-eslint-comments | 4.8.1 | a disable comment needs a `-- reason` |
| globals | 17.13.0 | |
| dependency-cruiser | 18.5.0 | |
| jscpd | 5.4.0 | |
| vitest, @vitest/coverage-v8 | 5.0.3 | projects: `core` (domain/application, Node), `dom` (jsdom), `tooling` (tests/) |
| jsdom | 29.1.1 | 30.x needs Node 22.22+/24.15+ |
| @testing-library/react | 16.3.3 | |
| @testing-library/dom | 10.4.2 | |
| @testing-library/jest-dom | 7.0.1 | |
| @testing-library/user-event | 14.6.7 | keyboard and pointer interaction in component tests; peers `@testing-library/dom >=7.21.4` |
| msw | 3.0.2 | unhandled requests fail the test (`onUnhandledFrame: 'error'`) |
| vitest-axe, axe-core | 0.1.0, 4.13.0 | matcher types re-declared in `src/test/vitest-axe.d.ts` |
