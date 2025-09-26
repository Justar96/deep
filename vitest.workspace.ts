import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  // Core package tests
  {
    test: {
      name: 'core',
      root: './packages/core',
      environment: 'node',
      globals: true,
      include: ['src/__tests__/**/*.test.ts'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        reportsDirectory: './coverage',
        exclude: [
          'node_modules/**',
          'dist/**',
          '**/*.config.*',
          '**/*.test.*',
          '**/*.spec.*'
        ],
        thresholds: {
          statements: 90,
          branches: 85,
          functions: 90,
          lines: 90
        }
      }
    }
  },
  // CLI package tests
  {
    test: {
      name: 'cli',
      root: './packages/cli',
      environment: 'node',
      globals: true,
      include: ['src/__tests__/**/*.test.ts'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        reportsDirectory: './coverage',
        exclude: [
          'node_modules/**',
          'dist/**',
          '**/*.config.*',
          '**/*.test.*',
          '**/*.spec.*'
        ],
        thresholds: {
          statements: 80,
          branches: 75,
          functions: 80,
          lines: 80
        }
      }
    }
  }
])