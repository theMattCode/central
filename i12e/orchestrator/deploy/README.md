# Central Production Deploy Bundle

This directory is the source for the code-free production deploy bundle published by CI for release tags.

See `docs/deployment.md` in the repository for the full release and production deployment flow.

## Server setup

Install Docker and Tailscale on the production host. Central assumes Tailscale is managed at the host level; the Compose stack binds the gateway to `127.0.0.1:4000` by default so Tailscale Serve can expose it over the tailnet.

Create the production environment once:

```bash
cp .env.prod.example .env.prod
```

Set real values for `POSTGRES_PASSWORD`, `BACKEND_DATABASE_URL`, `BACKEND_CORS_ALLOW_ORIGIN`, and `CENTRAL_ORIGIN`.

## Update

Run:

```bash
./central-update
```

The script prompts for a version and defaults to `stable`. Exact release tags such as `v1.2.3` and prerelease tags such as `v1.3.0-rc.1` are also accepted.

Major version jumps require:

```bash
./central-update v2.0.0 --allow-major
```

The script pulls the selected image set, starts PostgreSQL, runs migrations, restarts the core application services, checks health, and prints Compose status.
