# Central Production Deploy Bundle

Source of the code-free deploy bundle that CI publishes for release tags: `docker-compose.prod.yml`, `central-update`,
and `.env.prod.example`.

The same compose file and env template also back the local release-style stack (`pnpm prod`).

Server setup, updates, rollbacks, and inspection are documented in
[docs/deployment.md](../../../docs/deployment.md).
