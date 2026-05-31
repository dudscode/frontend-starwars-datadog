---

description: "Task list for Star Wars Explorer — Angular 17 SPA with characters and films listing"
---

# Tasks: Star Wars Explorer

**Input**: Design documents from `specs/001-starwars-spa/`

**Prerequisites**: plan.md ✅ | spec.md ✅ | research.md ✅ | data-model.md ✅ | contracts/ ✅

**Tests**: Tests are INCLUDED (TDD — constitution Principle IV mandates JEST 100% + Playwright. Tests MUST be written first and verified to FAIL before implementation.)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to ([US1], [US2], [US3])
- Commit after EVERY task (Principle II — include task ID in commit message)

---

## Phase 1: Setup (Project Initialization)

**Purpose**: Scaffold the Angular 17 workspace and install all required tooling.

- [ ] T001 Scaffold Angular 17 workspace with standalone defaults: `ng new starwars-explorer --standalone --routing --style=scss` (run in parent directory, then move contents to repo root or init inside repo)
- [ ] T002 Add Angular Material v17: run `ng add @angular/material` inside the workspace (select Indigo/Pink theme, enable typography and browser animations)
- [ ] T003 [P] Replace Karma/Jasmine with JEST: install `jest @types/jest jest-environment-jsdom jest-preset-angular`, create `jest.config.ts` with `jest-preset-angular` preset and 100% coverage thresholds, create `src/setup-jest.ts`, update `tsconfig.spec.json`, update `package.json` test script to `jest`, remove `karma.conf.js` and `src/test.ts`
- [ ] T004 [P] Configure Playwright: install `@playwright/test`, run `npx playwright install chromium`, create `playwright.config.ts` pointing to `http://localhost:4200` and test dir `e2e/tests/`, create `e2e/tests/` directory

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that ALL user stories depend on — must be complete before any story work begins.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T005 Create `src/environments/environment.ts` exporting `environment = { apiUrl: 'https://swapi.dev/api' }`
- [ ] T006 [P] Create `src/app/models/swapi-page.model.ts` exporting `SwapiPage<T>` interface with fields `count: number`, `next: string | null`, `previous: string | null`, `results: T[]`
- [ ] T007 Create `src/app/app.routes.ts` with lazy `loadComponent` routes for `/characters` and `/films`, redirect `''` → `characters` (`pathMatch: 'full'`), and wildcard `**` → `characters`
- [ ] T008 Create `src/app/app.component.ts` as standalone `OnPush` shell component importing `MatToolbarModule`, `MatButtonModule`, `RouterLink`, `RouterLinkActive`, `RouterOutlet`; template in `src/app/app.component.html` with `<mat-toolbar color="primary">` containing app title and nav links `routerLink="/characters"` (label "Personagens") and `routerLink="/films"` (label "Filmes") with `routerLinkActive="active"`; `<router-outlet>` below toolbar
- [ ] T009 Configure `src/main.ts` calling `bootstrapApplication(AppComponent, { providers: [provideRouter(routes, withComponentInputBinding()), provideHttpClient(withFetch()), provideAnimations()] })`
- [ ] T010 Configure `src/styles.scss` with Angular Material Indigo/Pink prebuilt theme (`@use`), `html,body { height: 100%; margin: 0; font-family: Roboto, sans-serif; }`, `.films-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; padding: 16px; }`, `.active { border-bottom: 2px solid white; }`
- [ ] T011 Write JEST unit test for `AppComponent` in `src/app/app.component.spec.ts`: verify shell renders mat-toolbar, two navigation links ("Personagens", "Filmes"), and router-outlet — ensure test FAILS before T008 is implemented

**Checkpoint**: Foundation ready — all user story implementation can now begin.

---

## Phase 3: User Story 1 — Browse Star Wars Characters (Priority: P1) 🎯 MVP

**Goal**: User sees a paginated list of 10 Star Wars characters per page with name, birth year, gender, height, and mass. Loading indicator during fetch; Portuguese error message with retry on failure.

**Independent Test**: Open `/characters` directly; verify 10 characters render with all 5 fields; click next page and verify different characters appear.

### Tests for User Story 1 ⚠️ Write FIRST — verify they FAIL before implementation

- [ ] T012 [P] [US1] Write JEST unit test for `Character`/`CharacterDisplayItem` interfaces and `toCharacterDisplayItem()` pure function in `src/app/models/character.model.spec.ts`: assert correct field mapping and immutability — ensure test FAILS before T017
- [ ] T013 [P] [US1] Write JEST unit test for `SwapiService.getCharacters(page)` in `src/app/core/services/swapi.service.spec.ts`: mock `HttpClient`, assert correct URL `${apiUrl}/people/?page=1`, assert page 3 calls `?page=3`, assert `catchError` emits `Error('Failed to load characters')` on HTTP 500 — ensure tests FAIL before T018
- [ ] T014 [P] [US1] Write JEST unit test for `CharactersComponent` in `src/app/features/characters/characters.component.spec.ts`: assert loading spinner shown while `isLoading$` is true; assert list renders 10 items with name/birth_year/gender/height/mass; assert `onPageChange` triggers new fetch; assert error message "Não foi possível carregar os personagens. Tente novamente." shown on HTTP error — ensure tests FAIL before T019–T021
- [ ] T015 [P] [US1] Write Playwright E2E test for Characters journey in `e2e/tests/characters.e2e.spec.ts`: navigate to `/characters`, assert 10 list items visible, assert paginator visible, click next page and assert different items load, assert loading indicator appears briefly on page change — ensure tests FAIL before T017–T021

### Implementation for User Story 1

- [ ] T016 [P] [US1] Create `src/app/models/character.model.ts` exporting `Character` interface (name, birth_year, gender, height, mass, homeworld, films, url), `CharacterDisplayItem` interface (name, birth_year, gender, height, mass), and pure function `toCharacterDisplayItem(c: Character): CharacterDisplayItem`
- [ ] T017 [US1] Implement `SwapiService.getCharacters(page: number = 1): Observable<SwapiPage<Character>>` in `src/app/core/services/swapi.service.ts`: inject `HttpClient`, `GET ${apiUrl}/people/?page=${page}`, apply `catchError` re-throwing `Error('Failed to load characters')` (depends on T005, T006, T016)
- [ ] T018 [US1] Create `src/app/features/characters/characters.component.ts` as standalone `OnPush` component: `currentPage = signal(1)`, `pageData$ = toObservable(currentPage).pipe(switchMap(page => swapiService.getCharacters(page)), shareReplay(1))`, `isLoading$ = pageData$.pipe(map(() => false), startWith(true))`, `error$` via `catchError`, `onPageChange(event: PageEvent)` updating signal (depends on T017, T016)
- [ ] T019 [US1] Create `src/app/features/characters/characters.component.html`: fixed-`min-height: 600px` container, spinner block `*ngIf="isLoading$ | async"`, `<mat-list>` with `*ngFor` over `(pageData$ | async)?.results` rendering `mat-list-item` per character (name, birth_year, gender, height, mass), `<mat-paginator [length]="(pageData$ | async)?.count" [pageSize]="10" [hidePageSize]="true" (page)="onPageChange($event)">`, error block with retry button (depends on T018)
- [ ] T020 [US1] Create `src/app/features/characters/characters.component.scss`: `.characters-container { min-height: 600px; }`, `.loading-container { display: flex; justify-content: center; align-items: center; min-height: 600px; }`, `.error-message { color: var(--mat-warn); padding: 16px; }` (depends on T018)

**Checkpoint**: Navigate to `/characters` — 10 characters display, pagination works, error state visible in offline mode.

---

## Phase 4: User Story 2 — Browse Star Wars Films (Priority: P2)

**Goal**: User sees all ~6 Star Wars films as individual cards with episode number, title, director, and release date. No pagination. Films cached — revisit shows data instantly without network request.

**Independent Test**: Navigate to `/films`; verify all films display as cards with episode number, title, director, and release date; navigate away and back; verify no new network request occurs.

### Tests for User Story 2 ⚠️ Write FIRST — verify they FAIL before implementation

- [ ] T021 [P] [US2] Write JEST unit test for `Film`/`FilmDisplayItem` interfaces and `toFilmDisplayItem()` pure function in `src/app/models/film.model.spec.ts`: assert correct field mapping — ensure test FAILS before T026
- [ ] T022 [P] [US2] Add `SwapiService.getFilms()` tests to `src/app/core/services/swapi.service.spec.ts`: assert `GET ${apiUrl}/films/`, assert same observable reference returned on second call (`expect(service.getFilms()).toBe(service.getFilms())`), assert `catchError` emits `Error('Failed to load films')` on HTTP 500 — ensure tests FAIL before T027
- [ ] T023 [P] [US2] Write JEST unit test for `FilmsComponent` in `src/app/features/films/films.component.spec.ts`: assert loading spinner shown while `isLoading$` is true; assert grid renders film cards with episode_id, title, director, release_date; assert error message "Não foi possível carregar os filmes. Tente novamente." shown on HTTP error — ensure tests FAIL before T028–T030
- [ ] T024 [P] [US2] Write Playwright E2E test for Films journey in `e2e/tests/films.e2e.spec.ts`: navigate to `/films`, assert mat-card elements visible, assert each card shows episode number and title, navigate to `/characters` then back to `/films`, assert no additional network request to SWAPI films endpoint — ensure tests FAIL before T026–T030

### Implementation for User Story 2

- [ ] T025 [P] [US2] Create `src/app/models/film.model.ts` exporting `Film` interface (episode_id, title, director, producer, release_date, opening_crawl, characters, url), `FilmDisplayItem` interface (episode_id, title, director, release_date), and pure function `toFilmDisplayItem(f: Film): FilmDisplayItem`
- [ ] T026 [US2] Implement `SwapiService.getFilms(): Observable<SwapiPage<Film>>` in `src/app/core/services/swapi.service.ts`: add private `filmsCache$` field, lazily initialise with `this.http.get<SwapiPage<Film>>(${apiUrl}/films/).pipe(shareReplay(1), catchError(re-throwing Error('Failed to load films')))`, return `filmsCache$` on every call (depends on T005, T006, T025)
- [ ] T027 [US2] Create `src/app/features/films/films.component.ts` as standalone `OnPush` component: `films$ = swapiService.getFilms().pipe(map(page => page.results.map(toFilmDisplayItem)), shareReplay(1))`, `isLoading$ = films$.pipe(map(() => false), startWith(true))`, `error$` via `catchError` (depends on T025, T026)
- [ ] T028 [US2] Create `src/app/features/films/films.component.html`: fixed-`min-height: 400px` container, spinner block `*ngIf="isLoading$ | async"`, `<div class="films-grid">` with `*ngFor` over `films$ | async`, each iteration renders `<mat-card>` with `<mat-card-header>` (episode_id + title) and `<mat-card-content>` (director + release_date), error block with retry button in Portuguese (depends on T027)
- [ ] T029 [US2] Create `src/app/features/films/films.component.scss`: `.films-container { min-height: 400px; }`, `.loading-container { display: flex; justify-content: center; align-items: center; min-height: 400px; }`, `.error-message { color: var(--mat-warn); padding: 16px; }` (depends on T027)

**Checkpoint**: Navigate to `/films` — all films display as cards; navigate away and back; no second SWAPI request in DevTools Network.

---

## Phase 5: User Story 3 — Navigate Between Screens (Priority: P3)

**Goal**: Persistent top navigation bar allows switching between Characters and Films screens. Active screen is visually highlighted.

**Independent Test**: From Characters screen click "Filmes" — Films screen appears without full reload. From Films screen click "Personagens" — Characters screen appears. Active link has visible underline.

*Note: The AppComponent shell (T008) already includes the nav links and `routerLinkActive`. This phase focuses on E2E validation and verifying active-link styling.*

### Tests for User Story 3 ⚠️ Write FIRST — verify they FAIL before implementation

- [ ] T030 [P] [US3] Write Playwright E2E test for Navigation journey in `e2e/tests/navigation.e2e.spec.ts`: from `/characters` click "Filmes" and assert URL is `/films` and films content visible; click "Personagens" and assert URL is `/characters`; assert active nav link has `active` CSS class — ensure tests FAIL before T031

### Implementation for User Story 3

- [ ] T031 [US3] Verify and complete `src/app/app.component.ts` and `src/app/app.component.html`: ensure `routerLinkActive="active"` is applied to both nav links, `.active` style adds `border-bottom: 2px solid white` (defined in `styles.scss`), both links have `aria-label` attributes for accessibility (depends on T008, T010)

**Checkpoint**: All three user stories independently functional; navigation between screens confirmed working with active indicator.

---

## Phase N: Polish & Cross-Cutting Concerns

**Purpose**: Quality gates, performance verification, and documentation before PR.

- [ ] T032 [P] Run `npx jest --coverage` and verify 100% coverage across all statements, branches, functions, and lines; fix any coverage gaps identified
- [ ] T033 [P] Run full Playwright suite `npx playwright test` and verify all E2E tests pass; fix any flaky or failing scenarios
- [ ] T034 Run `ng build` and verify zero errors and zero initial-bundle budget violations; initial chunk MUST be ≤ 200 kB gzipped
- [ ] T035 Run `ng serve` and manually verify: Characters screen loads with 10 items + paginator; Films screen loads with ~6 cards; navigation works; loading indicators visible; error state works in offline mode (DevTools → Network → Offline)
- [ ] T036 [P] Run Lighthouse Mobile audit on `http://localhost:4200` and verify LCP ≤ 2.5 s, CLS ≤ 0.1, INP ≤ 200 ms; document results
- [ ] T037 Create/update `README.md` at project root with: project overview, prerequisites (Node 18+, Angular CLI 17), commands (`ng serve`, `npx jest --coverage`, `npx playwright test`, `ng build`), environment variables (`apiUrl` in `environment.ts`), and Core Web Vitals targets

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 — can start independently
- **US2 (Phase 4)**: Depends on Phase 2 — can start independently of US1
- **US3 (Phase 5)**: Depends on Phase 2 (AppComponent shell); practically dependent on US1+US2 existing for E2E validation
- **Polish (Phase N)**: Depends on all user story phases being complete

### User Story Dependencies

- **US1 (P1)**: No dependency on US2 or US3
- **US2 (P2)**: No dependency on US1 or US3
- **US3 (P3)**: AppComponent foundational — nav bar already built in Phase 2; E2E validation requires US1+US2 screens to exist

### Within Each User Story

1. Tests MUST be written and verified to FAIL before implementation tasks
2. Model interfaces before service
3. Service before component TypeScript
4. Component TypeScript before HTML template
5. HTML template before SCSS

### Parallel Opportunities

- T003 and T004 can run in parallel (different configs)
- T012, T013, T014, T015 can run in parallel (different files, all tests)
- T016 can run in parallel with test writing (pure model — no dependencies)
- T021, T022, T023, T024 can run in parallel (different test files)
- T025 can run in parallel with test writing
- T032 and T033 can run in parallel (different test runners)
- T034 and T036 can run in parallel (different tools)

---

## Parallel Example: User Story 1 Tests

```bash
# Launch all US1 test files together (all must fail before implementation):
Task T012: Write src/app/models/character.model.spec.ts
Task T013: Write src/app/core/services/swapi.service.spec.ts
Task T014: Write src/app/features/characters/characters.component.spec.ts
Task T015: Write e2e/tests/characters.e2e.spec.ts
# Once all FAIL → proceed to T016, then T017, T018, T019, T020 in order
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

1. Setup + Foundational → app shell running at `http://localhost:4200`
2. Add US1 → Characters screen working → validate independently
3. Add US2 → Films screen working → validate independently
4. Add US3 validation → Navigation fully verified
5. Polish → 100% coverage, all E2E green, `ng build` passes, README complete → open PR

---

## Notes

- [P] tasks = different files, no shared dependencies — safe to run in parallel
- [Story] label maps task to user story for traceability
- **Commit after EACH task** (Principle II) — format: `feat(scope): description (TXX)`
- Tests MUST fail before implementation — Red-Green-Refactor is mandatory (Principle IV)
- **Unit tests**: JEST only — no Karma/Jasmine invocations
- **E2E tests**: Playwright only — no Cypress
- **Build gate**: `ng build` MUST pass before PR (Principle III)
- **README**: T037 must be complete before PR (Principle V)
- Coverage threshold: 100% statements, branches, functions, lines — enforced in `jest.config.ts`
