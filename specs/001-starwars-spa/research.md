# Research: Star Wars Explorer

**Phase 0 output for**: `specs/001-starwars-spa/plan.md`
**Date**: 2026-05-30

All technical choices were pre-resolved from the SPDD REASONS Canvas analysis (`spdd/analysis/`) and implementation prompt (`spdd/prompt/`). This document consolidates the key decisions, rationale, and alternatives considered.

---

## Decision 1: Angular 17 Standalone Architecture

**Decision**: Use Angular CLI v17 with `--standalone` flag; bootstrap via `bootstrapApplication`; no `NgModule` anywhere.

**Rationale**: Angular 17 makes standalone the default and recommended mode. It eliminates the `NgModule` indirection layer, enables better tree-shaking (only imported components are bundled), and aligns with Angular's long-term direction. The `loadComponent` API for lazy-loaded routes is standalone-native and directly reduces the initial bundle.

**Alternatives considered**:
- NgModule-based architecture → rejected: contradicts explicit project requirement and inflates initial bundle.

---

## Decision 2: JEST + jest-preset-angular for Unit Testing

**Decision**: Replace Angular CLI's default Karma/Jasmine test runner with JEST using the `jest-preset-angular` preset.

**Rationale**: The project constitution mandates JEST exclusively (Principle IV). JEST runs in Node.js via jsdom (faster than browser-based Karma), supports parallel test execution, and has superior snapshot testing and coverage reporting. `jest-preset-angular` provides a TypeScript transformer and Angular-specific setup that makes the transition seamless.

**Setup steps**:
1. `npm install --save-dev jest @types/jest jest-environment-jsdom jest-preset-angular`
2. Add `jest.config.ts` pointing to `jest-preset-angular` preset
3. Add `setup-jest.ts` importing `jest-preset-angular/setup-jest`
4. Remove `karma.conf.js` and `src/test.ts`
5. Update `tsconfig.spec.json` to use `jest-preset-angular/build/ts-jest-transformer`
6. Add Jest coverage thresholds (100%) to `jest.config.ts`

**Alternatives considered**:
- Vitest → rejected (not a JEST runner; constitution explicitly prohibits non-JEST frameworks).
- Keep Karma → rejected (constitution Principle IV mandates JEST).

---

## Decision 3: MCP Playwright for E2E Tests

**Decision**: Use MCP Playwright (`@playwright/test`) for end-to-end testing of all 3 user journeys.

**Rationale**: Constitution Principle IV mandates MCP Playwright exclusively. Playwright supports multiple browsers (Chromium, Firefox, WebKit), has a clean async API, and integrates well with Angular applications. Tests live in `/e2e/tests/`.

**E2E coverage required** (from spec user stories):
- `characters.e2e.spec.ts` → US1: Characters list loads, pagination works, error state shown
- `films.e2e.spec.ts` → US2: Films grid loads, error state shown
- `navigation.e2e.spec.ts` → US3: Navigate between screens, active link highlighted

**Alternatives considered**:
- Cypress → rejected (constitution prohibition).
- Protractor → rejected (deprecated + constitution prohibition).

---

## Decision 4: SWAPI API Endpoint Selection

**Decision**: Use `https://swapi.dev/api` as the base URL, stored in `environment.ts`.

**Rationale**: `swapi.dev` is the canonical public SWAPI instance. It supports CORS for browser requests, requires no authentication, and has been stable since 2014. The base URL is externalised to `environment.ts` so it can be overridden without code changes.

**Key endpoints consumed**:
- `GET /people/?page={n}` — paginated characters (10/page, ~82 total)
- `GET /films/` — all films in a single response (~6 total)

**Alternatives considered**:
- `swapi.py4e.com` → same API, different host; available as a fallback if `swapi.dev` has downtime. Not set as default to keep environment simple.

---

## Decision 5: Routing Strategy — `loadComponent` Lazy Loading

**Decision**: Use `loadComponent(() => import(...))` for both `CharactersComponent` and `FilmsComponent` in `app.routes.ts`.

**Rationale**: This is the Angular 17 standalone-native approach to lazy loading. Each route's component JS chunk is only downloaded when the user navigates to that route, reducing the initial bundle size and improving LCP. The Angular router handles splitting automatically.

**Alternatives considered**:
- Eagerly imported routes → rejected (larger initial bundle, degrades LCP).
- `loadChildren` with route modules → rejected (requires `NgModule`, contradicts standalone mandate).

---

## Decision 6: Change Detection — `OnPush` on All Components

**Decision**: All components declare `changeDetection: ChangeDetectionStrategy.OnPush`.

**Rationale**: `OnPush` limits Angular's dirty-checking reconciliation cycle to explicit input changes, emitted events, and async pipe emissions. For a data-display app driven by observables, this means zero unnecessary DOM traversals between page navigations — directly improving INP.

**Alternatives considered**:
- Default change detection → rejected (triggers on every browser event, degrades INP).

---

## Decision 7: Films Caching — `shareReplay(1)` on Service Observable

**Decision**: `SwapiService.getFilms()` returns a lazily initialised `shareReplay(1)` observable stored as a private class field `filmsCache$`.

**Rationale**: Films are a static dataset (~6 items, no pagination). Once fetched, the same data serves all subsequent navigations to the Films screen without a new HTTP request. `shareReplay(1)` replays the last emission to new subscribers and is the idiomatic RxJS caching pattern. This satisfies spec SC-005 (revisit Films in < 100 ms).

**Alternatives considered**:
- `localStorage` / `IndexedDB` → overkill for an in-session, read-only, 6-item dataset.
- Re-fetch on every navigation → wastes network and degrades INP.

---

## Decision 8: Loading State & CLS Prevention

**Decision**: Each listing component has a fixed-`min-height` container. The loading spinner occupies the same vertical space as the list/grid, preventing layout reflow when data arrives.

**Rationale**: CLS (Cumulative Layout Shift) penalises pages where content shifts after initial paint. Setting `min-height: 600px` on the characters container and `min-height: 400px` on the films container ensures the page layout is stable regardless of loading state. This is the primary mechanism for hitting CLS ≤ 0.1.

---

## Decision 9: Error Handling — Inline Error State + Retry

**Decision**: Each component exposes an `error$` observable derived from the data stream via `catchError`. When an error occurs, an inline error message in Portuguese is rendered with a retry button.

**Rationale**: The spec mandates Portuguese error messages (FR-007) and a retry option. Using inline state (not a `MatSnackBar` toast) keeps the error visible as long as the problem persists. The retry button re-triggers the observable chain by calling the service method again.

---

## NEEDS CLARIFICATION — All Resolved

All ambiguities identified in the SPDD analysis phase are resolved:

| Item | Resolution |
|------|------------|
| Fields to display per character | name, birth_year, gender, height, mass |
| Fields to display per film | episode_id, title, director, release_date |
| Pagination vs full list | MatPaginator for characters (server-side 10/page); no pagination for films |
| Default landing route | `/characters` (redirect from `''`) |
| Language for UI copy | Portuguese (consistent with requirement language) |
| Detail screens | Listing-only; no detail routes |
| SWAPI instance | `swapi.dev` as primary, base URL in `environment.ts` |
