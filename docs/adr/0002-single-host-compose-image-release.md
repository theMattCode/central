# Single-Host Compose Releases from Tested Images

Central production runs on one Linux host with Docker Compose as the deployment boundary. CI builds the core production image set, pushes it to GHCR under disposable PR tags or immutable SHA tags, boots that image set in a prod-like integration environment, and only publishes release tags after the image set passes smoke tests; the homeoffice server deploys by selecting a tested version tag such as `stable` or `v1.2.3`, pulling images, and restarting Compose without needing source code or a build toolchain. Each release also publishes a small deploy bundle containing the production Compose file, the update script, and an example environment file.

The core production stack is Cockpit, Backend, PostgreSQL, migrations, and an Nginx gateway exposed through Tailscale. Assistant, voice, STT, TTS, and LLM services are excluded from the baseline until they are reliable enough to ship as an optional profile. Major SemVer releases signal incompatible changes that may require planned downtime.

Future deployment hardening may add DB-backed maintenance mode, a deploy advisory lock, and bounded task draining before migrations run. The current `central-update` script pulls images, starts PostgreSQL, optionally backs up the database, runs migrations, starts Backend/Cockpit/Gateway, and checks health.
