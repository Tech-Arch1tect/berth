import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import monacoEditorPluginModule from 'vite-plugin-monaco-editor'

const monacoEditorPlugin = (monacoEditorPluginModule as any).default

export default defineConfig({
  plugins: [
    react(),
    monacoEditorPlugin({
      languageWorkers: ['editorWorkerService', 'css', 'html', 'json', 'typescript'],
    }),
  ],
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
    origin: 'http://localhost:5173',
  }
})
