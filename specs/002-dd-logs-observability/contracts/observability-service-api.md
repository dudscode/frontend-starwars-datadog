# Contract: ObservabilityService Public Interface

**Type**: Internal Angular service contract
**File**: `src/app/core/services/observability.service.ts`
**Date**: 2026-05-31

`ObservabilityService` is the single gateway to `window.DD_LOGS`. All other files interact with Datadog exclusively through this service.

---

## Constructor

**Behaviour**: Called once by Angular's DI container (singleton, `providedIn: 'root'`).
- If `window.DD_LOGS` is undefined → returns immediately (early exit).
- If `window.DD_LOGS` exists → calls `setGlobalContextProperty('app_version', environment.appVersion)` and `setGlobalContextProperty('deploy_type', environment.deployType)`.
- These two global context calls happen exactly ONCE per application session.
- Does NOT call `window.DD_LOGS.init()` — the SDK is already initialised externally.

---

## Method: `log(payload: LogPayload): void`

**Purpose**: Send a structured event to Datadog Logs.

**Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `payload` | `LogPayload` | Yes | Structured event — must include `event_type` and `severity` |

**Behaviour**:
- If `window.DD_LOGS` is undefined → returns immediately (no-op, no error).
- Maps `payload.severity` to Datadog log level: `'error'` → `'error'`; `'warning'` → `'warn'`; `'info'` → `'info'`.
- Calls `window.DD_LOGS.logger.log(payload.event_type, { ...payload }, ddLevel)`.
- Returns `void` — fire-and-forget; no confirmation of delivery.
- Synchronous — completes in < 1 ms.

**Guarantees**:
- NEVER throws — all failures are silent.
- Does NOT add `app_version` or `deploy_type` to `payload` — these are in the DD_LOGS global context, not the per-event payload.
- Does NOT generate `session_id` — Datadog SDK handles this automatically.

---

## Method: `watchView<T>(viewName: string, ready$: Observable<T | null>): void`

**Purpose**: Measure and log the time from component construction to first data visibility.

**Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `viewName` | `string` | Route path segment, e.g. `'characters'`, `'films'` |
| `ready$` | `Observable<T \| null>` | The component's data observable. May emit `null` before data arrives (via `startWith(null)`). |

**Behaviour**:
1. Records `start = performance.now()` at call time (i.e., at `ngOnInit`, which is close to — but after — the `viewStart` field initialiser on the component).
2. Subscribes to `ready$.pipe(filter(v => v !== null), take(1))`.
3. On first non-null emission: calculates `duration_ms = Math.round(performance.now() - start)`.
4. Calls `this.log(...)` with:
   - `event_type: duration_ms > 5000 ? 'latency' : 'render_complete'`
   - `severity: duration_ms > 5000 ? 'warning' : 'info'`
   - `view_name: viewName`
   - `duration_ms`
   - `threshold_exceeded: duration_ms > 5000`
5. `take(1)` auto-completes the subscription — no memory leak.

**Guarantees**:
- Fires exactly once per call (enforced by `take(1)`).
- Never modifies `ready$` — the component's template binding is unaffected.
- If `ready$` only ever emits `null` (error state), no latency log fires. This is acceptable — an `ObservabilityService.log({ event_type: 'request_error', ... })` from `DdLogsInterceptor` will have already been sent for the failed HTTP request.

---

## Consumer Contracts

### `DdLogsInterceptor`
Injects `ObservabilityService` via constructor. On HTTP error, calls:
```
obs.log({ event_type: 'request_error', severity: 'error', http_status: error.status ?? 0, endpoint: req.url, error_message: error.message })
```
Then returns `throwError(() => error)`.

### `GlobalErrorHandler`
Resolves `ObservabilityService` lazily via `Injector.get()` inside `handleError`. Calls:
```
obs.log({ event_type: 'js_error', severity: 'error', error_message: error instanceof Error ? error.message : String(error) })
```

### `unhandledrejection` listener (in `main.ts`)
Obtained via `appRef.injector.get(ObservabilityService)` post-bootstrap. Calls:
```
obs.log({ event_type: 'js_error', severity: 'error', error_message: event.reason instanceof Error ? event.reason.message : String(event.reason ?? 'Unhandled rejection') })
```

### `CharactersComponent`
Calls `obs.watchView('characters', this.pageView$)` in `ngOnInit`.

### `FilmsComponent`
Calls `obs.watchView('films', this.films$)` in `ngOnInit`.
