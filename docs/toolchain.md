# Toolchain

## Stack

- Monorepo: Nx (integrated workspace)
- Package manager: pnpm
- Frontend framework: TanStack Start (React) + TypeScript
- Backend services: Rust (Axum)
- Routing: TanStack Router
- Build/dev server: Vite (via TanStack Start)
- Styling: Tailwind CSS
- Unit tests: Vitest + Testing Library
- E2E tests: Playwright
- CI: GitHub Actions
- Node requirement: `>=24` (`package.json`, `.nvmrc` uses `lts/*`)

## Command Reference

Run commands from repository root.

### Setup

```bash
corepack enable
pnpm install
```

### Nx task execution

```bash
pnpm nx <target> <project>
pnpm nx run-many -t <target1> <target2>
```

### CI-equivalent local check

```bash
pnpm nx run-many -t lint test build typecheck
```

### Generate a new TypeScript library

```bash
npx nx g @nx/js:lib libs/<name> --publishable --importPath=@central/<name>
```

### Run tasks

To build the library use:

```sh
npx nx build pkg1
```

To run any task with Nx use:

```sh
npx nx <target> <project-name>
```

These targets are either [inferred automatically](https://nx.dev/concepts/inferred-tasks?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) or defined in the `project.json` or `package.json` files.

[More about running tasks in the docs &raquo;](https://nx.dev/features/run-tasks?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

### Persistence image project

Build the persistence-layer PostgreSQL image:

```bash
pnpm nx build i12e-postgres
```

Run the persistence-layer PostgreSQL container:

```bash
pnpm nx run i12e-postgres:run
```

The standalone PostgreSQL run target publishes `5001:5432` by default.

Override standalone container name/port when needed:

```bash
POSTGRES_PORT=55432 POSTGRES_CONTAINER_NAME=central-i12e-postgres-dev pnpm nx run i12e-postgres:run
```

Apply SQL migrations against the running PostgreSQL container:

```bash
pnpm nx run i12e-postgres:migrate
```

Create a new SQL migration file:

```bash
MIGRATION_NAME=create_users pnpm nx run i12e-postgres:create-migration
```

### Cockpit container

Build the cockpit container image:

```bash
pnpm nx run cockpit:container-build
```

Run the cockpit container image:

```bash
pnpm nx run cockpit:container-run
```

The standalone cockpit dev server (`pnpm nx run cockpit:start`) runs on `5000`.
The cockpit container run target publishes `5000:3000`.

For tailscale exposure:

Cockpit (`5000`):
```
tailscale serve --tcp 5000 http://127.0.0.1:5000
```

### Weather service container

Build the weather service container image:

```bash
pnpm nx run weather-service:container-build
```

Run the weather service container image:

```bash
pnpm nx run weather-service:container-run
```

The weather container run target publishes `5010:8080`.

### Orchestrator project

Start complete the complete development environment with all required services run:

```bash
pnpm nx run i12e-orchestrator:up-dev
```

To start the production environment use:

```bash
pnpm nx run i12e-orchestrator:up-prod
```

The migration step runs as a one-off `postgres-migrate` container and is removed after completion.

For a complete list of orchestrated services and their port mappings, see [Service Catalog](./service-catalog.md).

Stop all orchestrated services:

Dev:
```bash
pnpm nx run i12e-orchestrator:down-dev
```

Prod:
```bash
pnpm nx run i12e-orchestrator:down-prod
```

Re-run migrations:

Requires PostgreSQL to already be running.

Dev:

```bash
pnpm nx run i12e-orchestrator:migrate-dev
```

Prod:
```bash
pnpm nx run i12e-orchestrator:migrate-prod
```

### Versioning and releasing

To version and release the library use

```
npx nx release
```

Pass `--dry-run` to see what would happen without actually releasing the library.

[Learn more about Nx release &raquo;](https://nx.dev/features/manage-releases?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

### Keep TypeScript project references up to date

Nx automatically updates TypeScript [project references](https://www.typescriptlang.org/docs/handbook/project-references.html) in `tsconfig.json` files to ensure they remain accurate based on your project dependencies (`import` or `require` statements). This sync is automatically done when running tasks such as `build` or `typecheck`, which require updated references to function correctly.

To manually trigger the process to sync the project graph dependencies information to the TypeScript project references, run the following command:

```sh
npx nx sync
```

You can enforce that the TypeScript project references are always in the correct state when running in CI by adding a step to your CI job configuration that runs the following command:

```sh
npx nx sync:check
```

[Learn more about nx sync](https://nx.dev/reference/nx-commands#sync)

### CI setup

#### Step 1

To connect to Nx Cloud, run the following command:

```sh
npx nx connect
```

Connecting to Nx Cloud ensures a [fast and scalable CI](https://nx.dev/ci/intro/why-nx-cloud?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) pipeline. It includes features such as:

- [Remote caching](https://nx.dev/ci/features/remote-cache?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [Task distribution across multiple machines](https://nx.dev/ci/features/distribute-task-execution?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [Automated e2e test splitting](https://nx.dev/ci/features/split-e2e-tasks?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [Task flakiness detection and rerunning](https://nx.dev/ci/features/flaky-tasks?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

#### Step 2

Use the following command to configure a CI workflow for your workspace:

```sh
npx nx g ci-workflow
```

[Learn more about Nx on CI](https://nx.dev/ci/intro/ci-with-nx#ready-get-started-with-your-provider?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

### Install Nx Console

Nx Console is an editor extension that enriches your developer experience. It lets you run tasks, generate code, and improves code autocompletion in your IDE. It is available for VSCode and IntelliJ.

[Install Nx Console &raquo;](https://nx.dev/getting-started/editor-setup?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

### Useful links

Learn more:

- [Learn more about this workspace setup](https://nx.dev/nx-api/js?utm_source=nx_project&amp;utm_medium=readme&amp;utm_campaign=nx_projects)
- [Learn about Nx on CI](https://nx.dev/ci/intro/ci-with-nx?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [Releasing Packages with Nx release](https://nx.dev/features/manage-releases?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [What are Nx plugins?](https://nx.dev/concepts/nx-plugins?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

And join the Nx community:
- [Discord](https://go.nx.dev/community)
- [Follow us on X](https://twitter.com/nxdevtools) or [LinkedIn](https://www.linkedin.com/company/nrwl)
- [Our Youtube channel](https://www.youtube.com/@nxdevtools)
- [Our blog](https://nx.dev/blog?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
