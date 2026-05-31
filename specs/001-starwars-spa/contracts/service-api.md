# Contract: SwapiService Public Interface

**Type**: Internal Angular service contract
**File**: `src/app/core/services/swapi.service.ts`
**Date**: 2026-05-30

This document defines the public API of `SwapiService` — the single point of HTTP access in the application. All components MUST use this service; no component may inject `HttpClient` directly.

---

## Method: `getCharacters(page?: number): Observable<SwapiPage<Character>>`

**Purpose**: Fetch one page of Star Wars characters from SWAPI.

**Parameters**:
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | `number` | `1` | Page number (1-indexed). |

**Returns**: `Observable<SwapiPage<Character>>`
- Emits once with the page data, then completes.
- Does NOT replay on re-subscription (no `shareReplay`) — each call fetches a fresh page.
- On HTTP error: emits an error notification with `Error` message `'Failed to load characters'`.

**Usage in component**:
```typescript
toObservable(this.currentPage).pipe(
  switchMap(page => this.swapiService.getCharacters(page))
)
```

**Guarantees**:
- Always returns an `Observable<SwapiPage<Character>>` — never a `Promise`.
- Error is wrapped in a typed `Error` object; components must handle via `catchError`.

---

## Method: `getFilms(): Observable<SwapiPage<Film>>`

**Purpose**: Fetch all Star Wars films from SWAPI. Cached in memory after the first call.

**Parameters**: none

**Returns**: `Observable<SwapiPage<Film>>`
- On first call: triggers an HTTP GET and caches the result via `shareReplay(1)`.
- On subsequent calls: replays the cached result immediately (no new HTTP request).
- On HTTP error: emits an error notification with `Error` message `'Failed to load films'`. No cache is written.

**Usage in component**:
```typescript
this.swapiService.getFilms().pipe(
  map(page => page.results.map(toFilmDisplayItem))
)
```

**Guarantees**:
- Always returns the SAME `Observable` instance after the first call (cached reference).
- Never returns a `Promise`.
- Error is wrapped in a typed `Error` object; components must handle via `catchError`.

---

## Component Public API Contract

Routed components (`AppComponent`, `CharactersComponent`, `FilmsComponent`) expose NO `@Input()` or `@Output()` bindings. They are route-level views, not reusable shared components.

| Component | @Input() | @Output() | Reason |
|-----------|----------|-----------|--------|
| `AppComponent` | none | none | Shell — router manages lifecycle |
| `CharactersComponent` | none | none | Routed view — no parent to bind to |
| `FilmsComponent` | none | none | Routed view — no parent to bind to |

---

## Route Contract

| Path | Component | Lazy-loaded | Notes |
|------|-----------|-------------|-------|
| `/characters` | `CharactersComponent` | Yes (`loadComponent`) | Default landing route |
| `/films` | `FilmsComponent` | Yes (`loadComponent`) | — |
| `` (empty) | redirect → `/characters` | n/a | `pathMatch: 'full'` |
| `**` (wildcard) | redirect → `/characters` | n/a | Unknown paths |
