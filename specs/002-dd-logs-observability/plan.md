# Implementation Plan: Application Observability — DD_LOGS Logging Layer

**Branch**: `002-dd-logs-observability` | **Date**: 2026-05-31 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/002-dd-logs-observability/spec.md`

## Summary

Add a structured observability layer to the existing Angular 17 standalone SPA by introducing `ObservabilityService` (central DD_LOGS facade), `DdLogsInterceptor` (HTTP error capture), and `GlobalErrorHandler` (JS error + unhandled rejection capture). Screen latency is measured via a `watchView()` helper that taps the first non-null emission of each screen's data observable. `window.DD_LOGS` is already initialised externally — this layer calls only `setGlobalContextProperty` and `logger.log`. `app_version` / `deploy_type` are injected at build time via `angular.json` `define` block and set as global DD_LOGS context once. All new code is covered at 100% with JEST; existing 34 tests remain unaffected.

## Technical Context

**Language/Version**: TypeScript ~5.2 (Angular 17 bundled), Node.js ≥ 18.13

**Primary Dependencies**: Angular 17 (already installed), RxJS 7.x (already installed). No new npm packages required — `ErrorHandler`, `HttpInterceptor`, `Injector`, `filter`, `take` are all part of the existing dependency tree.

**Storage**: No persistence. All events are fire-and-forget to `window.DD_LOGS`.

**Testing**: JEST + `jest-preset-angular@14` (already configured). `src/app/core/testing/**` excluded from coverage collection.

**Target Platform**: Browser only (same as existing SPA). No SSR.

**Project Type**: Cross-cutting infrastructure layer added to existing Angular 17 standalone SPA.

**Performance Goals**: Observability adds zero perceptible latency — `log()` is synchronous; `watchView()` auto-completes after `take(1)`.

**Constraints**:
- `window.DD_LOGS.init()` MUST NEVER be called — service is already initialised externally
- `GlobalErrorHandler` injects `Injector` (not `ObservabilityService`) to prevent circular DI dependency
- `withInterceptorsFromDi()` MUST be added to `provideHttpClient` for class-based interceptors in standalone Angular
- Latency fires at first non-null emission of `pageView$` / `films$` (async data ready) — NOT at `ngAfterViewInit`
- 100% unit test coverage per constitution Principle IV

**Scale/Scope**: 8 new files + 7 file modifications. No new npm dependencies. Existing 34 unit tests must continue passing.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Principle I — Semantic Version Control**: Branch `002-dd-logs-observability` follows speckit sequential convention. All commits follow Conventional Commits (`feat(observability): ...`). No direct commits to `main`. PR opened on completion.
- [x] **Principle II — Continuous Commit Discipline**: Tasks are granular (one file per task); each committed after completion with task ID in message.
- [x] **Principle III — Build & Runtime Verification Gate**: Final phase includes `ng build` (zero errors) and `ng serve` (app runs with observability active) before PR.
- [x] **Principle IV — Test Coverage Mandate**: JEST exclusively; 100% coverage threshold enforced; `src/app/core/testing/**` excluded from `collectCoverageFrom`; all 3 new production files have spec files.
- [x] **Principle V — Living Documentation**: README update task in final phase; documents observability setup and CI variable requirements.

## Project Structure

### Documentation (this feature)

```text
specs/002-dd-logs-observability/
├── plan.md                          # This file
├── research.md                      # Phase 0 output
├── data-model.md                    # Phase 1 output
├── quickstart.md                    # Phase 1 output
├── contracts/
│   └── observability-service-api.md # ObservabilityService public interface contract
└── tasks.md                         # Phase 2 output (/speckit-tasks)
```

### Source Code (new files)

```text
src/app/core/
├── types/
│   └── dd-logs.types.ts              # LogPayload, EventType, Severity, DdLogsInstance, declare global
├── services/
│   ├── observability.service.ts      # Central DD_LOGS facade + watchView helper
│   └── observability.service.spec.ts
├── interceptors/
│   ├── dd-logs.interceptor.ts        # HTTP error capture
│   └── dd-logs.interceptor.spec.ts
├── handlers/
│   ├── global-error.handler.ts       # Angular ErrorHandler + unhandledrejection in main.ts
│   └── global-error.handler.spec.ts
└── testing/
    └── dd-logs.mock.ts               # Shared JEST mock (excluded from coverage)
```

### Source Code (modified files)

```text
src/environments/environment.ts                          # + appVersion, deployType
src/app/app.config.ts                                    # + withInterceptorsFromDi(), HTTP_INTERCEPTORS, ErrorHandler
src/main.ts                                              # + unhandledrejection listener post-bootstrap
src/app/features/characters/characters.component.ts      # + ObservabilityService inject, viewStart, ngOnInit
src/app/features/films/films.component.ts                # + same pattern
angular.json                                             # + define block for __APP_VERSION__/__DEPLOY_TYPE__
README.md                                                # + observability section, CI variable docs
```

**Structure Decision**: All new infrastructure in `src/app/core/` following existing `core/services/` convention. Feature components modified minimally — one `private readonly` field + one `ngOnInit` call each. No NgModules; no new npm dependencies.
