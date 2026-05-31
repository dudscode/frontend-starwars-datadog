# Contract: SWAPI REST API (Consumed Endpoints)

**Type**: External REST API contract (consumed, not owned)
**Base URL**: `https://swapi.dev/api` (configured in `environment.ts`)
**Authentication**: None
**CORS**: Enabled for browser requests
**Date**: 2026-05-30

---

## Endpoint 1: List Characters (Paginated)

**URL**: `GET {baseUrl}/people/?page={pageNumber}`

**Path Parameters**: none

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page` | integer | No (default: 1) | Page number, 1-indexed |

**Response shape** (HTTP 200):
```json
{
  "count": 82,
  "next": "https://swapi.dev/api/people/?page=2",
  "previous": null,
  "results": [
    {
      "name": "Luke Skywalker",
      "birth_year": "19BBY",
      "gender": "male",
      "height": "172",
      "mass": "77",
      "homeworld": "https://swapi.dev/api/planets/1/",
      "films": ["https://swapi.dev/api/films/1/", "..."],
      "url": "https://swapi.dev/api/people/1/"
    }
  ]
}
```

**TypeScript type**: `SwapiPage<Character>` (see `data-model.md`)

**Pagination behaviour**:
- Page size: 10 items fixed (SWAPI does not support custom page sizes)
- Total pages: `Math.ceil(count / 10)` = 9 pages for 82 characters
- `next` is `null` on the last page; `previous` is `null` on the first page

**Error cases**:
| HTTP Status | Cause | Application Response |
|-------------|-------|---------------------|
| 404 | Page number out of range | Treat as error; show Portuguese error message |
| 500 / network error | SWAPI unavailable | Show Portuguese error message with retry option |

---

## Endpoint 2: List Films

**URL**: `GET {baseUrl}/films/`

**Query Parameters**: none (all films returned in a single response)

**Response shape** (HTTP 200):
```json
{
  "count": 6,
  "next": null,
  "previous": null,
  "results": [
    {
      "episode_id": 4,
      "title": "A New Hope",
      "director": "George Lucas",
      "producer": "Gary Kurtz, Rick McCallum",
      "release_date": "1977-05-25",
      "opening_crawl": "It is a period of civil war...",
      "characters": ["https://swapi.dev/api/people/1/", "..."],
      "url": "https://swapi.dev/api/films/1/"
    }
  ]
}
```

**TypeScript type**: `SwapiPage<Film>` (see `data-model.md`)

**Caching**: Response is cached in memory via `shareReplay(1)` for the session lifetime.

**Error cases**:
| HTTP Status | Cause | Application Response |
|-------------|-------|---------------------|
| 500 / network error | SWAPI unavailable | Show Portuguese error message with retry option |

---

## Contract Stability Notes

- SWAPI is a public, community-maintained API with no versioning SLA. The field names above have been stable since 2014.
- The application is protected against shape changes by typed TypeScript interfaces. If a field is renamed or removed by SWAPI, TypeScript compilation will fail — surfacing the breakage at build time, not runtime.
- If `swapi.dev` becomes unavailable, the base URL can be switched to `swapi.py4e.com` in `environment.ts` without code changes.
