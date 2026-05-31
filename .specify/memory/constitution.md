<!--
SYNC IMPACT REPORT
==================
Version change: [unfilled template] → 1.0.0
Bump rationale: MINOR — first full population; all 5 principles defined, governance and workflow sections added.

Modified principles:
  - [PRINCIPLE_1_NAME] → I. Semantic Version Control (NEW)
  - [PRINCIPLE_2_NAME] → II. Continuous Commit Discipline (NEW)
  - [PRINCIPLE_3_NAME] → III. Build & Runtime Verification Gate (NEW)
  - [PRINCIPLE_4_NAME] → IV. Test Coverage Mandate (NEW)
  - [PRINCIPLE_5_NAME] → V. Living Documentation (NEW)

Added sections:
  - Development Workflow
  - Technology & Tooling Standards

Removed sections: none

Templates updated:
  ✅ .specify/templates/plan-template.md — Constitution Check gates reflect all 5 principles
  ✅ .specify/templates/tasks-template.md — Notes section updated with JEST, Playwright, commit, and README rules
  ✅ .specify/templates/spec-template.md — No structural changes required; already aligned
  ✅ .specify/templates/checklist-template.md — No structural changes required; already aligned

Deferred TODOs: none
-->

# datadog-angular Constitution

## Core Principles

### I. Semantic Version Control

All branches and commits MUST follow the [Conventional Commits](https://www.conventionalcommits.org/) specification.

**Branching rules**:
- Branch names MUST follow the pattern `<type>/<short-description>` (e.g., `feat/character-list`, `fix/swapi-error-handling`, `chore/update-deps`).
- Direct commits to `main` are STRICTLY PROHIBITED. All changes MUST be introduced via a feature branch and merged through a Pull Request.
- A Pull Request MUST be opened as soon as any feature implementation is complete.

**Commit message rules**:
- Format: `<type>(<scope>): <subject>` — e.g., `feat(characters): add paginated list with MatPaginator`.
- Allowed types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`, `style`, `ci`.
- Subject line MUST be imperative, present tense, and no longer than 72 characters.
- Breaking changes MUST be annotated with `BREAKING CHANGE:` in the commit body.

### II. Continuous Commit Discipline

A commit MUST be made immediately after completing each individual task.

- Tasks are the atomic unit of work; incomplete tasks MUST NOT be committed.
- Each commit MUST reference the task identifier in the subject or body (e.g., `feat(films): implement FilmsComponent (T005)`).
- Committing a batch of multiple tasks in one commit is PROHIBITED unless the tasks are logically inseparable (document the reason in the commit body when an exception applies).

### III. Build & Runtime Verification Gate (NON-NEGOTIABLE)

Before any implementation is declared complete and the Pull Request is opened, the following MUST pass without errors:

1. **Build**: `ng build` (or equivalent production build command) MUST succeed with zero errors and zero budget violations.
2. **Start**: `ng serve` (or equivalent development server) MUST start and the application MUST be reachable in a browser with core functionality demonstrably working.

No implementation is considered done if either of these steps fails. CI passing is not a substitute for local verification.

### IV. Test Coverage Mandate (NON-NEGOTIABLE)

**Unit tests**:
- MUST be written using **JEST exclusively**. No other unit test framework (Karma, Jasmine, Mocha, Vitest, etc.) is permitted.
- Unit test coverage MUST reach **100%** (statements, branches, functions, and lines) before the implementation is marked complete.
- Tests MUST be co-located with the source file they cover (e.g., `characters.component.spec.ts` alongside `characters.component.ts`).

**End-to-end tests**:
- MUST be written using **MCP Playwright** exclusively. No other E2E framework (Cypress, Protractor, Selenium, etc.) is permitted.
- E2E tests MUST cover all primary user journeys defined in the feature specification.

**Testing discipline**:
- Tests MUST be written and verified to fail before the corresponding implementation is written (Red phase of Red-Green-Refactor).
- Tests that always pass regardless of implementation (vacuous tests) are NOT acceptable toward the coverage requirement.

### V. Living Documentation

The `README.md` at the project root MUST be created or updated every time an implementation is finalised, before the Pull Request is opened.

Documentation MUST include, at minimum:
- Project overview and purpose.
- Prerequisites and installation steps.
- Commands to run the application locally (`ng serve`), run unit tests (`jest`), run E2E tests (Playwright), and build for production (`ng build`).
- Description of any environment variables or configuration required.

Outdated or missing README is treated as an incomplete implementation — the PR MUST NOT be merged until documentation is current.

---

## Development Workflow

The standard development lifecycle for any feature or fix is:

1. **Branch** — Create a feature branch from `main` following Principle I naming rules.
2. **Implement** — Complete tasks in dependency order, committing after each task (Principle II).
3. **Test** — Write JEST unit tests to 100% coverage; write Playwright E2E tests (Principle IV).
4. **Verify** — Run `ng build` and `ng serve` to confirm the build and runtime pass (Principle III).
5. **Document** — Update `README.md` to reflect the completed implementation (Principle V).
6. **Pull Request** — Open a PR targeting `main` with a descriptive title and summary. PR description MUST reference the feature spec and list the tasks completed.
7. **Review** — At least one approval is required before merging. All CI checks MUST pass.
8. **Merge** — Squash-merge or rebase-merge into `main`; delete the feature branch after merge.

---

## Technology & Tooling Standards

| Concern         | Mandated Tool / Standard         | Alternatives Prohibited |
|-----------------|----------------------------------|------------------------|
| Frontend        | Angular 17 (standalone)          | React, Vue, Svelte, etc. |
| UI Components   | Angular Material v17             | Custom component libs, PrimeNG, etc. |
| Unit Testing    | JEST                             | Karma, Jasmine, Vitest |
| E2E Testing     | MCP Playwright                   | Cypress, Protractor, Selenium |
| Version Control | Conventional Commits + Git flow  | Free-form commit messages |
| Build           | Angular CLI v17 (`ng build`)     | Custom webpack configs that bypass CLI |

---

## Governance

- This constitution supersedes all conflicting team conventions, ticket descriptions, or verbal agreements.
- All Pull Requests MUST be reviewed against this constitution before approval. Reviewers MUST verify:
  - Commit history follows Conventional Commits (Principle I).
  - Build and start verification was performed (Principle III).
  - 100% unit test coverage with JEST (Principle IV).
  - E2E tests with Playwright present for new user journeys (Principle IV).
  - README is up-to-date (Principle V).
- **Amendment procedure**: Amendments require a dedicated PR with `docs: amend constitution to vX.Y.Z` as the title, a written rationale for the change, and approval from the project lead. The version MUST be incremented according to semantic versioning rules defined below.
- **Versioning policy**:
  - MAJOR: Removal or redefinition of an existing principle in a backward-incompatible way.
  - MINOR: Addition of a new principle or materially expanded guidance.
  - PATCH: Clarifications, wording improvements, typo fixes.
- **Compliance reviews**: The constitution MUST be reviewed at the start of each new major feature to confirm it remains accurate and actionable.

**Version**: 1.0.0 | **Ratified**: 2026-05-30 | **Last Amended**: 2026-05-30
