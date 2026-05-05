# Central

Monorepo for a personal _Life OS_ app

## Dev

Start the full hot-reload development stack from the repository root:

```bash
pnpm dev
```

Stop it with:

```bash
pnpm dev:down
```

## Prod

Create the local production environment file once:

```bash
cp i12e/orchestrator/.env.prod.example i12e/orchestrator/.env.prod
```

Set production secrets in `i12e/orchestrator/.env.prod`, replace placeholder values, then start the release-style stack:

```bash
pnpm prod
```

Stop it with:

```bash
pnpm prod:down
```

Inspect stacks:

```bash
pnpm ps:dev
pnpm logs:dev
pnpm ps:prod
pnpm logs:prod
```
