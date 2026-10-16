# Toolchain

## Stack

- Monorepo: Nx with pnpm workspaces (`apps/*`, `libs/*`) and a Cargo workspace (`services/Cargo.toml`)
- Frontend: TanStack Start (React) + TypeScript, TanStack Router, Vite, Tailwind CSS
- Backend services: Rust (Axum) for Backend and Assistant, toolchain pinned in `services/rust-toolchain.toml`; Python
  HTTP adapters for STT, TTS, and LLM
- Persistence: PostgreSQL 18 with forward-only SQL migrations
- Tests: Vitest + Testing Library for TypeScript, Cargo tests for Rust, `unittest` for Python
- Formatting: Prettier for TypeScript/JSON/Markdown, rustfmt (defaults) for Rust
- CI: GitHub Actions (see [deployment](./deployment.md) for the release flow)
- Node requirement: `>=24` (`package.json`, `.nvmrc` uses `lts/*`)

## Setup

```bash
corepack enable
pnpm install
```

## Projects

Nx project names match the compose service and container image names.

| Project             | Path                 | Kind                              |
| ------------------- | -------------------- | --------------------------------- |
| `app-cockpit`       | `apps/cockpit`       | TanStack Start web app            |
| `service-backend`   | `services/backend`   | Rust integrated HTTP API          |
| `service-assistant` | `services/assistant` | Rust assistant turn orchestration |
| `service-stt`       | `services/stt`       | Python faster-whisper adapter     |
| `service-tts`       | `services/tts`       | Python Qwen3-TTS adapter          |
| `service-llm`       | `services/llm`       | Python Ollama adapter             |
| `i12e-postgres`     | `i12e/postgres`      | PostgreSQL image and migrations   |
| `i12e-gateway`      | `i12e/gateway`       | Nginx production entrypoint       |
| `i12e-orchestrator` | `i12e/orchestrator`  | Compose stacks and deploy bundle  |

## Nx targets

Targets use the same names everywhere; a project only defines the ones that make sense for it.

| Target         | Meaning                                                                  |
| -------------- | ------------------------------------------------------------------------ |
| `format`       | Apply the formatter (Prettier or rustfmt).                               |
| `format-check` | Verify formatting without changing files.                                |
| `lint`         | Run a real linter or static check (clippy, compileall, nginx -t, sh -n). |
| `typecheck`    | Type-check without producing artifacts.                                  |
| `test`         | Run the tests.                                                           |
| `build`        | Produce the native build artifact (Vite bundle, cargo binary, tsc).      |

Container images are built by Docker Compose (local stacks) and CI, not by Nx targets.

`nx format` is a built-in Nx command, so call the formatter target as `pnpm nx run <project>:format`.

```bash
pnpm nx <target> <project>
pnpm nx run-many -t format-check lint typecheck test   # what CI runs
pnpm nx run-many -t build
```

### Nx in sandboxed environments

Nx plugin workers use Unix domain sockets for IPC. In restricted sandboxes this can fail with errors like
`Failed to start plugin worker for plugin ...` or `listen EPERM ... /tmp/.../d.sock`. Run Nx outside the sandbox, or
run the underlying command directly (for example `pnpm exec vitest run`, `pnpm exec tsc --noEmit`, `cargo test`).

## Local stacks

All stack commands go through [`i12e/orchestrator/scripts/stack.sh`](../i12e/orchestrator/scripts/stack.sh):

```bash
pnpm dev                          # hot-reload dev stack (compose watch)
COMPOSE_PROFILES=voice pnpm dev   # including assistant, STT, TTS, and LLM services
pnpm dev:down
pnpm logs:dev
pnpm ps:dev
pnpm migrate:dev

pnpm prod                         # build the release image set and run it like production
pnpm prod:down
pnpm logs:prod
pnpm ps:prod
pnpm migrate:prod
```

`pnpm prod` needs the ignored `i12e/orchestrator/.env.prod`, created once from
`i12e/orchestrator/deploy/.env.prod.example`. Details are in the
[orchestrator README](../i12e/orchestrator/README.md); ports are in the [service catalog](./service-catalog.md).

Run Cockpit on its own (port `5000`, against the dev stack backend):

```bash
pnpm nx run app-cockpit:start
```

## Database migrations

```bash
pnpm nx run i12e-postgres:create-migration "create users"
pnpm migrate:dev
```

See the [postgres README](../i12e/postgres/README.md) for the naming scheme and the PostgreSQL 18 volume notes.

## Shared TypeScript libraries

Generate a new library:

```bash
pnpm nx g @nx/js:lib libs/<name> --publishable --importPath=@central/<name>
```

Then rename the Nx project to `lib-<name>`, tag it `type:lib`, and add `format`, `format-check`, `typecheck`, `test`,
and `build` targets. Consumption without a build step is described in
[architecture](./architecture.md#shared-library-packaging).

Nx keeps TypeScript project references in sync; trigger or verify it manually with:

```bash
pnpm nx sync
pnpm nx sync:check
```
