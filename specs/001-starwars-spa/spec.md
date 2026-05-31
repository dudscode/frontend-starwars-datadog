# Feature Specification: Star Wars Explorer

**Feature Branch**: `001-starwars-spa`

**Created**: 2026-05-30

**Status**: Draft

**Input**: User description: "Aplicação Angular 17 com duas telas — listar personagens e listar filmes do Star Wars usando a API pública do SWAPI, com Angular Material e boas práticas de Core Web Vitals."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Browse Star Wars Characters (Priority: P1)

A user opens the application and lands on a screen showing a list of Star Wars characters. Each character entry shows their name, birth year, gender, height, and mass. Because there are many characters, the list is divided into pages of 10 and the user can navigate between pages using controls at the bottom of the list.

**Why this priority**: Characters are the most recognisable element of the Star Wars universe. This is the default landing screen and the first thing any user sees — it defines the core value of the application.

**Independent Test**: Open the application; the characters screen appears immediately. Verify that 10 characters are displayed, each entry shows name, birth year, gender, height, and mass, and page navigation controls allow moving to the next and previous pages.

**Acceptance Scenarios**:

1. **Given** the application is opened, **When** the characters screen loads, **Then** a list of 10 Star Wars characters is displayed with name, birth year, gender, height, and mass for each entry.
2. **Given** the characters screen is visible, **When** the user clicks the next-page control, **Then** the next set of 10 characters is displayed without a full page reload.
3. **Given** the characters screen is visible, **When** the user clicks the previous-page control, **Then** the previous set of 10 characters is displayed.
4. **Given** the characters screen is visible, **When** the data service is unavailable, **Then** a friendly error message in Portuguese is shown with an option to retry.
5. **Given** the characters screen is loading data, **When** the fetch is in progress, **Then** a loading indicator is visible and no layout shift occurs when the content appears.

---

### User Story 2 — Browse Star Wars Films (Priority: P2)

A user navigates to the Films screen and sees a grid of cards, one per film, each showing the episode number, title, director, and release date. All films are shown at once without pagination.

**Why this priority**: Films give users a second distinct view of Star Wars data. This screen completes the core two-screen feature set.

**Independent Test**: Navigate to the Films screen via the navigation bar; verify all Star Wars films are displayed as individual cards with episode number, title, director, and release date.

**Acceptance Scenarios**:

1. **Given** the user clicks "Filmes" in the navigation bar, **When** the films screen loads, **Then** all Star Wars films are displayed as individual cards with episode number, title, director, and release date.
2. **Given** the films screen is visible, **When** the data service is unavailable, **Then** a friendly error message in Portuguese is shown with an option to retry.
3. **Given** the films screen is loading data, **When** the fetch is in progress, **Then** a loading indicator is visible and no layout shift occurs when the cards appear.

---

### User Story 3 — Navigate Between Screens (Priority: P3)

A user can switch between the Characters screen and the Films screen at any time using a persistent navigation bar at the top of the application. The currently active screen is visually indicated in the navigation bar.

**Why this priority**: Navigation is the connective tissue between the two screens. It depends on both listing screens existing first.

**Independent Test**: From the Characters screen click "Filmes" and verify the Films screen appears. From the Films screen click "Personagens" and verify the Characters screen appears. Verify the active screen is visually highlighted.

**Acceptance Scenarios**:

1. **Given** the user is on the Characters screen, **When** they click "Filmes" in the navigation bar, **Then** the Films screen is displayed without a full page reload.
2. **Given** the user is on the Films screen, **When** they click "Personagens" in the navigation bar, **Then** the Characters screen is displayed without a full page reload.
3. **Given** the user is on any screen, **When** they look at the navigation bar, **Then** the active screen's link is visually distinguishable from the inactive one.

---

### Edge Cases

- What happens when the Star Wars data service is temporarily unavailable? → A user-friendly Portuguese error message is shown with a retry option; no blank screen or crash.
- What happens when the user navigates directly to an undefined URL path? → The application redirects to the Characters screen.
- What happens when the user navigates back to the Films screen after previously loading it? → Films data is displayed immediately without a new network request.
- What happens when the user rapidly clicks next/previous page controls? → Only the final requested page is fetched; no duplicate or out-of-order data is shown.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display a list of Star Wars characters on the Characters screen, showing name, birth year, gender, height, and mass for each character.
- **FR-002**: System MUST paginate the characters list with exactly 10 characters per page and provide next/previous page navigation controls.
- **FR-003**: System MUST display all Star Wars films on the Films screen as individual cards, each showing episode number, title, director, and release date.
- **FR-004**: System MUST provide a persistent navigation bar allowing users to switch between the Characters and Films screens at any time.
- **FR-005**: System MUST visually indicate the currently active screen in the navigation bar.
- **FR-006**: System MUST display a loading indicator while data is being fetched, and the layout MUST NOT shift when content replaces the indicator.
- **FR-007**: System MUST display a user-friendly error message in Portuguese when data cannot be loaded, with an option to retry.
- **FR-008**: System MUST default to the Characters screen when the application is first opened or when the user navigates to an undefined path.
- **FR-009**: System MUST serve films data from a local cache on repeated visits to the Films screen, avoiding redundant network requests.

### Key Entities

- **Character**: A Star Wars universe character. Key attributes displayed: name, birth year, gender, height, mass. Data is read-only and sourced from the public Star Wars API.
- **Film**: A Star Wars film. Key attributes displayed: episode number, title, director, release date. Data is read-only and sourced from the public Star Wars API.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The Characters screen fully loads and displays 10 characters within 2.5 seconds of the application opening on a standard mid-tier mobile device and connection.
- **SC-002**: Navigating between the Characters and Films screens completes in under 1 second from the moment the user clicks the navigation link.
- **SC-003**: No visible content jump or layout shift occurs at any point during data loading on either screen.
- **SC-004**: The application is interactive — users can click navigation links and page controls — within 2.5 seconds of the initial page load.
- **SC-005**: Revisiting the Films screen after a prior load displays film data instantly (under 100 ms) without a new network request.
- **SC-006**: 100% of navigation interactions between the two screens produce the correct screen without a full browser page reload.

---

## Assumptions

- Data is read-only; no user can create, edit, or delete characters or films.
- No user authentication or login is required to access either screen.
- Clicking a character or film entry does not navigate to a detail page; the application is listing-only.
- The application targets modern web browsers only; no server-side rendering or native mobile app is in scope.
- All UI copy (navigation labels, error messages) is in Portuguese, consistent with the language of the original requirement.
- The Star Wars data source is the publicly available SWAPI REST API (`swapi.dev`); no self-hosted or proprietary API is involved.
- Films are a small, static dataset (~6 total) and can be cached in memory after the first load without pagination.
- Characters are a larger dataset (~82 total) paginated at 10 per page by the data source; the application follows this server-side pagination rather than loading all characters at once.
