import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['resources/**/*.test.{ts,tsx}'],
    css: false,
    passWithNoTests: true,
  },
})
