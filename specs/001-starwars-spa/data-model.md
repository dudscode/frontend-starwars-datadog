# Data Model: Star Wars Explorer

**Phase 1 output for**: `specs/001-starwars-spa/plan.md`
**Date**: 2026-05-30

All entities are read-only TypeScript interfaces (not classes). Data flows from the SWAPI REST API through typed service responses to view-layer projection objects rendered in templates.

---

## Entity: `SwapiPage<T>`

Generic pagination envelope returned by every SWAPI list endpoint.

```typescript
interface SwapiPage<T> {
  count: number;       // total records across all pages
  next: string | null; // URL of next page, or null
  previous: string | null; // URL of previous page, or null
  results: T[];        // items for the current page
}
```

**Validation rules**:
- `count` is always a positive integer from the API.
- `next` / `previous` are `null` on boundary pages — components must handle both states for paginator rendering.
- `results` length is always ≤ 10 for `/people/` and ≤ 6 for `/films/`.

---

## Entity: `Character`

Raw API response shape from `GET /people/?page={n}`. Not rendered directly — projected to `CharacterDisplayItem` first.

```typescript
interface Character {
  name: string;
  birth_year: string; // e.g. "19BBY", "unknown"
  gender: string;     // e.g. "male", "female", "n/a", "unknown"
  height: string;     // cm as string, e.g. "172" or "unknown"
  mass: string;       // kg as string, e.g. "77" or "unknown"
  homeworld: string;  // URL reference — not displayed
  films: string[];    // array of film URL references — not displayed
  url: string;        // self-reference URL — not displayed
}
```

**Notes**: SWAPI returns numeric values (height, mass) as strings. Display them as-is; no unit conversion needed.

---

## Entity: `CharacterDisplayItem`

View-layer projection of `Character`. Contains only the five fields rendered in the list template. Produced by the pure function `toCharacterDisplayItem`.

```typescript
interface CharacterDisplayItem {
  name: string;
  birth_year: string;
  gender: string;
  height: string;
  mass: string;
}

function toCharacterDisplayItem(c: Character): CharacterDisplayItem {
  return {
    name: c.name,
    birth_year: c.birth_year,
    gender: c.gender,
    height: c.height,
    mass: c.mass,
  };
}
```

**Why a projection?** Decouples the template from the full `Character` shape. If SWAPI adds or renames fields, only the interface and mapping function change — not the template.

---

## Entity: `Film`

Raw API response shape from `GET /films/`. Not rendered directly — projected to `FilmDisplayItem`.

```typescript
interface Film {
  episode_id: number;
  title: string;
  director: string;
  producer: string;       // not displayed
  release_date: string;   // ISO 8601 date string, e.g. "1977-05-25"
  opening_crawl: string;  // not displayed (long text)
  characters: string[];   // array of character URL references — not displayed
  url: string;            // self-reference URL — not displayed
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
  return {
    episode_id: f.episode_id,
    title: f.title,
    director: f.director,
    release_date: f.release_date,
  };
}
```

---

## Data Flow Diagram

```
SWAPI REST API
  │
  │  GET /people/?page={n} → SwapiPage<Character>
  │  GET /films/           → SwapiPage<Film>
  │
  ▼
SwapiService (HttpClient)
  │  shareReplay(1) on films only
  │  catchError on both
  │
  ├─► CharactersComponent
  │     toObservable(currentPage)
  │       .pipe(switchMap(page => getCharacters(page)))
  │     → pageData$: Observable<SwapiPage<Character>>
  │     → isLoading$, error$
  │     Template: *ngFor over pageData$.results
  │               each result → MatListItem (name, birth_year, gender, height, mass)
  │               MatPaginator bound to pageData$.count
  │
  └─► FilmsComponent
        getFilms().pipe(map(page => page.results.map(toFilmDisplayItem)))
        → films$: Observable<FilmDisplayItem[]>
        → isLoading$, error$
        Template: *ngFor over films$
                  each item → MatCard (episode_id, title, director, release_date)
```

---

## State Transitions

### Characters Page State

```
IDLE → LOADING (page requested)
  → SUCCESS (data arrived)
  → ERROR (HTTP failure)
ERROR → LOADING (retry clicked)
SUCCESS → LOADING (paginator page changed)
```

### Films Cache State

```
UNCACHED → LOADING (first subscription)
  → CACHED (data arrived, shareReplay holds it)
  → ERROR (HTTP failure, no cache written)
CACHED → CACHED (subsequent subscriptions replay immediately)
```

---

## Validation Rules

| Field | Rule |
|-------|------|
| `SwapiPage.count` | Must be ≥ 0; MatPaginator length bound to this value |
| `SwapiPage.results` | Must be an array; empty array renders empty state, not error |
| `CharacterDisplayItem.name` | Rendered as primary text in list item; never expected to be empty from SWAPI |
| `FilmDisplayItem.episode_id` | Rendered as number; no formatting conversion needed |
| `FilmDisplayItem.release_date` | Displayed as-is (ISO string); no localisation conversion in this version |
