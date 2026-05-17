import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import monacoEditorPluginModule from 'vite-plugin-monaco-editor'

const monacoEditorPlugin = (monacoEditorPluginModule as any).default

const viteDevURL = process.env.INERTIA_VITE_DEV_URL || 'http://localhost:5173'

export default defineConfig({
  plugins: [
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
        app: 'resources/js/app.tsx'
      },
    }
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    cors: true,
    origin: viteDevURL,
  }
})
