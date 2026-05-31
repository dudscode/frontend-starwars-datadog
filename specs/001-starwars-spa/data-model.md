# Data Model: Star Wars Explorer

**Phase 1 output for**: `specs/001-starwars-spa/plan.md`
**Date**: 2026-05-30 (revised after swapi.info clarification)

All entities are read-only TypeScript interfaces (not classes). Data flows from `swapi.info` REST API as flat arrays → cached in service → projected to display-only view objects → rendered in templates.

---

## Entity: `Character`

Raw API response shape for one item in `GET https://swapi.info/api/people` response array.

```typescript
interface Character {
  name: string;
  birth_year: string;   // e.g. "19BBY", "unknown"
  gender: string;       // e.g. "male", "female", "n/a", "unknown"
  height: string;       // cm as string, e.g. "172" or "unknown"
  mass: string;         // kg as string, e.g. "77" or "unknown"
  homeworld: string;    // URL reference — not displayed
  films: string[];      // array of film URL references — not displayed
  url: string;          // e.g. "https://swapi.info/api/people/1"
}
```

**Notes**: SWAPI returns numeric values (height, mass) as strings. Displayed as-is.

---

## Entity: `CharacterDisplayItem`

View-layer projection of `Character`. Contains only the five fields rendered in the list template.

```typescript
interface CharacterDisplayItem {
  name: string;
  birth_year: string;
  gender: string;
  height: string;
  mass: string;
}

function toCharacterDisplayItem(c: Character): CharacterDisplayItem {
  return { name: c.name, birth_year: c.birth_year, gender: c.gender, height: c.height, mass: c.mass };
}
```

---

## Entity: `Film`

Raw API response shape for one item in `GET https://swapi.info/api/films` response array.

```typescript
interface Film {
  episode_id: number;
  title: string;
  director: string;
  producer: string;       // not displayed
  release_date: string;   // ISO 8601, e.g. "1977-05-25"
  opening_crawl: string;  // not displayed
  characters: string[];   // URL references — not displayed
  url: string;            // e.g. "https://swapi.info/api/films/1"
}
```

---

## Entity: `FilmDisplayItem`

View-layer projection of `Film`. Contains the four fields rendered in the card template.

```typescript
interface FilmDisplayItem {
  episode_id: number;
  title: string;
  director: string;
  release_date: string;
}

function toFilmDisplayItem(f: Film): FilmDisplayItem {
  return { episode_id: f.episode_id, title: f.title, director: f.director, release_date: f.release_date };
}
```

---

## Entity: `CharactersPageView`

Computed view model for client-side pagination. Produced by `CharactersComponent` from the cached `Character[]` array.

```typescript
interface CharactersPageView {
  items: CharacterDisplayItem[];  // the 10 items for the current page
  total: number;                  // 82 — total characters (for MatPaginator length)
}
```

---

## Type Alias: `SwapiList<T>`

Documents that swapi.info returns flat arrays, not pagination wrappers.

```typescript
// swapi.info returns flat arrays — no {count, next, previous, results} wrapper.
type SwapiList<T> = T[];
```

---

## Data Flow Diagram

```
swapi.info REST API
  │
  │  GET /people  → Character[]  (82 items, all at once)
  │  GET /films   → Film[]       (6 items, all at once)
  │
  ▼
SwapiService (HttpClient)
  │  shareReplay(1) on BOTH observables (cached for session lifetime)
  │  catchError on both
  │
  ├─► CharactersComponent
  │     allCharacters$: Observable<CharacterDisplayItem[]>
  │       = getCharacters().pipe(map(chars => chars.map(toCharacterDisplayItem)), shareReplay(1))
  │
  │     pageView$: Observable<CharactersPageView | null>
  │       = combineLatest([allCharacters$, toObservable(currentPage)]).pipe(
  │           map(([all, page]) => ({
  │             items: all.slice(page * 10, (page + 1) * 10),
  │             total: all.length
  │           }))
  │         )
  │
  │     Template: MatList with *ngFor over page.items
  │               MatPaginator [length]="page.total" [pageSize]="10"
  │
  └─► FilmsComponent
        films$: Observable<FilmDisplayItem[] | null>
          = getFilms().pipe(map(films => films.map(toFilmDisplayItem)), shareReplay(1))
        Template: *ngFor over films$ → one MatCard per film

---

## State Transitions

### Characters Data State
```
LOADING (initial fetch) → CACHED (shareReplay emits on subscription)
LOADING → ERROR (HTTP failure, no cache written)
CACHED → PAGE_CHANGE (signal update → combineLatest recomputes slice, no HTTP)
```

### Films Data State
```
LOADING (first subscription) → CACHED (shareReplay emits on subscription)
LOADING → ERROR (HTTP failure)
CACHED → CACHED (subsequent subscriptions replay immediately, no HTTP)
```

---

## Validation Rules

| Field | Rule |
|-------|------|
| `CharacterDisplayItem.name` | Rendered as primary text — never expected to be empty from swapi.info |
| `CharactersPageView.items.length` | Always ≤ 10; may be < 10 on the last page (82 mod 10 = 2) |
| `CharactersPageView.total` | Always 82 (static swapi.info dataset) |
| `FilmDisplayItem.episode_id` | Rendered as number; no formatting conversion needed |
| `FilmDisplayItem.release_date` | Displayed as-is (ISO string) |
