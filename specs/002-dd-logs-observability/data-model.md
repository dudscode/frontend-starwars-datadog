# Data Model: Application Observability — DD_LOGS Layer

**Phase 1 output for**: `specs/002-dd-logs-observability/plan.md`
**Date**: 2026-05-31

All entities are TypeScript types/interfaces (not classes). No database or persistence layer. All data flows through `window.DD_LOGS.logger.log` as a side-effect.

---

## Type: `EventType`

Union type discriminating the four event categories.

```typescript
type EventType = 'latency' | 'request_error' | 'js_error' | 'render_complete';
```

**Usage rules**:
- `render_complete`: screen loaded within 5000 ms threshold
- `latency`: screen loaded OVER 5000 ms threshold
- `request_error`: HTTP request failed (any status)
- `js_error`: Angular zone error OR unhandled promise rejection

---

## Type: `Severity`

Union type for the three log severity levels.

```typescript
type Severity = 'info' | 'warning' | 'error';
```

**Mapping to Datadog log levels**:
| Severity | DD log level |
|----------|-------------|
| `'error'` | `'error'` |
| `'warning'` | `'warn'` |
| `'info'` | `'info'` |

---

## Interface: `LogPayload`

The schema contract for every event sent to Datadog Logs. All fields except `event_type` and `severity` are optional — each event type uses a subset.

```typescript
interface LogPayload {
  event_type: EventType;           // required — discriminates the event
  severity: Severity;              // required — determines DD log level
  view_name?: string;              // 'characters' | 'films' — for latency events
  duration_ms?: number;            // integer ms — for latency/render_complete events
  threshold_exceeded?: boolean;    // true when duration_ms > 5000 — for latency events
  http_status?: number;            // HTTP status code (0 = network error) — for request_error
  endpoint?: string;               // request URL — for request_error
  error_message?: string;          // error description — for js_error and request_error
}
```

**Field usage by event type**:

| Field | `render_complete` | `latency` | `request_error` | `js_error` |
|-------|-------------------|-----------|-----------------|------------|
| `view_name` | ✅ | ✅ | — | — |
| `duration_ms` | ✅ | ✅ | — | — |
| `threshold_exceeded` | `false` | `true` | — | — |
| `http_status` | — | — | ✅ (0–599) | — |
| `endpoint` | — | — | ✅ | — |
| `error_message` | — | — | ✅ | ✅ |

---

## Interface: `DdLogsInstance`

Ambient type definition for `window.DD_LOGS`. This is the only `any`-adjacent type in the codebase. Defined as `declare global { interface Window { DD_LOGS?: DdLogsInstance } }`.

```typescript
interface DdLogsInstance {
  setGlobalContextProperty(key: string, value: string): void;
  logger: {
    log(message: string, context: Record<string, unknown>, level: string): void;
  };
}
```

**Constraints**:
- `init()` is NOT declared — calling it is a contract violation.
- `DD_LOGS` is `optional` (`?`) on `Window` — the existence check `if (!window.DD_LOGS) return` is the guard.

---

## Data Flow

```
[screen load completes]
  │ performance.now() start stored at component construction
  │ watchView('characters', pageView$) called in ngOnInit
  │   └─ filter(non-null) + take(1) fires on first data arrival
  │       └─ ObservabilityService.log({ event_type, severity, view_name, duration_ms, threshold_exceeded })
  │           └─ window.DD_LOGS.logger.log(event_type, {...payload}, ddLevel)

[HTTP request fails]
  │ DdLogsInterceptor.intercept() catches error in catchError pipe
  │   └─ ObservabilityService.log({ event_type: 'request_error', ..., http_status, endpoint, error_message })
  │       └─ window.DD_LOGS.logger.log(...)
  │   └─ throwError(() => error)  [error continues to SwapiService.catchError]

[JS error thrown inside Angular zone]
  │ GlobalErrorHandler.handleError(error)
  │   └─ console.error(error)   [always]
  │   └─ injector.get(ObservabilityService).log({ event_type: 'js_error', ... })
  │       └─ window.DD_LOGS.logger.log(...)

[Unhandled promise rejection]
  │ window 'unhandledrejection' listener (registered in main.ts after bootstrapApplication resolves)
  │   └─ appRef.injector.get(ObservabilityService).log({ event_type: 'js_error', ... })
  │       └─ window.DD_LOGS.logger.log(...)

[All log events automatically include]
  │ app_version  (set once in ObservabilityService constructor via setGlobalContextProperty)
  │ deploy_type  (set once in ObservabilityService constructor via setGlobalContextProperty)
  └─ session_id  (injected automatically by Datadog SDK — not set by this layer)
```

---

## Validation Rules

| Field | Rule |
|-------|------|
| `duration_ms` | `Math.round(performance.now() - start)` — integer only, no floating-point |
| `http_status` | `error.status ?? 0` — `0` explicitly represents network/CORS failures |
| `error_message` | `error instanceof Error ? error.message : String(error)` — safe for non-Error thrown values |
| `threshold_exceeded` | `duration_ms > 5000` (strict greater-than; exactly 5000 is NOT exceeded) |
| `view_name` | Always lowercase route path segment: `'characters'` or `'films'` |
