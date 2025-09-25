#!/usr/bin/env node

// Deep CLI - Command-line interface for the Deep AI agent
import { Command } from 'commander'
import { config as dotenvConfig } from 'dotenv'
import {
  chatCommand,
  askCommand,
  listCommand,
  clearCommand,
  configCommand
} from './commands.js'

// Load environment variables
dotenvConfig()

const program = new Command()

program
  .name('deep')
  .description('Deep - AI agent using OpenAI Responses API exclusively')
  .version('1.0.0')

// Interactive chat command
program
  .command('chat')
  .description('Start an interactive chat session with Deep')
  .option('-c, --conversation <id>', 'Resume a specific conversation')
  .option('-m, --model <model>', 'Override the default model')
  .option('-v, --verbosity <level>', 'Set verbosity level (low|medium|high)')
  .option('--reasoning <effort>', 'Set reasoning effort (minimal|low|medium|high)')
  .action(async (options) => {
    try {
      await chatCommand(options)
    } catch (error) {
      console.error('Failed to start chat:', error instanceof Error ? error.message : error)
      process.exit(1)
    }
  })

// Single message command
program
  .command('ask <message>')
  .description('Ask Deep a single question')
  .option('-c, --conversation <id>', 'Use a specific conversation context')
  .option('-m, --model <model>', 'Override the default model')
  .option('-v, --verbosity <level>', 'Set verbosity level (low|medium|high)')
  .option('--reasoning <effort>', 'Set reasoning effort (minimal|low|medium|high)')
  .option('--json', 'Output response as JSON')
  .action(async (message, options) => {
    try {
      await askCommand(message, options)
    } catch (error) {
      console.error('Failed to process message:', error instanceof Error ? error.message : error)
      process.exit(1)
    }
  })

// List conversations command
program
  .command('list')
  .description('List all conversations')
  .action(async () => {
    try {
      await listCommand()
    } catch (error) {
      console.error('Failed to list conversations:', error instanceof Error ? error.message : error)
      process.exit(1)
    }
  })

// Clear conversation command
program
  .command('clear [conversation-id]')
  .description('Clear a specific conversation or all conversations')
  .action(async (conversationId) => {
    try {
      await clearCommand(conversationId)
    } catch (error) {
      console.error('Failed to clear conversation(s):', error instanceof Error ? error.message : error)
      process.exit(1)
    }
  })

// Configuration command
program
  .command('config')
  .description('Show current configuration')
  .action(() => {
    try {
      configCommand()
    } catch (error) {
      console.error('Failed to load configuration:', error instanceof Error ? error.message : error)
      process.exit(1)
    }
  })

program.parse()