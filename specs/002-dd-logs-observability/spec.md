# Feature Specification: Application Observability — Structured Event Logging

**Feature Branch**: `002-dd-logs-observability`

**Created**: 2026-05-31

**Status**: Draft

**Input**: "Adicionar camada de observabilidade ao SPA Angular que capture latência de tela, erros de requisição HTTP e erros de JavaScript como eventos estruturados no Datadog Logs, para alimentar um dashboard de comparação canary vs stable e um monitor de rollback automático."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Screen Latency Is Automatically Captured (Priority: P1)

Every time a user opens a screen in the application, the time from when the screen is first requested to when the content is fully visible to the user is recorded and sent to the monitoring system. This happens silently in the background — the user experience is not affected in any way.

**Why this priority**: Latency data is the primary signal for the canary rollback monitor. Without it, the dashboard has no baseline and the automatic rollback decision cannot be made.

**Independent Test**: Open the Characters screen; verify that a timing event appears in the Datadog Logs dashboard with the screen name, duration in milliseconds, and a flag indicating whether the duration exceeded the acceptable threshold.

**Acceptance Scenarios**:

1. **Given** a user opens the Characters screen, **When** the character list finishes loading, **Then** a timing event is recorded with the duration from navigation start to content visibility, the screen name, and whether the load was within the acceptable time limit.
2. **Given** a user opens the Films screen, **When** the film cards finish loading, **Then** a timing event is recorded with the same structure.
3. **Given** a screen takes longer than the acceptable threshold to load, **When** the event is recorded, **Then** it is flagged as a slow load so the monitoring system can alert on it.
4. **Given** a screen loads within the acceptable time, **When** the event is recorded, **Then** it is flagged as a normal load (no alert triggered).
5. **Given** the monitoring system is unavailable (e.g., blocked by a browser extension), **When** the application loads, **Then** the application continues to work normally — no error or crash occurs.

---

### User Story 2 — HTTP Failures Are Automatically Captured (Priority: P2)

Every time the application fails to retrieve data from the Star Wars API due to a network problem or server error, the failure is recorded in the monitoring system with details about what was requested and what went wrong. The existing user-visible error message continues to show — this is an additional background signal.

**Why this priority**: HTTP errors are the second most important canary signal. An increase in API failures after a canary deploy indicates a regression.

**Independent Test**: Simulate an API failure (e.g., via DevTools Network tab); verify that an error event appears in Datadog Logs with the request URL and HTTP status code.

**Acceptance Scenarios**:

1. **Given** the Star Wars API returns a server error (5xx), **When** the application processes the response, **Then** an error event is recorded with the HTTP status code and the requested URL.
2. **Given** the Star Wars API is unreachable (network failure / CORS), **When** the application attempts the request, **Then** an error event is recorded with status `0` (representing a network-level failure) and the requested URL.
3. **Given** an HTTP request fails for any reason, **When** the error event is recorded, **Then** the application still shows the user-facing Portuguese error message — the monitoring capture is a side effect only, it does not change user behaviour.

---

### User Story 3 — Unhandled JavaScript Errors Are Automatically Captured (Priority: P3)

If the application encounters an unexpected programming error or an unresolved asynchronous operation failure that is not caught elsewhere, the error is recorded in the monitoring system. The user still sees the default browser or application error behaviour — this is an additional signal for the engineering team.

**Why this priority**: JS errors signal regressions in the application logic itself, complementing the latency and HTTP error signals for the canary monitor.

**Independent Test**: Trigger a JavaScript error programmatically; verify it appears in Datadog Logs with an error message.

**Acceptance Scenarios**:

1. **Given** an unexpected runtime error occurs inside the application's normal execution flow, **When** the error is thrown, **Then** an error event is recorded with a description of the error.
2. **Given** an asynchronous operation (a background task or promise) fails without being caught, **When** the failure occurs, **Then** an error event is recorded with a description of the failure.
3. **Given** any JavaScript error is logged to the monitoring system, **When** the event is captured, **Then** the error also appears in the browser developer console — the monitoring is additive, not a replacement for default error reporting.

---

### User Story 4 — All Events Are Tagged With the Application Version and Deployment Type (Priority: P1)

Every event sent to the monitoring system — regardless of type — automatically includes the version of the application and whether it is running as the stable or the canary version. This allows the dashboard to compare metrics between versions.

**Why this priority**: Without version tagging, the canary vs stable comparison is impossible. This is a foundational requirement for the entire observability feature.

**Independent Test**: Trigger any event (latency, error, etc.); verify that every log entry in Datadog includes `app_version` and `deploy_type` fields.

**Acceptance Scenarios**:

1. **Given** any monitoring event is sent, **When** it appears in Datadog Logs, **Then** it includes the current application version identifier and the deployment type (`stable` or `canary`).
2. **Given** the application is deployed as a canary, **When** monitoring events are sent, **Then** all events from that session are tagged with `deploy_type: canary`.
3. **Given** the application is deployed as the stable version, **When** monitoring events are sent, **Then** all events from that session are tagged with `deploy_type: stable`.

---

### Edge Cases

- What happens when the monitoring service is unavailable (blocked ad blocker, network issue)? → The application continues to function normally with no user-visible impact; monitoring silently does nothing.
- What happens if an error occurs while trying to record another error? → The system must not enter an infinite error-reporting loop. The application falls back to basic console logging and stops attempting to notify the monitoring system.
- What happens when a screen is navigated away from before its content finishes loading? → The latency event may not fire, or fires when the data finally arrives (even if not visible). This is acceptable — missing a single event is preferable to crashing.
- What happens in the first page load before the monitoring service is ready? → Any errors that occur before the monitoring system is available are logged to the browser console only.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST record a timing event every time a screen finishes loading, capturing how long the user waited from navigation to content visibility.
- **FR-002**: Timing events MUST always be recorded regardless of duration — both fast and slow loads are captured for statistical analysis.
- **FR-003**: System MUST distinguish slow loads (exceeding the acceptable threshold) from normal loads in the event payload, so monitoring alerts can target only the slow events.
- **FR-004**: System MUST record an error event every time an HTTP request to the data source fails, capturing the request destination and the failure type (HTTP status code, or `0` for network failures).
- **FR-005**: HTTP error capture MUST be transparent — the existing user-facing error messages and retry behaviour are unaffected.
- **FR-006**: System MUST record an error event for any unhandled runtime error that occurs within the application's execution scope.
- **FR-007**: System MUST record an error event for any unhandled asynchronous operation failure that occurs outside the main application scope.
- **FR-008**: Every monitoring event MUST automatically carry the application version and deployment type without requiring individual screens or services to include them explicitly.
- **FR-009**: System MUST fail silently — if the external monitoring service is unavailable, the application behaves identically to when monitoring is working.
- **FR-010**: Monitoring MUST NOT re-initialise or reconfigure the external monitoring service; it must use the service exactly as already configured by the infrastructure team.

### Key Entities

- **TimingEvent**: Represents a screen render measurement. Key attributes: screen name, duration in milliseconds, whether the acceptable threshold was exceeded.
- **HttpErrorEvent**: Represents a failed HTTP request. Key attributes: request destination URL, HTTP status code (0 for network failures), error description.
- **JsErrorEvent**: Represents an unhandled JavaScript or asynchronous error. Key attributes: error description.
- **AppContext**: The set of metadata automatically appended to every event. Key attributes: application version, deployment type (stable or canary).

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of screen load completions generate a timing event in the monitoring system within the same user session — no screen loads are silently missed.
- **SC-002**: 100% of HTTP request failures generate an error event in the monitoring system, identifiable by request destination and failure type.
- **SC-003**: 100% of monitoring events include the `app_version` and `deploy_type` fields, enabling canary vs stable filtering without any manual annotation.
- **SC-004**: Zero increase in application load time or interaction time attributable to the observability layer — monitoring must add no perceptible latency to user interactions.
- **SC-005**: Zero new user-visible errors introduced by the observability layer — when the monitoring service is unavailable, the application behaves identically to an unmonitored baseline.
- **SC-006**: The monitoring layer operates correctly in 100% of sessions regardless of whether the user has an ad blocker or privacy tool that might block external monitoring scripts.

---

## Assumptions

- The external Datadog monitoring service is already loaded and available on the global browser context before the application starts. The observability layer does not manage the service lifecycle.
- The application version and deployment type are supplied by the CI/CD pipeline at build time; placeholder values are acceptable during local development.
- The acceptable screen load threshold (the point at which a load is flagged as "slow") is 5 seconds. This value comes from the engineering team's SLA requirements.
- Both existing screens (Characters and Films) require async data to be visible — the load time must be measured to when the data appears, not when the screen HTML skeleton is first painted.
- The observability feature is additive — no existing application behaviour, error messages, or data flows are modified by its introduction.
- Monitoring events are fire-and-forget; there is no requirement to confirm delivery, retry failed events, or queue events for later delivery.
- The monitoring system automatically attaches session identifiers; the application does not generate or manage session IDs.
