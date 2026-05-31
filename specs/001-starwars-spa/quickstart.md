# Quickstart: Star Wars Explorer

**Date**: 2026-05-30

This guide describes how to scaffold, run, test, and build the Star Wars Explorer application. Follow these steps after implementation is complete to verify the application works end-to-end.

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | ≥ 18.13 | https://nodejs.org |
| npm | ≥ 9.x | bundled with Node.js |
| Angular CLI | 17.x | `npm install -g @angular/cli@17` |

---

## Project Scaffolding (one-time setup)

```bash
# 1. Scaffold Angular 17 workspace with standalone as default
ng new starwars-explorer --standalone --routing --style=scss

# 2. Move into project
cd starwars-explorer

# 3. Add Angular Material (select Indigo/Pink theme, enable typography + animations)
ng add @angular/material

# 4. Install Jest and jest-preset-angular (replacing Karma/Jasmine)
npm install --save-dev jest @types/jest jest-environment-jsdom jest-preset-angular

# 5. Remove Karma configuration (after jest.config.ts is in place)
npm uninstall karma karma-chrome-launcher karma-coverage karma-jasmine karma-jasmine-html-reporter

# 6. Install Playwright for E2E
npm install --save-dev @playwright/test
npx playwright install chromium
```

---

## Run the Application

```bash
# Start the development server (default: http://localhost:4200)
ng serve

# Open http://localhost:4200 in a browser
# Verify: Characters screen loads with 10 characters and pagination controls
# Verify: Navigate to /films — all films appear as cards
```

---

## Run Unit Tests (JEST)

```bash
# Run all unit tests
npx jest

# Run with coverage report (must reach 100%)
npx jest --coverage

# Run in watch mode during development
npx jest --watch
```

Expected coverage output (all thresholds at 100%):
```
Statements   : 100% ( X/X )
Branches     : 100% ( X/X )
Functions    : 100% ( X/X )
Lines        : 100% ( X/X )
```

---

## Run E2E Tests (Playwright)

```bash
# Start the dev server first (in a separate terminal)
ng serve

# Run all Playwright E2E tests
npx playwright test

# Run with browser UI visible
npx playwright test --headed

# Run a specific test file
npx playwright test e2e/tests/characters.e2e.spec.ts
```

Expected results:
- `characters.e2e.spec.ts`: 5 scenarios pass (list loads, pagination, error state)
- `films.e2e.spec.ts`: 3 scenarios pass (grid loads, error state, loading indicator)
- `navigation.e2e.spec.ts`: 3 scenarios pass (navigate to films, back to characters, active link indicator)

---

## Build for Production

```bash
# Production build (must complete with zero errors and zero budget violations)
ng build

# Verify output size
ls -lh dist/starwars-explorer/browser/

# Check bundle stats (initial chunk must be ≤ 200 kB gzipped)
ng build --stats-json
npx webpack-bundle-analyzer dist/starwars-explorer/browser/stats.json
```

---

## Verify Core Web Vitals

After `ng serve` is running:

1. Open Chrome DevTools → Lighthouse tab
2. Select "Mobile" preset
3. Run audit on `http://localhost:4200`
4. Verify:
   - **LCP** ≤ 2.5 s
   - **CLS** ≤ 0.1
   - **INP** ≤ 200 ms

---

## Environment Configuration

| Variable | File | Default | Description |
|----------|------|---------|-------------|
| `apiUrl` | `src/environments/environment.ts` | `https://swapi.dev/api` | SWAPI base URL |

To point to an alternative SWAPI host:
```typescript
// src/environments/environment.ts
export const environment = {
  apiUrl: 'https://swapi.py4e.com/api'
};
```

---

## Validation Checklist (before opening PR)

- [ ] `ng serve` starts without errors and app opens at `http://localhost:4200`
- [ ] `/characters` shows 10 characters with pagination
- [ ] `/films` shows all ~6 films as cards
- [ ] Navigating between screens works without full page reload
- [ ] Error state shows Portuguese message when network is offline (DevTools → Network → Offline)
- [ ] `npx jest --coverage` passes with 100% coverage
- [ ] `npx playwright test` — all E2E tests pass
- [ ] `ng build` completes with zero errors
- [ ] Lighthouse Mobile LCP ≤ 2.5 s, CLS ≤ 0.1, INP ≤ 200 ms
- [ ] README.md updated with all commands and environment config
