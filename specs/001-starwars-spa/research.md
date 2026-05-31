# Research: Star Wars Explorer

**Phase 0 output for**: `specs/001-starwars-spa/plan.md`
**Date**: 2026-05-30 (revised after swapi.info clarification)

---

## Decision 1: SWAPI Instance — swapi.info

**Decision**: Use `https://swapi.info/api` as the base URL, stored in `environment.ts`.

**Rationale**: `swapi.info` is the correct public SWAPI instance for this project (confirmed in spec clarification 2026-05-30). Its API contract differs fundamentally from `swapi.dev`:

| | swapi.dev | swapi.info |
|---|---|---|
| Response shape | `{count, next, previous, results[]}` | `T[]` (flat array) |
| People endpoint | `GET /people/?page=1` (paginated) | `GET /people` (all 82 at once) |
| Films endpoint | `GET /films/` (wrapped) | `GET /films` (flat array of 6) |
| Trailing slash | Required | Not used |
| CORS | Supported | Supported |

**Alternatives considered**:
- `swapi.dev` → rejected: wrong API; has pagination wrapper that does not exist on swapi.info; also has known uptime issues.

---

## Decision 2: Pagination Strategy — Client-Side

**Decision**: Load all 82 characters in a single `GET /people` request, cache with `shareReplay(1)`, and paginate client-side using `MatPaginator` + array slice.

**Rationale**: swapi.info has no server-side pagination parameter. The full dataset (82 items) is small enough to cache without concern. Client-side pagination delivers:
- Instant page navigation (no network round-trip after first load)
- Simpler service interface (no `page` parameter)
- Better CLS (no re-fetch spinner on page change after initial load)

**Implementation pattern**:
```typescript
combineLatest([allCharacters$, toObservable(currentPage)]).pipe(
  map(([all, page]) => ({
    items: all.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    total: all.length,
  }))
)
```

**Alternatives considered**:
- Show all 82 characters without pagination → rejected: spec FR-002 mandates 10/page pagination.
- Infinite scroll → rejected: spec explicitly requires `MatPaginator` navigation controls.

---

## Decision 3: Both Datasets Cached with shareReplay(1)

**Decision**: `SwapiService` caches both `getCharacters()` and `getFilms()` observables as private class fields (`charactersCache$`, `filmsCache$`) initialised lazily on first call.

**Rationale**: 
- Characters: the client-side pagination approach requires the full array to be available; re-fetching on every page navigation would defeat the purpose.
- Films: static dataset (6 items); re-fetching on re-navigation wastes network bandwidth.
- `shareReplay(1)` ensures all subsequent subscribers receive the cached emission immediately, satisfying spec SC-005 (revisit Films in < 100 ms) and reducing network requests.

---

## Decision 4: Angular 17 Standalone with JEST

**Decision**: `ng new --standalone`, bootstrapped via `app.config.ts` / `bootstrapApplication`. JEST with `jest-preset-angular@14` replaces Karma/Jasmine.

**Rationale**: Angular 17 makes standalone the default. `jest-preset-angular@14` is the correct version for Angular 17 (`v15+` requires Angular 19+). Constitution Principle IV mandates JEST; `karma` is removed entirely.

**Key jest config decisions**:
- `jest.config.ts` requires `ts-node` as a peer dependency
- `setupFilesAfterEnv` uses `jest-preset-angular/setup-env/zone` (new API; `setup-jest.js` import is deprecated)
- `coverageThreshold` (not `coverageThresholds`) at 100% for all metrics
- `app.routes.ts` and `app.config.ts` excluded from coverage collection (pure configuration)

---

## Decision 5: combineLatest + Signal for Client-Side Pagination

**Decision**: Use `combineLatest([allCharacters$, toObservable(currentPage)])` to reactively recompute the current page slice whenever either the data arrives or the user navigates pages.

**Rationale**: `toObservable` from `@angular/core/rxjs-interop` bridges Angular signals to RxJS observables, enabling the `async` pipe pattern in the template without manual subscriptions. `combineLatest` ensures the latest emission from BOTH streams is used, which is correct: if data arrives after a page change, the view updates; if the page changes after data arrives, the view also updates.

**Alternatives considered**:
- `switchMap` on signal changes → only works if we want to re-fetch per page (not applicable here since data is cached).
- Signal-only approach (no observable) → would require `NgSignals` pipe or computed signals for the template; less idiomatic in Angular 17 with `async` pipe.

---

## Decision 6: MCP Playwright for E2E Tests

**Decision**: `@playwright/test` for E2E, targeting `http://localhost:4200` with Chromium.

**Rationale**: Constitution Principle IV mandates MCP Playwright exclusively. Three test files covering US1, US2, US3 user journeys.

---

## NEEDS CLARIFICATION — All Resolved

| Item | Resolution |
|------|------------|
| SWAPI instance and endpoint structure | swapi.info, flat arrays, no pagination wrapper (spec clarification 2026-05-30) |
| Pagination approach | Client-side via array slice + MatPaginator |
| Fields displayed per character | name, birth_year, gender, height, mass |
| Fields displayed per film | episode_id, title, director, release_date |
| Default landing route | `/characters` |
| Language for UI copy | Portuguese |
| Detail screens | Listing-only; no detail routes |
