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

## Library versions

Pinned exactly in `package.json` and `package-lock.json`. Node 22.13+ (CI runs Node 22).

| Library | Version | Note |
| ------- | ------- | ---- |
| react, react-dom | 19.3.0 | |
| @dnd-kit/core, @dnd-kit/sortable | 6.3.1, 10.0.0 | peers accept React 19; the spike `sortable.smoke.test.tsx` reorders with the keyboard sensor, so Pragmatic Drag and Drop was not needed |
| zod | 4.6.5 | runtime check of API payloads in `infrastructure` (`parseDto`); no peer dependencies |
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
| msw | 3.0.2 | unhandled requests fail the test (`onUnhandledFrame: 'error'`) |
| vitest-axe, axe-core | 0.1.0, 4.13.0 | matcher types re-declared in `src/test/vitest-axe.d.ts` |
