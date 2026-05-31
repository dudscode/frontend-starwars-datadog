# Contract: swapi.info REST API (Consumed Endpoints)

**Type**: External REST API contract (consumed, not owned)
**Base URL**: `https://swapi.info/api` (configured in `src/environments/environment.ts`)
**Authentication**: None
**CORS**: Enabled for browser requests
**Response shape**: Flat arrays — NO `{count, next, previous, results}` wrapper
**Date**: 2026-05-30 (revised from swapi.dev to swapi.info)

---

## Endpoint 1: List All Characters

**URL**: `GET {baseUrl}/people`

**Query Parameters**: None — all 82 characters are returned in a single response.

**Response shape** (HTTP 200): `Character[]`
```json
[
  {
    "name": "Luke Skywalker",
    "birth_year": "19BBY",
    "gender": "male",
    "height": "172",
    "mass": "77",
    "homeworld": "https://swapi.info/api/planets/1",
    "films": ["https://swapi.info/api/films/1", "..."],
    "url": "https://swapi.info/api/people/1"
  },
  ...
]
```

**TypeScript type**: `Character[]` (see `data-model.md`)

**Pagination**: None server-side. The application implements client-side pagination by slicing the cached array.

**Caching**: Response is cached with `shareReplay(1)` in `SwapiService.charactersCache$` for the session lifetime. The HTTP request is made exactly once per application session.

**Error cases**:
| HTTP Status | Cause | Application Response |
|-------------|-------|---------------------|
| 500 / network error | swapi.info unavailable | `Error('Failed to load characters')` emitted; Portuguese error UI shown |

---

## Endpoint 2: List All Films

**URL**: `GET {baseUrl}/films`

**Query Parameters**: None — all 6 films are returned in a single response.

**Response shape** (HTTP 200): `Film[]`
```json
[
  {
    "episode_id": 4,
    "title": "A New Hope",
    "director": "George Lucas",
    "producer": "Gary Kurtz, Rick McCallum",
    "release_date": "1977-05-25",
    "opening_crawl": "It is a period of civil war...",
    "characters": ["https://swapi.info/api/people/1", "..."],
    "url": "https://swapi.info/api/films/1"
  },
  ...
]
```

**TypeScript type**: `Film[]` (see `data-model.md`)

**Caching**: Response is cached with `shareReplay(1)` in `SwapiService.filmsCache$`. The HTTP request is made exactly once per application session, satisfying spec SC-005.

**Error cases**:
| HTTP Status | Cause | Application Response |
|-------------|-------|---------------------|
| 500 / network error | swapi.info unavailable | `Error('Failed to load films')` emitted; Portuguese error UI shown |

---

## Contract Stability Notes

- swapi.info is a public, community-maintained API. Field names have been stable since 2014.
- The application is protected against shape changes by typed TypeScript interfaces — compilation fails on breaking changes.
- If `swapi.info` becomes unavailable, the base URL can be changed in `environment.ts` to an alternative host without code changes.
- **Critical difference from swapi.dev**: swapi.info returns flat arrays. The `SwapiPage<T>` wrapper (`count`/`next`/`previous`/`results`) from swapi.dev does NOT exist in swapi.info responses.
