---

description: "Task list for DD_LOGS Observability Layer — Angular 17 structured logging for Datadog canary monitoring"
---

# Tasks: Application Observability — DD_LOGS Logging Layer

**Input**: Design documents from `specs/002-dd-logs-observability/`

**Prerequisites**: plan.md ✅ | spec.md ✅ | research.md ✅ | data-model.md ✅ | contracts/ ✅

**Tests**: INCLUDED — JEST (unit, 100% coverage). Tests written FIRST per constitution Principle IV (tests must fail before implementation). MCP Playwright E2E not required for this cross-cutting infrastructure feature (no new user-visible UI).

**Organization**: Tasks grouped by user story. US4 (version tagging) is foundational — all other stories depend on `ObservabilityService` existing first.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: User story this task belongs to ([US1], [US2], [US3], [US4])
- Commit after EVERY task (Principle II — format: `feat(observability): description (TXX)`)

---

## Phase 1: Setup (Infrastructure Primitives)

**Purpose**: Shared type definitions and test infrastructure used by ALL subsequent tasks. Must complete before any user story work.

- [ ] T001 [P] Create `src/app/core/types/dd-logs.types.ts` with: `EventType` union (`'latency' | 'request_error' | 'js_error' | 'render_complete'`), `Severity` union (`'info' | 'warning' | 'error'`), `LogPayload` interface (8 fields, all optional except `event_type`/`severity`), `DdLogsInstance` interface (`setGlobalContextProperty`, `logger.log`), `declare global { interface Window { DD_LOGS?: DdLogsInstance } }`
- [ ] T002 [P] Create `src/app/core/testing/dd-logs.mock.ts` with `createDdLogsMock()` returning `{ setGlobalContextProperty: jest.fn(), logger: { log: jest.fn() } }` and `setupDdLogsMock()` that assigns mock to `window.DD_LOGS` in `beforeEach` and deletes it in `afterEach`
- [ ] T003 [P] Update `jest.config.ts` `collectCoverageFrom` to add `'!src/app/core/testing/**'` exclusion so `dd-logs.mock.ts` does not count toward production coverage
- [ ] T004 [P] Update `angular.json` under `projects.starwars-explorer.architect.build.options` to add `"define": { "__APP_VERSION__": "\"unknown\"", "__DEPLOY_TYPE__": "\"local\"" }` for build-time string replacement
- [ ] T005 [P] Update `src/environments/environment.ts` to add `appVersion: '__APP_VERSION__'` and `deployType: '__DEPLOY_TYPE__'` with TODO comments explaining CI pipeline variable injection (`APP_VERSION` and `DEPLOY_TYPE` env vars)

**Checkpoint**: Type infrastructure ready. All subsequent tasks can import from `dd-logs.types.ts` and use `setupDdLogsMock()` in tests.

---

## Phase 2: Foundational — US4 Screen Events Tagged With App Version (Priority: P1)

**Goal**: `ObservabilityService` is implemented and sets `app_version`/`deploy_type` as global DD_LOGS context exactly once. Every event logged through the service automatically carries these tags.

**Dependency**: Blocks ALL other user stories — US1, US2, US3 cannot be implemented without `ObservabilityService` existing.

**Independent Test**: In a unit test, instantiate `ObservabilityService` with a mock `window.DD_LOGS`; verify `setGlobalContextProperty` is called for both `app_version` and `deploy_type`; verify every call to `log()` reaches `window.DD_LOGS.logger.log`.

### Tests for US4 ⚠️ Write FIRST — verify they FAIL before T007

- [ ] T006 [US4] Write JEST unit test for `ObservabilityService` in `src/app/core/services/observability.service.spec.ts`:
  - Import `setupDdLogsMock` from `../testing/dd-logs.mock`
  - Test constructor: assert `setGlobalContextProperty('app_version', ...)` and `setGlobalContextProperty('deploy_type', ...)` called once when `window.DD_LOGS` exists; assert NOT called when `window.DD_LOGS` is undefined
  - Test `log()`: assert `window.DD_LOGS.logger.log` called with `(payload.event_type, {...payload}, ddLevel)`; assert severity `'error'` → level `'error'`, `'warning'` → `'warn'`, `'info'` → `'info'`; assert early return (no call) when `window.DD_LOGS` undefined
  - Test `watchView()`: use `Subject<string | null>` mock; mock `performance.now` returning `0` then `3000`; assert `render_complete`/`info`/`threshold_exceeded: false` on duration ≤ 5000; use `Subject` returning `0` then `6000`; assert `latency`/`warning`/`threshold_exceeded: true` on duration > 5000; assert null emission from `startWith(null)` does NOT trigger log; assert `log` called exactly once even if source emits multiple non-null values

### Implementation for US4

- [ ] T007 [US4] Create `ObservabilityService` in `src/app/core/services/observability.service.ts` (depends T001, T005, T006):
  - `@Injectable({ providedIn: 'root' })`
  - Private constant `LATENCY_THRESHOLD_MS = 5000`
  - Constructor: guard `if (!window.DD_LOGS) return`; call `window.DD_LOGS.setGlobalContextProperty('app_version', environment.appVersion)` and `setGlobalContextProperty('deploy_type', environment.deployType)`
  - `log(payload: LogPayload): void`: guard `if (!window.DD_LOGS) return`; map severity → DD level; call `window.DD_LOGS.logger.log(payload.event_type, { ...payload }, level)`
  - `watchView<T>(viewName: string, ready$: Observable<T | null>): void`: record `const start = performance.now()`; subscribe to `ready$.pipe(filter((v): v is T => v !== null), take(1))`; on next: `duration_ms = Math.round(performance.now() - start)`, `exceeded = duration_ms > LATENCY_THRESHOLD_MS`; call `this.log({ event_type: exceeded ? 'latency' : 'render_complete', severity: exceeded ? 'warning' : 'info', view_name: viewName, duration_ms, threshold_exceeded: exceeded })`

**Checkpoint**: `ObservabilityService` fully tested and working. US1, US2, US3 can now begin.

---

## Phase 3: User Story 1 — Screen Latency Automatically Captured (Priority: P1)

**Goal**: Every time a user's Characters or Films screen finishes loading data, a timing event (`render_complete` or `latency`) is logged automatically to DD_LOGS with screen name, duration, and threshold flag.

**Independent Test**: Mock `ObservabilityService` in `CharactersComponent` test; verify `watchView('characters', pageView$)` is called in `ngOnInit`. Verify `watchView('films', films$)` in `FilmsComponent`. Manually verify in browser with console DD_LOGS mock.

### Tests for US1 ⚠️ Write FIRST — verify they FAIL before T009/T011

- [ ] T008 [P] [US1] Add JEST unit test to `src/app/features/characters/characters.component.spec.ts`: mock `ObservabilityService` (provide `{ provide: ObservabilityService, useValue: { watchView: jest.fn() } }`); assert `watchView` was called with `'characters'` and the component's `pageView$` observable in `ngOnInit`; assert `OnInit` interface is implemented — ensure test FAILS before T009
- [ ] T010 [P] [US1] Add JEST unit test to `src/app/features/films/films.component.spec.ts`: mock `ObservabilityService`; assert `watchView` was called with `'films'` and the component's `films$` observable in `ngOnInit` — ensure test FAILS before T011

### Implementation for US1

- [ ] T009 [US1] Update `src/app/features/characters/characters.component.ts` (depends T007, T008): add `private obs = inject(ObservabilityService)` field; add `private readonly viewStart = performance.now()` field; implement `ngOnInit(): void { this.obs.watchView('characters', this.pageView$); }`; add `OnInit` to `implements` clause; add `ObservabilityService` import — NO changes to template, `pageView$` chain, or any other logic
- [ ] T011 [US1] Update `src/app/features/films/films.component.ts` (depends T007, T010): same pattern — inject `ObservabilityService`, add `viewStart`, implement `ngOnInit` calling `this.obs.watchView('films', this.films$)`; add `OnInit` to `implements` clause — NO changes to template or `films$` chain

**Checkpoint**: Navigate to `/characters` and `/films` with console mock — timing events appear in the browser console.

---

## Phase 4: User Story 2 — HTTP Failures Automatically Captured (Priority: P2)

**Goal**: Every failed HTTP request to swapi.info generates a `request_error` event in DD_LOGS with the URL and HTTP status code. The existing SwapiService error handling and Portuguese error UI are unaffected.

**Independent Test**: Use `HttpClientTestingModule` to trigger an HTTP 500 response; verify `ObservabilityService.log` was called with `event_type: 'request_error'`, `http_status: 500`, and the request URL.

### Tests for US2 ⚠️ Write FIRST — verify they FAIL before T013/T014

- [ ] T012 [US2] Write JEST unit test for `DdLogsInterceptor` in `src/app/core/interceptors/dd-logs.interceptor.spec.ts` (depends T001): mock `ObservabilityService`; use `HttpClientTestingModule` + `HTTP_INTERCEPTORS` provider; assert `obs.log` NOT called on successful (200) request; assert `obs.log` called with `event_type: 'request_error'`, `severity: 'error'`, `http_status: 500`, `endpoint: <url>`, `error_message: <message>` on 500 error; assert `obs.log` called with `http_status: 0` on network error (flush with `{ status: 0 }`); assert error is re-thrown (subscriber receives the error) — ensure tests FAIL before T013

### Implementation for US2

- [ ] T013 [US2] Create `DdLogsInterceptor` in `src/app/core/interceptors/dd-logs.interceptor.ts` (depends T001, T007, T012): implement `HttpInterceptor`; inject `ObservabilityService` via constructor; `intercept(req, next)` returns `next.handle(req).pipe(catchError((error: HttpErrorResponse) => { this.obs.log({ event_type: 'request_error', severity: 'error', http_status: error.status ?? 0, endpoint: req.url, error_message: error.message }); return throwError(() => error); }))`
- [ ] T014 [US2] Update `src/app/app.config.ts` to register interceptor (depends T013): change `provideHttpClient(withFetch())` → `provideHttpClient(withFetch(), withInterceptorsFromDi())`; add `{ provide: HTTP_INTERCEPTORS, useClass: DdLogsInterceptor, multi: true }` to providers; add imports: `withInterceptorsFromDi`, `HTTP_INTERCEPTORS` from `@angular/common/http`; `DdLogsInterceptor` from `./core/interceptors/dd-logs.interceptor`

**Checkpoint**: Enable DevTools Network → Offline → navigate to `/characters`; verify `request_error` event with `http_status: 0` in console mock.

---

## Phase 5: User Story 3 — Unhandled JavaScript Errors Automatically Captured (Priority: P3)

**Goal**: Any unhandled runtime error inside Angular's zone, and any unresolved promise rejection outside Angular's zone, generates a `js_error` event in DD_LOGS. `console.error` continues to fire — monitoring is additive.

**Independent Test**: Call `handler.handleError(new Error('test'))` directly; verify `console.error` was called AND `obs.log` was called with `event_type: 'js_error'`, `error_message: 'test'`. Dispatch a `unhandledrejection` event in jsdom and verify the listener fires.

### Tests for US3 ⚠️ Write FIRST — verify they FAIL before T016/T017

- [ ] T015 [US3] Write JEST unit test for `GlobalErrorHandler` in `src/app/core/handlers/global-error.handler.spec.ts` (depends T001): create mock `ObservabilityService`; create mock `Injector` returning the mock service via `get(ObservabilityService)`; spy on `console.error`; assert `console.error(error)` called for every error; assert `obs.log({ event_type: 'js_error', severity: 'error', error_message: 'test' })` called for `Error` objects; assert `obs.log` called with `String(value)` for non-Error thrown values (e.g., a plain string); assert no exception thrown when `Injector.get` throws (service unavailable) — ensure tests FAIL before T016

### Implementation for US3

- [ ] T016 [US3] Create `GlobalErrorHandler` in `src/app/core/handlers/global-error.handler.ts` (depends T001, T007, T015): implement `ErrorHandler`; inject `Injector` (NOT `ObservabilityService`) via constructor; `handleError(error: unknown): void { console.error(error); try { const obs = this.injector.get(ObservabilityService); obs.log({ event_type: 'js_error', severity: 'error', error_message: error instanceof Error ? error.message : String(error) }); } catch {} }`
- [ ] T017 [US3] Update `src/main.ts` to add `unhandledrejection` listener (depends T007, T016): change to `.then(appRef => { const obs = appRef.injector.get(ObservabilityService); window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => { obs.log({ event_type: 'js_error', severity: 'error', error_message: event.reason instanceof Error ? event.reason.message : String(event.reason ?? 'Unhandled rejection') }); }); }).catch((err: unknown) => console.error(err))`; import `ObservabilityService` from `./app/core/services/observability.service`
- [ ] T018 [US3] Update `src/app/app.config.ts` to register `GlobalErrorHandler` (depends T016): add `{ provide: ErrorHandler, useClass: GlobalErrorHandler }` to providers; add imports: `ErrorHandler` from `@angular/core`; `GlobalErrorHandler` from `./core/handlers/global-error.handler`

**Checkpoint**: All three user stories functional. Chrome DevTools → Console shows JS errors routed to DD_LOGS mock. `unhandledrejection` fires for unresolved promises.

---

## Phase N: Polish & Cross-Cutting Concerns

**Purpose**: Quality gates, build verification, and documentation before PR.

- [ ] T019 [P] Run `npx jest --coverage` and verify 100% coverage across all 3 new production files (`observability.service.ts`, `dd-logs.interceptor.ts`, `global-error.handler.ts`) plus all 34 existing tests still pass; fix any coverage gaps
- [ ] T020 Run `ng build` and verify zero errors and zero budget violations
- [ ] T021 Run `ng serve`, inject console DD_LOGS mock, navigate to `/characters` and `/films`, verify `render_complete` events appear; go offline via DevTools, reload, verify `request_error` events appear
- [ ] T022 Update `README.md` with an "Observability" section documenting: what events are captured; how to use the console mock locally; CI variable names (`APP_VERSION`, `DEPLOY_TYPE`) and the `ng build --define` command

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately. All 5 tasks [P].
- **Foundational (Phase 2 / US4)**: Depends on Phase 1 (T001 types, T002 mock, T003 config, T004 angular.json, T005 environment). BLOCKS US1, US2, US3.
- **US1 (Phase 3)**: Depends on Phase 2 (T007 `ObservabilityService`). T008 and T010 can start as soon as T001 exists (just write the tests); T009 and T011 require T007.
- **US2 (Phase 4)**: Depends on Phase 2 (T007). Fully independent of US1.
- **US3 (Phase 5)**: Depends on Phase 2 (T007). Fully independent of US1 and US2. T018 depends on T016; T017 depends on T007.
- **Polish (Phase N)**: Depends on all user story phases.

### User Story Dependencies

- **US4 (Foundational)**: No dependencies — first to implement. Blocks everything.
- **US1 (P1)**: Depends on US4. Independent of US2 and US3.
- **US2 (P2)**: Depends on US4. Independent of US1 and US3.
- **US3 (P3)**: Depends on US4. Independent of US1 and US2.

### Within Each User Story

1. Tests MUST be written and verified to FAIL before implementation (Red-Green-Refactor, Principle IV)
2. Types/interfaces (`dd-logs.types.ts`) before service implementation
3. Service before component/interceptor/handler that depends on it
4. Interceptor/handler before `app.config.ts` provider registration

### Parallel Opportunities

- T001, T002, T003, T004, T005 all run in parallel (Phase 1 — different files)
- T008 and T010 can run in parallel (different test files, US1 tests)
- T009 and T011 can run in parallel (different component files, after T007)
- T019 and T020 can run in parallel (different tools)

---

## Parallel Example: Phase 1 Setup

```bash
# All 5 setup tasks run simultaneously (different files):
Task T001: src/app/core/types/dd-logs.types.ts
Task T002: src/app/core/testing/dd-logs.mock.ts
Task T003: jest.config.ts (coverage exclusion)
Task T004: angular.json (define block)
Task T005: src/environments/environment.ts
# Once all done → T006 (test) → T007 (implement) ObservabilityService
```

---

## Implementation Strategy

### MVP First (US4 + US1 Only)

1. Complete Phase 1: Setup (T001–T005)
2. Complete Phase 2: US4 Foundational (T006–T007) — CRITICAL
3. Write US1 tests (T008, T010) → verify they FAIL
4. Implement US1 (T009, T011)
5. **STOP and VALIDATE**: `ng serve` + console mock → latency events appear for both screens

### Full Feature Delivery

1. Setup + US4 → `ObservabilityService` ready
2. Add US1 → screen latency events working → validate independently
3. Add US2 → HTTP error events working → validate with offline mode
4. Add US3 → JS error events working → validate with manual error throw
5. Polish → 100% coverage, `ng build` clean, README updated → open PR

---

## Notes

- [P] tasks = different files, no shared dependencies — safe to run in parallel
- **Commit after EACH task** (Principle II) — format: `feat(observability): description (TXX)`
- Tests MUST fail before implementation (Red-Green-Refactor, Principle IV)
- **JEST only** — no Karma; `setupDdLogsMock()` required in all observability spec files
- **Guard-first** in `ObservabilityService` — every method checking `window.DD_LOGS` existence first
- **`Injector` not `ObservabilityService`** in `GlobalErrorHandler` constructor — circular dep prevention
- **Build gate**: `ng build` MUST pass before PR (Principle III)
- **README**: T022 must be complete before PR (Principle V)
- `window.DD_LOGS` undefined branch MUST be tested in every spec (ad blocker / test environment)
- `performance.now` MUST be mocked in latency tests — wall-clock time = flaky tests
- Existing 34 tests (from `001-starwars-spa`) MUST continue passing after T009, T011 — mock `ObservabilityService` if needed
