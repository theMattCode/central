import { defineConfig } from 'vite';
import { devtools } from '@tanstack/devtools-vite';
import { tanstackStart } from '@tanstack/solid-start/plugin/vite';
import viteSolid from '@solidjs/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import tsconfigPaths from 'vite-tsconfig-paths';
import { env } from 'node:process';

const config = defineConfig(({ mode }) => ({
  plugins: [
    ...(mode === 'development' ? [devtools()] : []),
    // Vitest currently resolves Vite 7, so tests still need the compatibility plugin.
    ...(mode === 'test' ? [tsconfigPaths({ projects: ['./tsconfig.json'] })] : []),
    tailwindcss(),
    ...(mode === 'test' ? [] : [tanstackStart()]),
    viteSolid({ ssr: mode !== 'test' }),
    // Must stay last. Source maps are uploaded only when SENTRY_AUTH_TOKEN is set.
    ...(mode === 'test'
      ? []
      : [
          sentryVitePlugin({
            org: 'elyverse-studio',
            project: 'central-cockpit',
            authToken: env.SENTRY_AUTH_TOKEN,
            sourcemaps: { filesToDeleteAfterUpload: ['./dist/**/*.map'] },
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
  build: {
    // Source maps are only emitted for the Sentry upload and deleted afterwards.
    sourcemap: env.SENTRY_AUTH_TOKEN ? 'hidden' : false,
  },
  test: {
    setupFiles: ['./src/setupTests.ts'],
    server: {
      deps: {
        inline: [/\.jsx$/, /\/node_modules\/.*(?:@tanstack\+solid-|@solidjs\+|solid-icons)/],
      },
    },
  },
  ssr: {
    noExternal: [/^solid-js(?:\/|$)/, /^@solidjs\//, /^@tanstack\/solid-/],
  },
  resolve: {
    dedupe: ['solid-js', '@solidjs/signals', '@solidjs/web'],
    tsconfigPaths: true,
  },
  server: {
    allowedHosts: ['localhost', '127.0.0.1', 'archy.smelt-toad.ts.net'],
    hmr: {
      clientPort: 3000,
    },
  },
}));

export default config;
