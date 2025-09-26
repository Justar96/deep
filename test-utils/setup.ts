// Test setup for Vitest
import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest'

// Global test setup
beforeAll(async () => {
  // Set test environment variables
  process.env.OPENAI_API_KEY = 'test-api-key'
  process.env.OPENAI_MODEL = 'gpt-5-mini'
  process.env.OPENAI_VERBOSITY = 'medium'
  process.env.OPENAI_REASONING_EFFORT = 'medium'
  process.env.NODE_ENV = 'test'
})

afterAll(async () => {
  // Cleanup
})

beforeEach(async () => {
  // Reset any global state before each test
})

afterEach(async () => {
  // Cleanup after each test
})