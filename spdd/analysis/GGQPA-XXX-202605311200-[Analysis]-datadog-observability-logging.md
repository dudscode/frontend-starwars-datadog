# SPDD Analysis: Datadog Observability — Logging Layer (DD_LOGS)

## Original Business Requirement

# Contexto

Aplicação Angular com observabilidade via Datadog. O `window.DD_LOGS` já está
inicializado e disponível globalmente (scripts do Datadog Logs e RUM já configurados).
O RUM tem sample de apenas 5% por custo, então vamos usar DD_LOGS (sample 100%)
para medir latência de tela, capturar erros de requisição e erros de JS.

O objetivo final é alimentar uma dashboard e um monitor de rollback automático
de canary, comparando a versão canary contra a stable.

# Tarefa

Implemente os itens abaixo. NÃO reinicialize o DD_LOGS — ele já existe no window.

## 1. ObservabilityService (injectable, providedIn: 'root')

Crie um serviço central que garante o schema dos logs. Schema fixo:

  event_type: 'latency' | 'request_error' | 'js_error' | 'render_complete'
  severity:   'info' | 'warning' | 'error'
  view_name?: string
  duration_ms?: number
  threshold_exceeded?: boolean
  http_status?: number
  endpoint?: string
  error_message?: string

Requisitos:
- No construtor, setar contexto global UMA vez (se window.DD_LOGS existir):
    window.DD_LOGS.setGlobalContextProperty('app_version', <APP_VERSION>)
    window.DD_LOGS.setGlobalContextProperty('deploy_type', <DEPLOY_TYPE>)
  app_version e deploy_type devem vir do environment / variável de build,
  NÃO hardcoded. Use placeholders __APP_VERSION__ / __DEPLOY_TYPE__ se não
  houver fonte ainda, mas deixe claro com um TODO de onde virão no CI.
- Método log(payload) que mapeia severity -> nível do DD
  (error->'error', warning->'warn', resto->'info') e chama
  window.DD_LOGS.logger.log(payload.event_type, {...payload}, level).
- Guard: se window.DD_LOGS não existir, não quebrar (early return).
- NÃO gerar session_id manualmente — o DD_LOGS já injeta.

## 2. Medição de latência de tela

- Marcar performance.now() no ngOnInit e medir no ngAfterViewInit.
- Logar SEMPRE o duration_ms (não só quando passar de 5s) para permitir
  cálculo de p95/p99. threshold = 5000ms apenas define event_type e severity:
    > 5000  -> event_type 'latency',          severity 'warning', threshold_exceeded true
    <= 5000 -> event_type 'render_complete',  severity 'info',    threshold_exceeded false
- ATENÇÃO: se a tela depende de dados assíncronos para estar "pronta",
  o log deve disparar no subscribe/tap da chamada que completa a tela,
  não no ngAfterViewInit (que só mede o esqueleto). Sinalize isso onde aplicável.
- Para evitar boilerplate, extraia um helper reutilizável (método utilitário
  ou diretiva/decorator) em vez de repetir em cada componente.

## 3. HttpInterceptor para erros de requisição

- Interceptor que captura falhas em catchError.
- Logar: event_type 'request_error', severity 'error',
  http_status (error.status ?? 0, onde 0 = erro de rede/CORS),
  endpoint (req.url), error_message (error.message).
- Re-propagar o erro com throwError(() => error).
- Registrar via HTTP_INTERCEPTORS (multi: true) no módulo,
  ou provideHttpClient(withInterceptorsFromDi()) se for standalone.

## 4. GlobalErrorHandler (ErrorHandler do Angular)

- Implementar ErrorHandler.handleError.
- Logar event_type 'js_error', severity 'error',
  error_message (error?.message ?? String(error)).
- Manter console.error(error) para não perder o comportamento padrão.
- Registrar como { provide: ErrorHandler, useClass: GlobalErrorHandler }.
- Adicionar também um listener window 'unhandledrejection' no bootstrap
  chamando obs.log com event_type 'js_error', para pegar promises fora do zone.

# Restrições

- TypeScript estरिct, sem any solto além do declare global do window.DD_LOGS.
- Não criar dependência circular entre ErrorHandler/Interceptor e o service
  (use injector/inject lazy se necessário, ErrorHandler é instanciado cedo).
- Não tocar na inicialização existente do DD_LOGS nem do RUM.
- Manter app_version e deploy_type como ÚNICA fonte da verdade no service
  (via global context), não repetir em cada chamada de log.

# Saída esperada

Liste os arquivos criados/alterados e mostre como registrar os providers.

---

## Domain Concept Identification

### Existing Concepts (from codebase)

- **CharactersComponent**: View component that loads 82 characters from swapi.info in one async request. Uses `async` pipe with `pageView$` observable; the "screen ready" event is when `pageView$` first emits — NOT in `ngAfterViewInit`. Already uses `OnPush` change detection.
- **FilmsComponent**: View component that loads 6 films from swapi.info in one async request. Same async data pattern as `CharactersComponent`. "Screen ready" = first emission of `films$`.
- **SwapiService**: The only HTTP-making service; uses `HttpClient` with `shareReplay(1)` caching. HTTP errors are already `catchError`-handled in the service — the interceptor will add a logging side-effect BEFORE the service's own `catchError` re-throws.
- **app.config.ts**: The standalone application configuration file where all global providers are registered. Currently has `provideRouter`, `provideHttpClient(withFetch())`, `provideAnimationsAsync()`. This is where the new interceptor and error handler providers must be added.
- **main.ts**: The application bootstrap entry point (`bootstrapApplication`). The `unhandledrejection` window listener must be registered here, after the bootstrap promise resolves.
- **environment.ts**: Currently only has `apiUrl`. Must be extended with `appVersion` and `deployType` build-time values (placeholder strategy: `__APP_VERSION__` / `__DEPLOY_TYPE__`).

### New Concepts Required

- **ObservabilityService**: Central facade for all structured DD_LOGS calls. Owns the log schema, maps severity to DD log levels, and sets the global context properties (`app_version`, `deploy_type`) once in its constructor. All other logging consumers depend on this service exclusively — no direct `window.DD_LOGS` calls outside it.
- **LogPayload**: A typed schema interface enforcing the 8 fixed fields (`event_type`, `severity`, `view_name?`, `duration_ms?`, `threshold_exceeded?`, `http_status?`, `endpoint?`, `error_message?`). Not a class — a TypeScript interface/type that acts as the contract for every log call.
- **DdLogsInterceptor**: An Angular `HttpInterceptor` that intercepts all outgoing HTTP requests and, on error response, logs a `request_error` event via `ObservabilityService` before re-throwing. Must be registered with `withInterceptorsFromDi()` to work with `provideHttpClient`.
- **GlobalErrorHandler**: Angular `ErrorHandler` implementation. Catches synchronous JS errors thrown inside Angular's zone and logs them as `js_error`. Also the attachment point for the `unhandledrejection` listener (for out-of-zone promise rejections).
- **LatencyTracker**: A utility mechanism (service method, mixin, or helper function) that encapsulates the `performance.now()` start/stop pattern and the threshold logic, avoiding boilerplate repetition in every component. The precise form (method vs directive vs decorator) is a REASONS Canvas decision.
- **DD_LOGS Window Declaration**: A TypeScript `declare global` ambient type declaration for `window.DD_LOGS`. Required to satisfy strict TypeScript without using `any` throughout the codebase.

### Key Business Rules

- **No DD_LOGS re-initialization**: `ObservabilityService` MUST call only `setGlobalContextProperty` — never `init()` or any method that reconfigures the existing SDK instance.
- **Global context is set exactly once**: `app_version` and `deploy_type` are set in the `ObservabilityService` constructor, with a guard for `window.DD_LOGS` presence. They MUST NOT be included in individual `log()` calls — DD_LOGS attaches global context to every log automatically.
- **Log every render, always**: Duration MUST be logged regardless of whether the threshold is exceeded. The threshold (5000 ms) only determines `event_type` (`latency` vs `render_complete`) and `severity` (`warning` vs `info`). This is critical for p95/p99 percentile computation on the Datadog dashboard.
- **Async-data latency timing**: For components that depend on async data to be "visible", the latency measurement endpoint MUST be placed at the point where the data-carrying observable emits its first value (tap/subscribe), NOT at `ngAfterViewInit`. Both `CharactersComponent` and `FilmsComponent` qualify — they show spinners until data arrives.
- **Error re-propagation**: `DdLogsInterceptor` MUST re-throw the error after logging. The existing `SwapiService` `catchError` handlers remain responsible for translating errors into user-visible state; the interceptor only adds a logging side-effect.
- **Circular dependency prevention**: `GlobalErrorHandler` is instantiated by Angular's DI container before most services. Injecting `ObservabilityService` via constructor may trigger the service's constructor (which accesses `window.DD_LOGS`) before the browser environment is fully settled. A lazy injection pattern (`inject()` called inside `handleError` or constructor with `Injector`) is required.
- **app_version / deploy_type as single source of truth**: These values flow exclusively through `environment.ts` → `ObservabilityService` global context → every log. No component or interceptor passes them in log payloads directly.

---

## Strategic Approach

### Solution Direction

- Introduce a single `ObservabilityService` at `src/app/core/services/observability.service.ts` that wraps `window.DD_LOGS` and enforces the log schema. All four logging concerns (latency, HTTP errors, JS errors, unhandled rejections) flow through this single service.
- Extend `environment.ts` with `appVersion` and `deployType` using Angular's `fileReplacements` or custom `define` constants (`__APP_VERSION__`, `__DEPLOY_TYPE__`) set by the CI/CD pipeline — no hardcoding.
- Register the `DdLogsInterceptor` by changing `provideHttpClient(withFetch())` to `provideHttpClient(withFetch(), withInterceptorsFromDi())` in `app.config.ts`, and adding `{ provide: HTTP_INTERCEPTORS, useClass: DdLogsInterceptor, multi: true }`.
- Register `GlobalErrorHandler` in `app.config.ts` as `{ provide: ErrorHandler, useClass: GlobalErrorHandler }`.
- Add the `unhandledrejection` listener in `main.ts` after `bootstrapApplication` resolves, calling `ObservabilityService` via `appRef.injector.get(ObservabilityService)`.
- Add latency measurement to `CharactersComponent` and `FilmsComponent` via a shared utility. Placement: tap into the first emission of `pageView$` / `films$` using RxJS `tap` + `take(1)` rather than lifecycle hooks, since both screens depend on async data.

### Key Design Decisions

- **LatencyTracker form — utility function vs mixin vs directive**: A standalone function injected from `ObservabilityService` has the least coupling and is easiest to unit-test. A base class creates inheritance coupling in a composition-favored codebase. A directive is overkill for a two-screen app.
  → **Recommendation**: Static/standalone helper method on `ObservabilityService` (e.g., `obs.measureView(viewName, startTime$)`) that accepts the start timestamp and the observable, returning a new observable with `tap` + `take(1)` wired in. Components call it as a single pipe operator addition.

- **Circular dependency prevention for GlobalErrorHandler**: Angular's `ErrorHandler` is created during the injector bootstrap, before many services are available. Constructor-injecting `ObservabilityService` directly risks circular dependency or "service not yet available" errors.
  → **Recommendation**: Use `inject(ObservabilityService)` inside the `handleError` method body (lazy call-site injection), or store the injector reference and resolve lazily. In Angular 17+ standalone, `inject()` inside method bodies is supported in some contexts — verify during REASONS Canvas phase.

- **`withFetch()` and interceptor compatibility**: Angular's `withFetch()` backend processes requests via the browser Fetch API. Class-based interceptors registered with `withInterceptorsFromDi()` ARE compatible with `withFetch()` in Angular 17. Functional interceptors (`withInterceptors([fn])`) are the newer pattern but require different registration syntax.
  → **Recommendation**: Keep `withInterceptorsFromDi()` for class-based `DdLogsInterceptor` — consistent with the app's existing OOP patterns and simpler error-shape handling via `HttpErrorResponse`.

- **`app_version` / `deploy_type` build-time injection**: Angular's `angular.json` `fileReplacements` can swap `environment.ts` per configuration; alternatively, `@angular-devkit/build-angular` supports `define` object for string replacement (similar to Webpack `DefinePlugin`). The `__APP_VERSION__` convention requires the define to be configured in `angular.json` under `projects.starwars-explorer.architect.build.options`.
  → **Recommendation**: Use `define` in `angular.json` build options to replace `__APP_VERSION__` and `__DEPLOY_TYPE__` strings at build time. Document the CI variables clearly with a TODO comment in `environment.ts`.

### Alternatives Considered

- **Directly calling `window.DD_LOGS` from components/interceptors**: Rejected — no schema enforcement, no central guard, impossible to unit-test without global state, violates single-source-of-truth for `app_version`/`deploy_type`.
- **ngAfterViewInit for all latency measurement**: Rejected — both `CharactersComponent` and `FilmsComponent` depend on async data. `ngAfterViewInit` fires after the skeleton/spinner renders, not after the data is visible. This would systematically underreport actual user-perceived latency.
- **Functional HTTP interceptors (`withInterceptors([fn])`)**: Viable alternative, but the requirement explicitly mentions the `HTTP_INTERCEPTORS` token and class-based registration. Class approach also aligns with existing OOP service patterns in the codebase.

---

## Risk & Gap Analysis

### Requirement Ambiguities

- **`unhandledrejection` listener placement**: The requirement says "add listener in bootstrap" but does not specify HOW to obtain `ObservabilityService` before the Angular app is fully initialised. The `bootstrapApplication` promise resolves with an `ApplicationRef` whose `injector` can be used — but this pattern needs to be validated against Angular 17's bootstrap lifecycle.
- **LatencyTracker helper form**: "Método utilitário ou diretiva/decorator" — the requirement leaves the choice open. The REASONS Canvas phase must pick one and justify it.
- **`view_name` values**: The requirement does not define what strings to use for `view_name` per screen (e.g., `'characters'` vs `'character-list'` vs `'/characters'`). Should it match the Angular route path or a human-readable label?
- **`withFetch()` and interceptor error object shape**: When using the Fetch backend, network errors may not always be `HttpErrorResponse` instances. The `error.status ?? 0` convention in the requirement covers this, but the exact error type in the interceptor catch block needs verification.
- **`define` syntax availability**: Not all Angular 17 build configurations expose `define` natively. May require `@angular-builders/custom-webpack` or a specific `angular.json` build option. The exact configuration path must be confirmed during implementation.

### Edge Cases

- **`window.DD_LOGS` not available at service instantiation**: Possible in unit tests, SSR, or if the Datadog script is blocked by an ad blocker. The early-return guard in `ObservabilityService` handles this, but tests must mock `window.DD_LOGS` carefully.
- **Component navigated away before data arrives**: If the user navigates away from `/characters` before the `pageView$` observable emits, the `tap + take(1)` latency measurement may fire on a destroyed component context. Using `takeUntilDestroyed()` (Angular 17) in the pipe is the safe mitigation.
- **Multiple subscriptions to `pageView$`**: `pageView$` uses `startWith(null)` and multiple downstream consumers (loading, error, data). The `take(1)` for latency measurement must target the first NON-null emission — the first emission after data arrives, not the `startWith(null)` emission.
- **`GlobalErrorHandler` called before `ObservabilityService` is initialised**: On very early errors (e.g., during module loading), the `inject()` call inside `handleError` may fail. A try-catch wrapper around the `ObservabilityService` injection call provides a safety net.
- **Re-entrant error logging**: If `ObservabilityService.log()` itself throws (e.g., `window.DD_LOGS.logger.log` fails), `GlobalErrorHandler.handleError` would be called again, causing infinite recursion. The service's guard should be robust, and `handleError` should catch errors from the service call.

### Technical Risks

- **Circular dependency: `GlobalErrorHandler` → `ObservabilityService`**: Angular's `ErrorHandler` provider is resolved during the injector initialization phase, before all services are registered. Depending on provider registration order, resolving `ObservabilityService` in the error handler's constructor could cause "injector not yet ready" errors. **Mitigation**: Lazy injection via `inject()` inside the method body or `Injector.get()` pattern.
- **`withFetch()` + `withInterceptorsFromDi()` combination**: This combination must be verified — both flags must coexist in `provideHttpClient(withFetch(), withInterceptorsFromDi())`. Angular 17 supports this, but the order of flags matters. **Mitigation**: Test with a simple pass-through interceptor before implementing the full logging logic.
- **Build-time `define` configuration for `__APP_VERSION__`**: Angular 17's `@angular/build` (esbuild-based) uses a different `define` syntax than Webpack. If the project uses the legacy Webpack builder, `definePlugin` applies. If using the new esbuild builder (Angular 17 default), `define` is configured under `architect.build.options.define`. **Mitigation**: Verify `angular.json` builder type during implementation; add a TODO comment in `environment.ts` with exact CI variable names.
- **Test isolation for `window.DD_LOGS`**: JEST uses jsdom, which does not have `window.DD_LOGS`. All tests for `ObservabilityService`, `DdLogsInterceptor`, and `GlobalErrorHandler` must set up `window.DD_LOGS` as a mock in `beforeEach` / `afterEach` to avoid cross-test pollution. **Mitigation**: Create a shared test helper (`setupDdLogsMock()`) in the test suite.
- **`performance.now()` in JEST/jsdom**: jsdom provides `performance.now()` but it may return `0` in some configurations. The latency measurement tests must mock `performance.now` explicitly.

### Acceptance Criteria Coverage

| AC# | Description | Addressable? | Gaps/Notes |
|-----|-------------|--------------|------------|
| 1 | `ObservabilityService` injectable, sets global context once, typed schema, `log()` method with severity mapping, guard | Yes | `view_name` string values not defined in requirement |
| 2 | Latency measured in every component; always logged; threshold logic for event_type/severity; no boilerplate | Partial | Async-data components need observable tap, not `ngAfterViewInit`; `take(1)` must skip `startWith(null)` emission |
| 3 | `HttpInterceptor` logs `request_error` on failures, re-throws, registered via `withInterceptorsFromDi()` | Yes | Need to change `provideHttpClient(withFetch())` → `provideHttpClient(withFetch(), withInterceptorsFromDi())` in `app.config.ts` |
| 4 | `GlobalErrorHandler` implements `ErrorHandler`, logs `js_error`, keeps `console.error`, registered in providers | Yes | Circular dependency risk requires lazy injection pattern |
| 5 | `unhandledrejection` listener in bootstrap | Partial | Mechanism for obtaining `ObservabilityService` post-bootstrap needs to be validated |
| 6 | TypeScript strict, no loose `any`, `declare global` for `window.DD_LOGS` | Yes | Standard ambient declaration pattern |
| 7 | `app_version`/`deploy_type` from environment/build vars, not hardcoded | Partial | Build-time `define` config in `angular.json` needs validation per builder type |
| 8 | 100% unit test coverage (per constitution Principle IV) | Partial | Requires careful `window.DD_LOGS` mocking and `performance.now` mocking in JEST |
