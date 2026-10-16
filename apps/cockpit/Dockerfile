FROM node:24-alpine AS base
ENV PNPM_HOME='/pnpm'
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/cockpit/package.json apps/cockpit/package.json

RUN pnpm install --frozen-lockfile

FROM base AS dev
COPY . .
WORKDIR /workspace/apps/cockpit
EXPOSE 3000
CMD ["node", "--import", "./instrument.server.mjs", "node_modules/vite/bin/vite.js", "dev", "--host", "0.0.0.0", "--port", "3000", "--strictPort"]

FROM base AS build
# Browser-side fallbacks baked into the bundle. Server-side URLs
# (BACKEND_BASE_URL, ASSISTANT_SERVICE_BASE_URL) are read at runtime.
ARG VITE_BACKEND_API_BASE_URL=http://localhost:3010
ARG VITE_ASSISTANT_API_BASE_URL=http://localhost:3020
# Browser Sentry DSN; empty disables browser error reporting. The server DSN (SENTRY_DSN) is read at runtime.
ARG VITE_SENTRY_DSN=
# Release name injected into the bundles and used for the source map upload.
ARG SENTRY_RELEASE=
ENV VITE_BACKEND_API_BASE_URL=$VITE_BACKEND_API_BASE_URL
ENV VITE_ASSISTANT_API_BASE_URL=$VITE_ASSISTANT_API_BASE_URL
ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN
ENV SENTRY_RELEASE=$SENTRY_RELEASE
COPY . .

# Source maps are uploaded only when the optional `sentry_auth_token` build secret is provided.
RUN --mount=type=secret,id=sentry_auth_token,env=SENTRY_AUTH_TOKEN \
    pnpm --dir apps/cockpit run build \
    && pnpm --filter @central/cockpit deploy --prod --legacy /workspace/cockpit-deploy

FROM node:24-alpine AS prod
ARG SENTRY_RELEASE=
ENV SENTRY_RELEASE=$SENTRY_RELEASE
WORKDIR /workspace/apps/cockpit

COPY --from=build /workspace/cockpit-deploy/node_modules ./node_modules
COPY --from=build /workspace/cockpit-deploy/package.json ./package.json
COPY --from=build /workspace/apps/cockpit/dist ./dist
COPY --from=build /workspace/apps/cockpit/instrument.server.mjs ./instrument.server.mjs

EXPOSE 3000
CMD ["node", "--import", "./instrument.server.mjs", "node_modules/srvx/bin/srvx.mjs", "serve", "--dir", ".", "--entry", "dist/server/server.js", "--static", "dist/client", "--prod"]
