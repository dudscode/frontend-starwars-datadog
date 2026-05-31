# SPDD Analysis: Angular 17 Star Wars App — Characters & Films Listing

## Original Business Requirement

Crie uma aplicação com angular 17, standalone, usando rotas e tenha uma duas telas, uma de listar os personagens e outra de listar os filmes, usando a api publica do starwars, use o angular material, deve seguir as boas particas do core web vitals

---

## Domain Concept Identification

### Existing Concepts (from codebase)
- None. The project is fully **greenfield** — only `requirements.md` and `CLAUDE.md` exist. No Angular workspace, no `package.json`, no source files.

### New Concepts Required
- **Character (Personagem)**: A Star Wars character entity sourced from the public SWAPI `/people` endpoint. Has attributes such as name, birth year, gender, homeworld, etc. Rendered as a list item in the Characters screen.
- **Film (Filme)**: A Star Wars film entity sourced from the SWAPI `/films` endpoint. Has attributes such as title, episode ID, director, release date, opening crawl, etc. Rendered as a list item in the Films screen.
- **CharacterList**: A screen/route that fetches and displays a paginated or full list of Star Wars characters.
- **FilmList**: A screen/route that fetches and displays a paginated or full list of Star Wars films.
- **Navigation Shell**: The top-level application shell providing routing, navigation links between the two screens, and the Material toolbar.
- **SwapiService**: A shared data-access service responsible for all HTTP communication with the SWAPI public API, abstracting character and film fetching from the UI layer.

### Key Business Rules
- **Two screens only**: The requirement scopes the application to exactly two listing screens — no detail pages are specified.
- **Public API consumption**: All data comes from the SWAPI public REST API; no local persistence or authentication is required.
- **Standalone architecture**: The Angular app must use standalone components (no `NgModule`-based architecture), as mandated by the requirement and aligned with Angular 17's recommended approach.
- **Route-based navigation**: Each screen must be a separate route (e.g., `/characters` and `/films`), accessible via the Angular Router.
- **Angular Material UI**: All UI components must be sourced from Angular Material; no custom or third-party UI framework is to be used alongside it.
- **Core Web Vitals compliance**: The application must be built following Core Web Vitals best practices — specifically targeting good LCP (Largest Contentful Paint), CLS (Cumulative Layout Shift), and INP (Interaction to Next Paint) scores.

---

## Strategic Approach

### Solution Direction
- Scaffold an Angular 17 workspace configured for standalone components as default. Use `@angular/cli` v17 with `--standalone` flag.
- Define two lazy-loaded routes (`/characters` → `CharactersComponent`, `/films` → `FilmsComponent`) in a root `app.routes.ts` file, bootstrapped via `bootstrapApplication` in `main.ts`.
- Implement a single `SwapiService` (providedIn root) using Angular's `HttpClient` to fetch data from `https://swapi.dev/api/people/` and `https://swapi.dev/api/films/`.
- Use Angular Material components for the UI: `MatToolbar` for the navigation shell, `MatNavList` or `MatCard` + `MatList` for listing items, `MatProgressSpinner` for loading states, and `MatPaginator` for pagination if the character list spans multiple pages.
- Apply Core Web Vitals optimizations: lazy-load route chunks, use `OnPush` change detection on all listing components, defer non-critical Angular Material imports, and avoid layout shifts with skeleton/placeholder patterns during API loading.

### Key Design Decisions

- **Lazy loading for routes**: Both `CharactersComponent` and `FilmsComponent` should be lazy-loaded via `loadComponent` in the route config rather than eagerly imported. This reduces the initial bundle size, improving LCP for the landing page.
  → **Recommendation**: Use `loadComponent` (standalone-compatible lazy loading). This is the Angular 17 idiomatic approach and directly serves Core Web Vitals.

- **SWAPI pagination strategy for Characters**: SWAPI `/people` returns paginated results (10 items per page, ~82 total characters). Films endpoint returns all films in a single response (~6 films). The characters screen must decide between infinite scroll, a "load more" button, or Angular Material's `MatPaginator`.
  → **Recommendation**: Use `MatPaginator` for characters. It is explicit, accessible, avoids cumulative layout shift from dynamic content injection, and is a standard Angular Material pattern.

- **Change detection strategy**: All listing components should use `ChangeDetectionStrategy.OnPush` to minimize unnecessary DOM checks and improve INP scores.
  → **Recommendation**: `OnPush` on both components, with observables fed via the `async` pipe (avoids manual subscription management and ensures clean CD cycles).

- **HTTP loading state management**: To avoid CLS during API fetch, a minimum-height container or skeleton placeholder should be shown before data arrives. A simple `loading$` observable flag in each component suffices without introducing a state-management library.
  → **Recommendation**: Local component state (`isLoading` boolean + `async` pipe) — no NgRx or RxJS Subject needed for this scope.

- **SWAPI URL**: `swapi.dev` is the canonical public instance. An alternative is `https://swapi.py4e.com/api/` (same API, different host). Since the requirement does not specify, use `swapi.dev` as the primary and make the base URL configurable via an `environment.ts` constant.
  → **Recommendation**: `environment.ts` base URL constant pointing to `https://swapi.dev/api`.

### Alternatives Considered
- **Eagerly loaded routes**: Simpler setup but increases initial bundle size — rejected in favour of lazy loading for Core Web Vitals compliance.
- **NgModule-based architecture**: Contradicts the requirement which explicitly mandates standalone components.
- **Third-party table/grid library**: Rejected; Angular Material provides sufficient `MatTable` and `MatList` components for a listing use case.
- **NgRx / Signal Store for state management**: Overkill for two-screen read-only listings; local component state is sufficient and reduces bundle size.

---

## Risk & Gap Analysis

### Requirement Ambiguities
- **What fields to display per character/film?**: The requirement says "listar os personagens / filmes" but does not specify which attributes to show (e.g., name only, or name + birth year + gender for characters; title only, or title + director + release date for films). This is a UX design decision left implicit.
- **Pagination or full list?**: Characters in SWAPI are paginated (10 per page). The requirement does not specify whether to paginate or load all at once. Loading all ~82 characters would require 9 sequential or parallel requests.
- **Default route**: It is unclear which screen should be the landing page when the user navigates to `/`. A redirect from `/` to `/characters` is a reasonable default but is not stated.
- **Core Web Vitals specifics**: "Seguir as boas práticas do Core Web Vitals" is intentionally broad. No specific score thresholds (e.g., LCP < 2.5s) or audit tooling (Lighthouse, PageSpeed Insights) are specified.
- **No detail screens mentioned**: The requirement scopes to listing only. It is unclear whether clicking a character/film item should navigate to a detail page or do nothing. The analysis assumes listing-only with no detail route.
- **Language / Locale**: The requirement is written in Portuguese but does not specify whether the UI copy (labels, tooltips, navigation links) should be in Portuguese or English.

### Edge Cases
- **SWAPI unavailability**: If `swapi.dev` is down or rate-limited, the application will show an empty list or crash. A basic error state (error message + retry option) is not mentioned but is expected by users.
- **Empty API response**: SWAPI currently returns data but future deprecation or empty datasets should be handled gracefully with an "no results" empty state.
- **Character pagination boundary**: If the user is on page N and the total count changes between navigations (unlikely for SWAPI, but still), the paginator must not show a page that no longer exists.
- **CORS**: SWAPI (`swapi.dev`) supports CORS for browser requests. If the base URL is switched to a self-hosted instance, CORS headers must be verified.
- **Slow network / large initial payload**: SWAPI responses are JSON with nested URLs. The Characters response includes URLs for homeworld, films, species, etc. Parsing these on low-end devices could impact INP if synchronous DOM updates are triggered.
- **Image assets**: SWAPI does not provide images. If the design requires images (e.g., character portraits), a third-party source would be needed, introducing additional LCP risk.

### Technical Risks
- **SWAPI rate limiting**: `swapi.dev` imposes no documented rate limit but is a shared public resource. Rapid pagination navigation could trigger throttling. **Mitigation direction**: Cache HTTP responses using Angular's `HttpInterceptor` or RxJS `shareReplay` on service observables.
- **Bundle size and LCP**: Angular Material imports can be large if entire modules are imported rather than individual component imports (standalone import style). **Mitigation**: Import only the specific Material components needed per standalone component.
- **CLS during data load**: Without fixed-height placeholders, the page will reflow when list items appear after the HTTP response. **Mitigation**: Use `MatProgressSpinner` inside a fixed-height container or `MatSkeletonLoader` (if available in the Material version) to reserve space.
- **Angular 17 compatibility**: Angular Material v17 requires specific peer dependency versions. The workspace must be generated with matching Angular CDK, Angular Material, and Angular CLI versions to avoid peer dependency conflicts.
- **SWAPI response shape changes**: The public SWAPI API is stable but not versioned with SLAs. Any field name changes would silently break the application if TypeScript interfaces are not defined. **Mitigation**: Define typed interfaces (`Character`, `Film`, `SwapiPage<T>`) as the API contract boundary.

### Acceptance Criteria Coverage
| AC# | Description | Addressable? | Gaps/Notes |
|-----|-------------|--------------|------------|
| 1 | Application uses Angular 17 | Yes | Greenfield scaffold with Angular CLI v17 |
| 2 | Standalone components (no NgModule) | Yes | `bootstrapApplication` + `loadComponent` routes |
| 3 | Routing between two screens | Yes | `app.routes.ts` with `/characters` and `/films` routes |
| 4 | Screen: list Star Wars characters | Yes | `CharactersComponent` + `SwapiService.getCharacters()` |
| 5 | Screen: list Star Wars films | Yes | `FilmsComponent` + `SwapiService.getFilms()` |
| 6 | Uses public Star Wars API (SWAPI) | Yes | `https://swapi.dev/api` via `HttpClient` |
| 7 | Uses Angular Material | Yes | Material components for toolbar, lists, spinner |
| 8 | Follows Core Web Vitals best practices | Partial | Lazy loading + OnPush + fixed containers addressed; no explicit score thresholds defined in requirement — needs clarification on what "best practices" means in this context |
