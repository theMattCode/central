import { defineConfig } from 'vite';
import { devtools } from '@tanstack/devtools-vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const config = defineConfig(({ mode }) => ({
  plugins: [
    ...(mode === 'development' ? [devtools()] : []),
    tsconfigPaths({ projects: ['./tsconfig.json'] }),
    tailwindcss(),
    ...(mode === 'test' ? [] : [tanstackStart()]),
    viteReact(),
  ],
  test: {
    setupFiles: ['./src/setupTests.ts'],
  },
  server: {
    allowedHosts: ['localhost', '117.0.0.1', 'archy.smelt-toad.ts.net'],
    hmr: {
      clientPort: 3000,
    },
  },
}));

export default config;
