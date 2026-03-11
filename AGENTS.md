# AGENTS.md

This file defines how autonomous coding agents should work in this repository.

## Repository Mission

`central` is a personal "Life OS" application platform.

The codebase is currently early-stage; agents should favor simple, maintainable foundations over speculative complexity.

## Repo Layout

Use the existing project layout and keep cross-cutting docs in `docs/`.

- `apps/`: deployable applications projects.
- `services/`: backend runtime services.
- `i12e/`: infrastructure and orchestration projects.
- `libs/`: shared libraries.
- `docs/`: repository documentation
  - `toolchain.md`: tech stack and toolchain commands
  - `style.md`: code style and conventions
- `.github/workflows/`: CI definitions

## Core Working Agreement for Agents

1. Prefer the smallest correct change that solves the task.
2. Keep edits local; avoid broad refactors unless explicitly requested.
3. Preserve existing conventions (TypeScript strictness, single quotes, Nx workspace patterns).
4. Add or update tests when behavior changes.
5. Add or update documentation when behavior changes.
6. Validate changes with the relevant Nx targets before finishing.
7. If the repo lacks scaffolding needed for a request, create it with Nx generators instead of ad-hoc structure.
8. Apply best-practices and conventions to the codebase and architecture.

## Code Quality Standards

### Common

Always use the basic design principles:

- **KISS**: Keep it simple
- **DRY**: Don't repeat yourself
- **YAGNI**: You ain't gonna need it
- **SOLID**: Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, Dependency Inversion

### TypeScript

- Keep `strict` compatibility.
- Do not weaken compiler options globally to pass local issues.
- Favor explicit types at module boundaries (public APIs, exported functions, shared models).

### Architecture

- Keep shared logic in `libs/`, app-specific wiring in `apps/`, backend-specific logic in `services/`, and infrastructure concerns in `i12e/`.
- Avoid circular dependencies between libs.
- Prefer composable modules over monolithic utility files.

### Styling and Formatting

- Follow `.editorconfig` settings.
- Prettier is the formatter. Use the settings defined in `.prettierrc`.
- Follow existing file naming and directory conventions inside each package/project.

### Testing

- Add unit tests for library logic.
- Add integration/e2e coverage when user-facing workflows change.
- Do not remove tests to make CI green.

## Definition of Done (Agent Checklist)

Before handing work back, agents should complete this checklist:

1. Implementation matches request and edge cases were considered.
2. Relevant tests were added/updated.
3. `lint`, `test`, `build`, and `typecheck` were run for affected projects (or `run-many` when appropriate).
4. Documentation updated when behavior or developer workflow changed.
5. No unrelated files were modified.

If a check cannot be completed (for example, missing project targets), explicitly report what was attempted and what blocked verification.

## Git and Change Hygiene

- Keep diffs focused and reviewable.
- Avoid committing generated artifacts unless the repository already tracks them.
- Do not rewrite existing history unless explicitly requested.
- Document assumptions and follow-ups in the handoff summary.

## When Requirements Are Ambiguous

Agents should:

1. State the assumption they will proceed with.
2. Choose the most conservative implementation.
3. Leave clear extension points rather than speculative abstractions.

## Priority Order

When instructions conflict, use this order:

1. Direct user request
2. Repository-level instructions in this `AGENTS.md`
3. Existing codebase conventions
4. Default tool/framework conventions
