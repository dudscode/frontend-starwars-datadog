# Contract: SwapiService Public Interface

**Type**: Internal Angular service contract
**File**: `src/app/core/services/swapi.service.ts`
**Date**: 2026-05-30 (revised for swapi.info flat-array API)

This document defines the public API of `SwapiService` — the single point of HTTP access in the application. All components MUST use this service; no component may inject `HttpClient` directly.

---

## Method: `getCharacters(): Observable<Character[]>`

**Purpose**: Fetch and cache the full list of Star Wars characters from swapi.info.

**Parameters**: None — swapi.info returns all 82 characters in one response.

**Returns**: `Observable<Character[]>`
- On first call: triggers `GET https://swapi.info/api/people`, caches with `shareReplay(1)`.
- On subsequent calls: returns the SAME `Observable` instance (cached reference). Replays cached result immediately on subscription — no new HTTP request.
- On HTTP error: emits `Error('Failed to load characters')`. No cache is written.

**Guarantees**:
- Always returns `Observable<Character[]>`, never `Promise`.
- Same observable instance returned on every call after the first.
- No `page` parameter — swapi.info has no server-side pagination.

---

## Method: `getFilms(): Observable<Film[]>`

**Purpose**: Fetch and cache all Star Wars films from swapi.info.

**Parameters**: None.

**Returns**: `Observable<Film[]>`
- On first call: triggers `GET https://swapi.info/api/films`, caches with `shareReplay(1)`.
- On subsequent calls: returns the SAME `Observable` instance. Replays immediately.
- On HTTP error: emits `Error('Failed to load films')`. No cache is written.

**Guarantees**:
- Always returns `Observable<Film[]>`, never `Promise`.
- Same observable instance returned on every call after the first (satisfies SC-005: revisit Films in < 100 ms).

---

## Component Public API Contract

Routed components expose NO `@Input()` or `@Output()` bindings.

| Component | @Input() | @Output() | Notes |
|-----------|----------|-----------|-------|
| `AppComponent` | none | none | Shell — router manages lifecycle |
| `CharactersComponent` | none | none | Routed view — pagination via signal |
| `FilmsComponent` | none | none | Routed view |

---

## Route Contract

| Path | Component | Lazy-loaded | Notes |
|------|-----------|-------------|-------|
| `/characters` | `CharactersComponent` | Yes (`loadComponent`) | Default landing route |
| `/films` | `FilmsComponent` | Yes (`loadComponent`) | — |
| `` (empty) | redirect → `/characters` | n/a | `pathMatch: 'full'` |
| `**` (wildcard) | redirect → `/characters` | n/a | Unknown paths |
