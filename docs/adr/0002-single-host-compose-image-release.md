# Single-Host Compose Releases from Tested Images

Central production runs on one Linux host with Docker Compose as the deployment boundary. CI builds the core production image set, boots it in a prod-like integration environment, and only publishes release tags after the image set passes smoke tests; the homeoffice server deploys by selecting a tested version tag such as `stable` or `v1.2.3`, pulling images, and restarting Compose without needing source code or a build toolchain. Each release also publishes a small deploy bundle containing the production Compose file, the update script, and an example environment file.

The core production stack is Cockpit, Backend, PostgreSQL, migrations, and an Nginx gateway exposed through Tailscale. Assistant, voice, STT, TTS, and LLM services are excluded from the baseline until they are reliable enough to ship as an optional profile. Major SemVer releases signal incompatible changes that may require planned downtime.

Deployments coordinate with backend work through a DB-backed maintenance mode, a deploy advisory lock, and bounded task draining before migrations run. This keeps old services serving while images are pulled, stops new mutating/background work before schema changes, and only restarts the app stack after migrations pass.
