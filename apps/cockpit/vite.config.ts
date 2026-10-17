import { defineConfig } from 'vite';
import { devtools } from '@tanstack/devtools-vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { sentryTanstackStart } from '@sentry/tanstackstart-react/vite';
import { env } from 'node:process';

const config = defineConfig(({ mode }) => ({
  plugins: [
    ...(mode === 'development' ? [devtools()] : []),
    tsconfigPaths({ projects: ['./tsconfig.json'] }),
    tailwindcss(),
    ...(mode === 'test' ? [] : [tanstackStart()]),
    viteReact(),
    // Must stay last. Source maps are uploaded only when SENTRY_AUTH_TOKEN is set.
    ...(mode === 'test'
      ? []
      : [
          sentryTanstackStart({
            org: 'elyverse-studio',
            project: 'central-cockpit',
            authToken: env.SENTRY_AUTH_TOKEN,
            // Only inject the release name; CI creates the release with its commits, central-update records deploys.
            release: {
              name: env.SENTRY_RELEASE || undefined,
              create: false,
              finalize: false,
              setCommits: false,
              deploy: false,
            },
          }),
        ]),
  ],
  test: {
    setupFiles: ['./src/setupTests.ts'],
  },
  server: {
    allowedHosts: ['localhost', '127.0.0.1', 'archy.smelt-toad.ts.net'],
    hmr: {
      clientPort: 3000,
    },
  },
}));

export default config;
