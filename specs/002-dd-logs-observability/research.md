# Research: Application Observability — DD_LOGS Layer

**Phase 0 output for**: `specs/002-dd-logs-observability/plan.md`
**Date**: 2026-05-31

All technical decisions are derived from the SPDD analysis (`spdd/analysis/`) and REASONS Canvas (`spdd/prompt/`). No new npm packages are required.

---

## Decision 1: `ObservabilityService` as Central Facade

**Decision**: A single `@Injectable({ providedIn: 'root' })` service wraps all `window.DD_LOGS` access. No other file references `window.DD_LOGS` directly.

**Rationale**: Centralisation enforces schema consistency, makes the guard (`if (!window.DD_LOGS) return`) a single implementation, and enables unit testing by mocking one injection point rather than patching a global in every file. The `providedIn: 'root'` scope ensures the same instance is shared by interceptors, error handlers, and components — critical for the "set global context once" requirement.

**Alternatives considered**:
- Direct `window.DD_LOGS` calls in each component/interceptor → rejected: no schema enforcement, untestable, `app_version`/`deploy_type` would need repeating everywhere.

---

## Decision 2: `watchView()` Helper on `ObservabilityService`

**Decision**: `watchView<T>(viewName: string, ready$: Observable<T | null>): void` is a method on `ObservabilityService` that encapsulates `performance.now()`, `filter(non-null)`, `take(1)`, threshold logic, and `log()` call. Components call it once in `ngOnInit`.

**Rationale**: Both existing screens (`CharactersComponent`, `FilmsComponent`) depend on async data — the "screen is ready" moment is the first non-null emission of `pageView$` / `films$`, not `ngAfterViewInit` (which fires on the spinner/skeleton). The helper avoids per-component boilerplate: each component adds one field (`viewStart`) and one `ngOnInit` call. `take(1)` auto-completes the subscription so no manual unsubscription is needed. The `filter(non-null)` correctly skips the `startWith(null)` emission in `pageView$`.

**Key insight**: `viewStart = performance.now()` is stored as a class field initialiser (at construction time), capturing the full time from component creation including any pre-first-CD cycle work. This is more accurate than measuring from `ngOnInit`.

**Alternatives considered**:
- `ngAfterViewInit` for latency → rejected: measures skeleton paint, not data visibility; systematically underreports user-perceived latency.
- Directive or decorator approach → rejected: overkill for a two-screen application; adds Angular-specific coupling.

---

## Decision 3: Circular Dependency Prevention for `GlobalErrorHandler`

**Decision**: `GlobalErrorHandler` injects `Injector` (the Angular DI injector itself) in its constructor. Inside `handleError`, it calls `this.injector.get(ObservabilityService)` lazily, wrapped in a try-catch.

**Rationale**: Angular's `ErrorHandler` is resolved during the DI container bootstrap phase, before most application services are registered. Constructor-injecting `ObservabilityService` directly would cause a circular or timing dependency. `Injector` has no circular risk — it is always available. The try-catch ensures that if the service is somehow unavailable (very early errors), `console.error` has already run and the handler degrades gracefully without crashing.

**Re-entrant protection**: If `ObservabilityService.log()` itself throws, `GlobalErrorHandler.handleError` would be called again, causing infinite recursion. The service's `window.DD_LOGS` guard and try-catch in `handleError` break this loop.

**Alternatives considered**:
- `inject(ObservabilityService)` inside `handleError` body → rejected in Angular 17: `inject()` is only valid in injection context (constructor/factory), not in method bodies.
- Constructor injection of `ObservabilityService` → rejected: causes DI ordering issues and potential circular dependency error at bootstrap.

---

## Decision 4: `withInterceptorsFromDi()` for Class-Based Interceptor

**Decision**: Change `provideHttpClient(withFetch())` to `provideHttpClient(withFetch(), withInterceptorsFromDi())` in `app.config.ts`. Register `DdLogsInterceptor` via `{ provide: HTTP_INTERCEPTORS, useClass: DdLogsInterceptor, multi: true }`.

**Rationale**: In Angular 17 standalone apps, class-based interceptors registered with `HTTP_INTERCEPTORS` are silently ignored unless `withInterceptorsFromDi()` is explicitly added to `provideHttpClient`. The `withFetch()` and `withInterceptorsFromDi()` flags are compatible and can coexist. Order: `withFetch()` first (backend choice), `withInterceptorsFromDi()` second (DI chain opt-in).

**Alternatives considered**:
- Functional interceptors with `withInterceptors([fn])` → viable but would require changing the registration pattern and the error object handling. Class-based is consistent with the existing OOP service patterns in the codebase.

---

## Decision 5: `unhandledrejection` Listener in `main.ts`

**Decision**: Add the listener inside the `.then()` callback of `bootstrapApplication(AppComponent, appConfig)`, using `appRef.injector.get(ObservabilityService)`.

**Rationale**: The DI container is fully initialised only after `bootstrapApplication` resolves. Registering the listener before `.then()` would mean `ObservabilityService` might not be ready. `ApplicationRef.injector` is the top-level injector for the application — it can resolve any `providedIn: 'root'` service.

---

## Decision 6: Build-time `define` for `app_version` / `deploy_type`

**Decision**: Angular 17's esbuild-based builder supports a `define` object in `angular.json` under `architect.build.options.define`. Default values `"unknown"` / `"local"` prevent runtime `undefined` during local development. CI overrides with `--define '__APP_VERSION__="$GIT_SHA"'`.

**Rationale**: `fileReplacements` (the alternative) would require a separate `environment.prod.ts` file and can only swap entire files. The `define` approach is more granular and CI-friendly — each CI pipeline step sets only the variables it knows. No `@angular-builders/custom-webpack` needed for Angular 17 esbuild builder.

---

## Decision 7: Test Infrastructure — `dd-logs.mock.ts`

**Decision**: Shared mock helper in `src/app/core/testing/dd-logs.mock.ts`, exported as `createDdLogsMock()` and `setupDdLogsMock()`. Excluded from coverage via `jest.config.ts` `collectCoverageFrom` exclusion.

**Rationale**: Three spec files all need to set up `window.DD_LOGS` before each test and tear it down after. A shared helper prevents copy-paste and ensures consistent mock shape across all tests. `performance.now` is mocked via `jest.spyOn(performance, 'now')` in latency tests — relying on real wall time creates flaky tests.

---

## NEEDS CLARIFICATION — All Resolved

| Item | Resolution |
|------|------------|
| `view_name` string values | Route path segment: `'characters'`, `'films'` — aligns with Datadog facet filtering |
| Latency threshold value | 5000 ms (from spec Assumptions section) |
| LatencyTracker helper form | Method on `ObservabilityService` — least coupling, easiest to test |
| `unhandledrejection` DI mechanism | `appRef.injector.get(ObservabilityService)` inside `.then()` callback |
| `withFetch()` + interceptor compatibility | Confirmed: both flags coexist in `provideHttpClient(withFetch(), withInterceptorsFromDi())` |
