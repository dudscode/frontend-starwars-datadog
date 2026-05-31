---

description: "Task list for Star Wars Explorer — Angular 17 SPA with characters and films listing (swapi.info API)"
---

# Tasks: Star Wars Explorer

**Input**: Design documents from `specs/001-starwars-spa/`

**Prerequisites**: plan.md ✅ | spec.md ✅ | research.md ✅ | data-model.md ✅ | contracts/ ✅

**API**: `https://swapi.info/api` — flat arrays (`Character[]`, `Film[]`), no server-side pagination wrapper.

**Tests**: INCLUDED — JEST (unit, 100% coverage) + MCP Playwright (E2E, 3 user journeys). Tests written FIRST per constitution Principle IV.

**Organization**: Grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: User story this task belongs to ([US1], [US2], [US3])
- Commit after EVERY task (Principle II — include task ID in commit message)

---

## Phase 1: Setup (Project Initialization) ✅

**Purpose**: Scaffold Angular 17 workspace and install all required tooling.

- [x] T001 Scaffold Angular 17 workspace: `ng new starwars-explorer --directory=. --skip-git --standalone --routing --style=scss --skip-tests --defaults`
- [x] T002 Add Angular Material v17: `ng add @angular/material --theme=indigo-pink --typography --animations=enabled --skip-confirmation`
- [x] T003 [P] Configure JEST: install `jest @types/jest jest-environment-jsdom jest-preset-angular ts-node`; create `jest.config.ts` (preset, `setupFilesAfterEnv`, 100% `coverageThreshold`, exclude `app.routes.ts`/`app.config.ts`); create `src/setup-jest.ts` using `setupZoneTestEnv`; update `tsconfig.spec.json` types to `jest`; update `angular.json` to use `@angular-devkit/build-angular:jest`; remove Karma packages
- [x] T004 [P] Configure Playwright: install `@playwright/test`; create `playwright.config.ts` (testDir `./e2e/tests`, baseURL `http://localhost:4200`, Chromium); create `e2e/tests/` directory

---

## Phase 2: Foundational (Blocking Prerequisites) ✅

**Purpose**: Core infrastructure that ALL user stories depend on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T005 Create `src/environments/environment.ts` exporting `environment = { apiUrl: 'https://swapi.info/api' }`
- [x] T006 [P] Create `src/app/models/swapi-page.model.ts` with `SwapiList<T> = T[]` type alias documenting that swapi.info returns flat arrays (no pagination wrapper)
- [x] T007 Create `src/app/app.routes.ts` with lazy `loadComponent` routes: `/characters` → `CharactersComponent`, `/films` → `FilmsComponent`; redirect `''` → `characters` (`pathMatch: 'full'`); wildcard `**` → `characters`
- [x] T008 Create `src/app/app.component.ts` as standalone `OnPush` shell: imports `MatToolbarModule`, `MatButtonModule`, `RouterLink`, `RouterLinkActive`, `RouterOutlet`; template `src/app/app.component.html` with `<mat-toolbar color="primary">` containing app title and nav links (`routerLink="/characters"` label "Personagens", `routerLink="/films"` label "Filmes") both with `routerLinkActive="active"` and `aria-label`; `<router-outlet />` below toolbar
- [x] T009 Configure `src/app/app.config.ts` with `provideRouter(routes, withComponentInputBinding())`, `provideHttpClient(withFetch())`, `provideAnimationsAsync()`
- [x] T010 Configure `src/styles.scss`: Angular Material Indigo/Pink theme via `@use '@angular/material' as mat` + `mat.define-light-theme` + `mat.all-component-themes`; base `html,body` styles; `.films-grid` grid layout; `a.active { border-bottom: 2px solid white; }`
- [x] T011 Write JEST unit test for `AppComponent` in `src/app/app.component.spec.ts`: assert `mat-toolbar` renders, "Personagens" and "Filmes" nav links present, `router-outlet` present

**Checkpoint**: Foundation ready — user story implementation can now begin.

---

## Phase 3: User Story 1 — Browse Star Wars Characters (Priority: P1) 🎯 MVP ✅

**Goal**: User sees a client-side paginated list of 10 Star Wars characters per page (82 total, all fetched and cached in one request). Name, birth year, gender, height, mass displayed per entry. Loading indicator during initial fetch; Portuguese error message with retry on failure.

**API**: `GET https://swapi.info/api/people` → `Character[]` (82 items, flat array, fetched once).

**Independent Test**: Open `/characters`; verify 10 characters render with all 5 fields; click next page — different characters appear without a new network request.

### Tests for User Story 1 ⚠️ Written FIRST — verified to FAIL before implementation

- [x] T012 [P] [US1] Write JEST unit test for `Character`/`CharacterDisplayItem` interfaces and `toCharacterDisplayItem()` in `src/app/models/character.model.spec.ts`: assert field mapping, non-display fields excluded, pure function (no mutation), handles "unknown" values
- [x] T013 [P] [US1] Write JEST unit test for `SwapiService.getCharacters()` in `src/app/core/services/swapi.service.spec.ts`: assert `GET ${apiUrl}/people` (no `?page=` parameter), returns `Character[]`, same observable reference on repeated calls, `Error('Failed to load characters')` on HTTP 500
- [x] T014 [P] [US1] Write JEST unit test for `CharactersComponent` in `src/app/features/characters/characters.component.spec.ts`: assert 10 items on page 0, paginator present, `onPageChange` updates `currentPage` signal, spinner shown before data, Portuguese error message on failure, `retry()` restores signal
- [x] T015 [P] [US1] Write Playwright E2E test in `e2e/tests/characters.e2e.spec.ts`: navigate to `/characters`, assert 10 list items, assert paginator, click next page and verify different characters, assert `/` redirects to `/characters`

### Implementation for User Story 1

- [x] T016 [P] [US1] Create `src/app/models/character.model.ts` exporting `Character` interface (name, birth_year, gender, height, mass, homeworld, films, url), `CharacterDisplayItem` interface (name, birth_year, gender, height, mass), pure function `toCharacterDisplayItem(c: Character): CharacterDisplayItem`
- [x] T017 [US1] Implement `SwapiService.getCharacters(): Observable<Character[]>` in `src/app/core/services/swapi.service.ts`: `GET ${apiUrl}/people` (no page param), lazily cached as `charactersCache$` with `shareReplay(1)`, `catchError` re-throwing `Error('Failed to load characters')` (depends T005, T016)
- [x] T018 [US1] Create `src/app/features/characters/characters.component.ts` as standalone `OnPush`: `currentPage = signal(0)` (0-indexed); `allCharacters$` = `getCharacters().pipe(map(chars => chars.map(toCharacterDisplayItem)), shareReplay(1))`; `pageView$` = `combineLatest([allCharacters$, toObservable(currentPage)]).pipe(map(([all, page]) => ({ items: all.slice(page * 10, (page + 1) * 10), total: all.length })), startWith(null))`; `isLoading$` and `error$` observables; `onPageChange(event: PageEvent)` sets signal; `retry()` bounces signal (depends T016, T017)
- [x] T019 [US1] Create `src/app/features/characters/characters.component.html`: fixed-`min-height: 600px` container; spinner block; error block with Portuguese message and retry button; content block with `pageView$ | async as page` → `<mat-list>` + `*ngFor` over `page.items` rendering `mat-list-item` (name, birth_year, gender, height, mass); `<mat-paginator [length]="page.total" [pageSize]="pageSize" [hidePageSize]="true">` (depends T018)
- [x] T020 [US1] Create `src/app/features/characters/characters.component.scss`: `.characters-page { min-height: 600px }`, `.loading-container`, `.error-container`, `.error-message`, `.characters-list`, `.character-item` styles (depends T018)

**Checkpoint**: Navigate to `/characters` — 10 characters display; clicking next page changes them without spinner; error message in offline mode.

---

## Phase 4: User Story 2 — Browse Star Wars Films (Priority: P2) ✅

**Goal**: User sees all 6 Star Wars films as cards with episode number, title, director, release date. No pagination. Films cached — revisit instant, no new network request.

**API**: `GET https://swapi.info/api/films` → `Film[]` (6 items, flat array, fetched once).

**Independent Test**: Navigate to `/films`; verify 6 film cards; navigate away and back; no new network request observed.

### Tests for User Story 2 ⚠️ Written FIRST — verified to FAIL before implementation

- [x] T021 [P] [US2] Write JEST unit test for `Film`/`FilmDisplayItem` interfaces and `toFilmDisplayItem()` in `src/app/models/film.model.spec.ts`: assert field mapping, non-display fields excluded, pure function, `episode_id` stays numeric
- [x] T022 [P] [US2] Add `SwapiService.getFilms()` tests to `src/app/core/services/swapi.service.spec.ts`: assert `GET ${apiUrl}/films` (no query params), returns `Film[]`, same observable reference on repeated calls, `Error('Failed to load films')` on HTTP 500
- [x] T023 [P] [US2] Write JEST unit test for `FilmsComponent` in `src/app/features/films/films.component.spec.ts`: assert film cards rendered, spinner shown before data (Subject mock), Portuguese error message on failure, `films$` emits null on error, `retry()` calls `window.location.reload`
- [x] T024 [P] [US2] Write Playwright E2E test in `e2e/tests/films.e2e.spec.ts`: navigate to `/films`, assert `mat-card` elements, assert episode number and title visible, navigate away and back without new SWAPI network request

### Implementation for User Story 2

- [x] T025 [P] [US2] Create `src/app/models/film.model.ts` exporting `Film` interface (episode_id, title, director, producer, release_date, opening_crawl, characters, url), `FilmDisplayItem` interface (episode_id, title, director, release_date), pure function `toFilmDisplayItem(f: Film): FilmDisplayItem`
- [x] T026 [US2] Implement `SwapiService.getFilms(): Observable<Film[]>` in `src/app/core/services/swapi.service.ts`: `GET ${apiUrl}/films`, lazily cached as `filmsCache$` with `shareReplay(1)`, `catchError` re-throwing `Error('Failed to load films')` (depends T005, T025)
- [x] T027 [US2] Create `src/app/features/films/films.component.ts` as standalone `OnPush`: `films$` = `getFilms().pipe(map(films => films.map(toFilmDisplayItem)), catchError(() => of(null)), shareReplay(1))`; `isLoading$` with `catchError` + `startWith(true)`; `error$` with `catchError` + `startWith(null)`; `retry()` calls `window.location.reload()` (depends T025, T026)
- [x] T028 [US2] Create `src/app/features/films/films.component.html`: fixed-`min-height: 400px` container; spinner block; error block with Portuguese message and retry button; `.films-grid` div with `*ngFor` over `films$ | async` rendering one `<mat-card>` per film (`mat-card-header`: episode + title; `mat-card-content`: director + release date) (depends T027)
- [x] T029 [US2] Create `src/app/features/films/films.component.scss`: `.films-page { min-height: 400px }`, `.loading-container`, `.error-container`, `.error-message`, `.film-card` styles (depends T027)

**Checkpoint**: Navigate to `/films` — 6 film cards display; navigate away and back — data appears instantly with no spinner.

---

## Phase 5: User Story 3 — Navigate Between Screens (Priority: P3) ✅

**Goal**: Persistent top navigation bar allows switching between Characters and Films screens. Active screen visually highlighted.

**Independent Test**: From `/characters` click "Filmes" → Films screen, no full reload. From `/films` click "Personagens" → Characters screen. Active nav link has underline.

### Tests for User Story 3 ⚠️ Written FIRST — verified to FAIL before implementation

- [x] T030 [P] [US3] Write Playwright E2E test in `e2e/tests/navigation.e2e.spec.ts`: from `/characters` click "Filmes" → URL `/films`, films content visible; click "Personagens" → URL `/characters`; active link has `.active` CSS class; unknown path redirects to `/characters`

### Implementation for User Story 3

- [x] T031 [US3] Verify `src/app/app.component.ts` and `src/app/app.component.html`: `routerLinkActive="active"` on both nav links; `.active { border-bottom: 2px solid white }` in `src/styles.scss`; both links have `aria-label`; app title "Star Wars" in toolbar (depends T008, T010)

**Checkpoint**: All three user stories independently functional; navigation confirmed with active indicator.

---

## Phase N: Polish & Cross-Cutting Concerns ✅

**Purpose**: Quality gates, performance verification, and documentation before PR.

- [x] T032 [P] Run `npx jest --coverage` and verify 100% coverage (statements, branches, functions, lines) — 34 tests pass, all 6 suites green
- [x] T033 [P] Run `npx playwright test` and verify all E2E tests pass (requires `ng serve` running)
- [x] T034 Run `ng build` and verify zero errors, no budget violations; gzipped initial bundle ≤ 200 kB (~107 kB actual)
- [x] T035 Run `ng serve` and manually verify: Characters screen loads 10 items + paginator; Films screen loads 6 cards; navigation works; loading indicators visible; error state in offline mode (DevTools → Network → Offline) shows Portuguese message
- [x] T036 [P] Run Lighthouse Mobile audit on `http://localhost:4200` and verify LCP ≤ 2.5 s, CLS ≤ 0.1, INP ≤ 200 ms
- [x] T037 Create/update `README.md` with project overview, prerequisites (Node 18+, Angular CLI 17), commands (`ng serve`, `npx jest --coverage`, `npx playwright test`, `ng build`), environment variables (`apiUrl`), Core Web Vitals targets

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 — can start independently of US2
- **US2 (Phase 4)**: Depends on Phase 2 — can start independently of US1
- **US3 (Phase 5)**: Depends on Phase 2 (AppComponent shell); E2E validation requires US1+US2 screens
- **Polish (Phase N)**: Depends on all user story phases

### User Story Dependencies

- **US1 (P1)**: No dependency on US2 or US3
- **US2 (P2)**: No dependency on US1 or US3; `SwapiService.getFilms()` added to same service file as `getCharacters()` (sequential within service)
- **US3 (P3)**: AppComponent nav bar built in Phase 2; only E2E validation requires US1+US2

### Within Each User Story

1. Tests MUST be written and verified to FAIL before implementation (Red-Green-Refactor)
2. Model interfaces → service method → component TypeScript → HTML template → SCSS
3. Commit after each task (Principle II)

### Parallel Opportunities

- T003 and T004 can run in parallel (Jest config vs Playwright config — different files)
- T012, T013, T014, T015 can all run in parallel (US1 tests — different files)
- T016 can run in parallel with T012–T015 (pure model, no dependencies)
- T021, T022, T023, T024 can all run in parallel (US2 tests — different files)
- T025 can run in parallel with T021–T024
- T032, T033, T034, T036 can run in parallel (different tools)

---

## Parallel Example: User Story 1 Tests

```bash
# All US1 test files written simultaneously (each must fail before implementation):
Task T012: src/app/models/character.model.spec.ts
Task T013: src/app/core/services/swapi.service.spec.ts
Task T014: src/app/features/characters/characters.component.spec.ts
Task T015: e2e/tests/characters.e2e.spec.ts
# Once all FAIL → proceed T016 → T017 → T018 → T019 → T020 in order
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T004)
2. Complete Phase 2: Foundational (T005–T011) — CRITICAL
3. Write US1 tests (T012–T015) → verify they FAIL
4. Implement US1 (T016–T020)
5. **STOP and VALIDATE**: `ng serve` → `/characters` works independently

### Incremental Delivery

1. Setup + Foundational → app shell at `http://localhost:4200`
2. Add US1 → Characters screen with client-side pagination → validate independently
3. Add US2 → Films screen with instant revisit cache → validate independently
4. Add US3 validation → Navigation fully confirmed
5. Polish → 100% coverage, all E2E green, `ng build` passes, README complete → open PR

---

## Notes

- [P] tasks = different files, no shared dependencies — safe to run in parallel
- [Story] label maps task to user story for traceability
- **Commit after EACH task** (Principle II) — format: `feat(scope): description (TXX)`
- Tests MUST fail before implementation (Red-Green-Refactor, Principle IV)
- **Unit tests**: JEST only — `jest-preset-angular@14` for Angular 17
- **E2E tests**: Playwright only
- **No `?page=` parameter**: swapi.info returns all characters at once; pagination is client-side
- **Both datasets cached**: `SwapiService` uses `charactersCache$` and `filmsCache$` with `shareReplay(1)`
- **Build gate**: `ng build` MUST pass before PR (Principle III)
- **README**: T037 must be complete before PR (Principle V)
- Coverage threshold: 100% statements, branches, functions, lines (enforced in `jest.config.ts`)
