# Quickstart: Star Wars Explorer

**Date**: 2026-05-30 (revised for swapi.info API)

This guide describes how to scaffold, run, test, and build the Star Wars Explorer application.

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | ≥ 18.13 | https://nodejs.org |
| npm | ≥ 9.x | bundled with Node.js |
| Angular CLI | 17.x | `npm install -g @angular/cli@17` |

---

## Install Dependencies

```bash
git clone https://github.com/dudscode/frontend-starwars-datadog.git
cd frontend-starwars-datadog
git checkout 001-starwars-spa
npm install
```

---

## Run the Application

```bash
ng serve
# Open: http://localhost:4200
# → Redirects to /characters; loads 82 characters from swapi.info, paginated 10/page
# → Navigate to /films; loads 6 films from swapi.info as cards
```

---

## Run Unit Tests (JEST)

```bash
# Run all unit tests
npm test

# Run with coverage report (target: 100%)
npx jest --coverage
```

Expected output:
```
Test Suites: 6 passed, 6 total
Tests:       34 passed, 34 total
All files    | 100% Stmts | 100% Branch | 100% Funcs | 100% Lines
```

---

## Run E2E Tests (Playwright)

```bash
# Terminal 1: start dev server
ng serve

# Terminal 2: run E2E tests
npx playwright test

# With browser UI
npx playwright test --headed

# Specific file
npx playwright test e2e/tests/characters.e2e.spec.ts
```

---

## Build for Production

```bash
ng build
# Output: dist/starwars-explorer/
# Initial gzipped transfer: ~107 kB (well under 200 kB target)
```

---

## Verify Core Web Vitals

1. Run `ng serve`
2. Open Chrome DevTools → Lighthouse → Mobile → Analyze page load on `http://localhost:4200`
3. Targets: LCP ≤ 2.5 s | CLS ≤ 0.1 | INP ≤ 200 ms

---

## Environment Configuration

| Variable | File | Default | Description |
|----------|------|---------|-------------|
| `apiUrl` | `src/environments/environment.ts` | `https://swapi.info/api` | swapi.info base URL |

To switch to an alternative SWAPI host:
```typescript
// src/environments/environment.ts
export const environment = {
  apiUrl: 'https://swapi.dev/api', // NOTE: swapi.dev uses pagination wrapper — incompatible
};
```

> ⚠️ **Important**: `swapi.dev` uses a `{count, next, previous, results}` pagination wrapper. The application is built for `swapi.info` which returns flat arrays. Changing the host requires verifying the response shape matches.

---

## Manual Validation Checklist

- [ ] `ng serve` starts without errors; app opens at `http://localhost:4200`
- [ ] `/characters` shows 10 characters with name, birth year, gender, height, mass
- [ ] Paginator at bottom; clicking next page shows different characters (no network request)
- [ ] `/films` shows 6 film cards with episode number, title, director, release date
- [ ] Navigating away from `/films` and back shows data instantly (no spinner, no network request)
- [ ] Error state: enable DevTools → Network → Offline, reload — Portuguese error message appears
- [ ] `npx jest --coverage` → 34 tests pass, 100% coverage
- [ ] `npx playwright test` → all E2E tests pass (requires `ng serve` running)
- [ ] `ng build` completes with zero errors
- [ ] Lighthouse Mobile: LCP ≤ 2.5 s, CLS ≤ 0.1, INP ≤ 200 ms
- [ ] README is current
