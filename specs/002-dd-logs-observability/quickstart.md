# Quickstart: Application Observability — DD_LOGS Layer

**Date**: 2026-05-31

This guide explains how to verify the observability layer is working after implementation.

---

## Local Development

No Datadog account needed for local testing. The guard `if (!window.DD_LOGS) return` means logging silently does nothing when the SDK is absent.

To simulate DD_LOGS locally, open the browser console and inject a mock:

```javascript
window.DD_LOGS = {
  setGlobalContextProperty: (k, v) => console.log('[DD] global:', k, v),
  logger: {
    log: (msg, ctx, lvl) => console.log(`[DD][${lvl}] ${msg}`, ctx)
  }
};
```

Then navigate to `/characters` and watch the console — you should see:

```
[DD] global: app_version unknown
[DD] global: deploy_type local
[DD][info] render_complete { event_type: 'render_complete', severity: 'info', view_name: 'characters', duration_ms: 312, threshold_exceeded: false }
```

---

## Run the Application

```bash
ng serve
# Open http://localhost:4200
# Navigate between /characters and /films
# Inject DD_LOGS mock in console to verify events
```

---

## Run Unit Tests

```bash
npx jest --coverage
# All new spec files should be green
# Coverage: 100% across observability.service.ts, dd-logs.interceptor.ts, global-error.handler.ts
```

---

## Build for Production

```bash
ng build
# Zero errors expected
# To inject build-time variables:
ng build --define '__APP_VERSION__="1.2.3"' --define '__DEPLOY_TYPE__="canary"'
```

---

## CI/CD Integration

Two environment variables must be set in the CI pipeline before `ng build`:

| Variable | Example value | Description |
|----------|---------------|-------------|
| `APP_VERSION` | `abc1234` (git SHA) | Identifies the deployed code revision |
| `DEPLOY_TYPE` | `canary` or `stable` | Identifies the deployment slot |

Build command with substitution:
```bash
ng build \
  --define "__APP_VERSION__=\"${APP_VERSION}\"" \
  --define "__DEPLOY_TYPE__=\"${DEPLOY_TYPE}\""
```

---

## Verify in Datadog

After a production or staging deployment with real `window.DD_LOGS`:

1. Open Datadog → Logs → Live Tail
2. Filter: `source:browser`
3. Navigate between `/characters` and `/films` in the app
4. Verify events appear with:
   - `event_type: render_complete` or `latency`
   - `view_name: characters` or `films`
   - `duration_ms` present (integer)
   - `app_version` and `deploy_type` on every event (from global context)
5. Simulate offline: DevTools → Network → Offline → reload
6. Verify `event_type: request_error`, `http_status: 0` appears

---

## Validation Checklist (before opening PR)

- [ ] `npx jest --coverage` passes: 100% coverage, all suites green
- [ ] Existing 34 tests still pass (no regressions)
- [ ] `ng build` completes with zero errors
- [ ] `ng serve` starts; app navigates correctly with no new console errors
- [ ] Console mock verified: `render_complete` events appear for both screens
- [ ] Console mock verified: `request_error` event appears when network is offline
- [ ] `README.md` updated with observability setup instructions
