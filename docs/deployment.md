# Release and Production Deployment

Central production deploys from tested container images, not from source code on the server.

## Release flow

CI in `.github/workflows/ci.yml` owns release creation:

1. Pull requests run validation and build disposable GHCR images tagged `pr-<number>-<sha12>`.
2. Pushes to `main` run validation, build GHCR images tagged `sha-<sha12>`, and smoke-test that exact image set with the production Compose file.
3. Git tags matching `v*.*.*` also run validation, build `sha-<sha12>` images, and smoke-test the image set.
4. After smoke tests pass on a tag push, CI publishes version tags from the tested SHA images.
5. Exact stable tags such as `v1.2.3` also move the `stable` tag.
6. Prerelease tags such as `v1.3.0-rc.1` publish only that version tag and do not move `stable`.
7. Tag releases package a deploy bundle artifact containing:
   - `docker-compose.prod.yml`
   - `central-update`
   - `.env.prod.example`

The release tag must point at a commit reachable from `main`; CI rejects release tags outside `main`.

## Images

Production Compose pulls these images from GHCR:

- `ghcr.io/themattcode/central/app-cockpit:${CENTRAL_VERSION}`
- `ghcr.io/themattcode/central/service-backend:${CENTRAL_VERSION}`
- `ghcr.io/themattcode/central/i12e-postgres:${CENTRAL_VERSION}`
- `ghcr.io/themattcode/central/i12e-gateway:${CENTRAL_VERSION}`

`CENTRAL_VERSION` defaults to `stable`. Use exact release tags for pinned deployments and rollbacks.

## Create a release

From a clean `main` commit:

```bash
git tag v1.2.3
git push origin v1.2.3
```

Then wait for CI to pass. The tag push publishes the versioned image set, updates `stable` for exact stable SemVer tags, and uploads the deploy bundle artifact.

For a prerelease:

```bash
git tag v1.3.0-rc.1
git push origin v1.3.0-rc.1
```

Deploy prereleases by exact version. `stable` remains unchanged.

## Server setup

Install Docker and Tailscale on the production host. Tailscale is host-managed; the Compose stack binds the gateway to `127.0.0.1:4000` by default so Tailscale Serve can expose it over the tailnet.

Unpack the deploy bundle on the server, then create the environment file once:

```bash
cp .env.prod.example .env.prod
```

Set production values in `.env.prod`:

- `POSTGRES_PASSWORD`
- `BACKEND_DATABASE_URL`
- `BACKEND_CORS_ALLOW_ORIGIN`
- `CENTRAL_ORIGIN`
- optional `CENTRAL_VERSION`

If GHCR packages are private, log in on the host:

```bash
docker login ghcr.io
```

## Deploy or update

Run from the unpacked deploy bundle:

```bash
./central-update
```

The script prompts for a version and defaults to `stable`.

Deploy an exact version:

```bash
./central-update v1.2.3
```

Deploy a prerelease:

```bash
./central-update v1.3.0-rc.1
```

Major version jumps require explicit approval:

```bash
./central-update v2.0.0 --allow-major
```

The update script:

1. writes `CENTRAL_VERSION` to `.env.prod`,
2. pulls the selected image set,
3. starts PostgreSQL and waits for health,
4. creates a PostgreSQL backup for major jumps or when `--backup` is passed,
5. runs migrations,
6. starts `service-backend`, `app-cockpit`, and `i12e-gateway`,
7. checks gateway and backend health,
8. prints Compose status.

Backups are written to `backups/` next to the deploy bundle unless `BACKUP_DIR` overrides it. Use `--skip-backup` only when an external backup already exists.

## Rollback

Rollback by deploying an older exact release tag:

```bash
./central-update v1.2.2
```

Database rollback is not automatic. If migrations are not backward-compatible, restore from a backup before starting the older version.

## Inspect production

Use the same env and Compose file as the update script:

```bash
docker compose --env-file .env.prod --file docker-compose.prod.yml ps
docker compose --env-file .env.prod --file docker-compose.prod.yml logs
```

Stop the stack:

```bash
docker compose --env-file .env.prod --file docker-compose.prod.yml down
```
