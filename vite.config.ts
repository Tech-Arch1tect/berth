import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import monacoEditorPluginModule from 'vite-plugin-monaco-editor';
import { VitePWA } from 'vite-plugin-pwa';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const monacoEditorPlugin = (monacoEditorPluginModule as any).default;

const pwaIconScript = fileURLToPath(new URL('./utils/generate-pwa-icons.mjs', import.meta.url));

const viteDevURL = process.env.INERTIA_VITE_DEV_URL || 'http://localhost:5173';

export default defineConfig({
  plugins: [
    {
      name: 'berth:pwa-icons',
      buildStart() {
        execFileSync(process.execPath, [pwaIconScript], { stdio: 'inherit' });
      },
    },
    tanstackRouter({
      routesDirectory: 'resources/js/routes',
      generatedRouteTree: 'resources/js/routeTree.gen.ts',
      target: 'react',
      autoCodeSplitting: true,
    }),
    react(),
    monacoEditorPlugin({
      languageWorkers: ['editorWorkerService', 'css', 'html', 'json', 'typescript'],
    }),
    VitePWA({
      injectRegister: null,
      manifest: false,
      registerType: 'prompt',
      filename: 'sw.js',
      scope: '/',
      buildBase: '/build/',
      workbox: {
        globPatterns: ['assets/**/*.{js,css,woff,woff2}'],
        globIgnores: [
          '**/sw.js',
          '**/workbox-*.js',
          '.vite/**',
          '**/*.worker-*.js',
          '**/editor.api*.js',
          'monacoeditorwork/**',
        ],
        navigateFallback: null,
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
    }),
  ],
  experimental: {
    renderBuiltUrl(filename) {
      return '/build/' + filename;
    },
  },
  build: {
    outDir: 'public/build',
    manifest: true,
    rollupOptions: {
      input: {
        app: 'resources/js/app.tsx',
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    cors: true,
    origin: viteDevURL,
  },
});
