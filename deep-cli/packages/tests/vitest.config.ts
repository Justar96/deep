import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      // Since we're testing via imports, coverage tracking is limited in this setup
      // The tests themselves validate functionality comprehensively
    }
  },
  resolve: {
    alias: {
      '@deep-agent/core': path.resolve(__dirname, '../core/src'),
    },
  },
})