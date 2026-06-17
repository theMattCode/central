FROM node:24-alpine AS base
ENV PNPM_HOME='/pnpm'
ENV PATH="$PNPM_HOME:$PATH"

ARG BACKEND_BASE_URL=http://localhost:5010
ARG ASSISTANT_SERVICE_BASE_URL=http://localhost:5020
ARG VITE_BACKEND_API_BASE_URL=http://localhost:5010
ARG VITE_ASSISTANT_API_BASE_URL=http://localhost:5020
ENV BACKEND_BASE_URL=$BACKEND_BASE_URL
ENV VITE_BACKEND_API_BASE_URL=$VITE_BACKEND_API_BASE_URL
ENV ASSISTANT_SERVICE_BASE_URL=$ASSISTANT_SERVICE_BASE_URL
ENV VITE_ASSISTANT_API_BASE_URL=$VITE_ASSISTANT_API_BASE_URL

RUN corepack enable

WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/cockpit/package.json apps/cockpit/package.json
COPY apps/cockpit/scripts/ apps/cockpit/scripts/
COPY libs/ts-log/package.json libs/ts-log/package.json

RUN pnpm install --frozen-lockfile

FROM base AS dev
COPY . .
WORKDIR /workspace/apps/cockpit
EXPOSE 3000
CMD ["pnpm", "exec", "vite", "dev", "--host", "0.0.0.0", "--port", "3000", "--strictPort"]

FROM base AS build
COPY . .

RUN pnpm --dir apps/cockpit run build \
    && pnpm --filter @central/cockpit deploy --prod --legacy --offline /workspace/cockpit-deploy

FROM node:24-alpine AS prod
ARG BACKEND_BASE_URL=http://localhost:5010
ARG ASSISTANT_SERVICE_BASE_URL=http://localhost:5020
ARG VITE_BACKEND_API_BASE_URL=http://localhost:5010
ARG VITE_ASSISTANT_API_BASE_URL=http://localhost:5020
ENV BACKEND_BASE_URL=$BACKEND_BASE_URL
ENV VITE_BACKEND_API_BASE_URL=$VITE_BACKEND_API_BASE_URL
ENV ASSISTANT_SERVICE_BASE_URL=$ASSISTANT_SERVICE_BASE_URL
ENV VITE_ASSISTANT_API_BASE_URL=$VITE_ASSISTANT_API_BASE_URL

WORKDIR /workspace/apps/cockpit

COPY --from=build /workspace/cockpit-deploy/node_modules ./node_modules
COPY --from=build /workspace/cockpit-deploy/package.json ./package.json
COPY --from=build /workspace/apps/cockpit/dist ./dist

EXPOSE 3000
CMD ["node", "node_modules/srvx/bin/srvx.mjs", "serve", "--dir", ".", "--entry", "dist/server/server.js", "--static", "dist/client", "--prod"]
