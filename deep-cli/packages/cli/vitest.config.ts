// Vitest configuration for @deep-agent/cli package
import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        '**/*.config.*',
        '**/*.test.*',
        '**/*.spec.*'
      ],
      thresholds: {
        statements: 70,
        branches: 70,
        functions: 70,
        lines: 70
      }
    },
    alias: {
      '@deep-agent/core': resolve(__dirname, '../core/src/index.ts')
    }
  },
  resolve: {
    alias: {
      '@deep-agent/core': resolve(__dirname, '../core/src/index.ts')
    }
  }
})