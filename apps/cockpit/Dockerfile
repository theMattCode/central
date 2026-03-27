FROM node:24-alpine
ENV PNPM_HOME='/pnpm'
ENV PATH="$PNPM_HOME:$PATH"

ARG WEATHER_SERVICE_BASE_URL=http://localhost:5010
ARG VOICE_SERVICE_BASE_URL=http://localhost:5020
ARG VITE_WEATHER_API_BASE_URL=http://localhost:5010
ARG VITE_VOICE_API_BASE_URL=http://localhost:5020
ENV WEATHER_SERVICE_BASE_URL=$WEATHER_SERVICE_BASE_URL
ENV VITE_WEATHER_API_BASE_URL=$VITE_WEATHER_API_BASE_URL
ENV VOICE_SERVICE_BASE_URL=$VOICE_SERVICE_BASE_URL
ENV VITE_VOICE_API_BASE_URL=$VITE_VOICE_API_BASE_URL

RUN corepack enable

WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/cockpit/package.json apps/cockpit/package.json
COPY apps/cockpit/scripts/ apps/cockpit/scripts/
COPY libs/ts-log/package.json libs/ts-log/package.json

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm --dir apps/cockpit run build

WORKDIR /workspace/apps/cockpit
EXPOSE 3000
CMD ["pnpm", "exec", "vite", "preview", "--host", "0.0.0.0", "--port", "3000", "--strictPort"]
