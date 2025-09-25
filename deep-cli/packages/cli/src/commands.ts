// Command implementations for testability
import chalk from 'chalk'
import ora from 'ora'
import inquirer from 'inquirer'
import { DeepEngine, loadConfig } from '@deep-agent/core'
import type { DeepEvent } from '@deep-agent/core'

// Helper function to handle chat events
export async function handleChatEvent(event: DeepEvent, spinner: any): Promise<void> {
  switch (event.type) {
    case 'turn_start':
      spinner.text = 'Processing your message...'
      break

    case 'response_start':
      spinner.text = 'Generating response...'
      break

    case 'tool_call':
      spinner.text = `Calling tool: ${event.data.name}...`
      break

    case 'tool_result':
      spinner.text = 'Processing tool result...'
      break

    case 'reasoning_summary':
      spinner.text = 'Reasoning...'
      break

    case 'turn_complete':
      spinner.succeed('Response complete')
      break

    case 'error':
      spinner.fail(`Error: ${event.data.error}`)
      break
  }
}

export interface ChatOptions {
  conversation?: string
  model?: string
  verbosity?: string
  reasoning?: string
}

export async function chatCommand(options: ChatOptions): Promise<void> {
  const config = loadConfig()

  // Override config with command options
  if (options.model) config.model = options.model
  if (options.verbosity) config.verbosity = options.verbosity
  if (options.reasoning) config.reasoningEffort = options.reasoning

  const engine = new DeepEngine(config)

  // Health check
  console.log(chalk.blue('🤖 Initializing Deep agent...'))
  const health = await engine.healthCheck()
  if (health.status === 'error') {
    console.error(chalk.red(`❌ Health check failed: ${health.message}`))
    process.exit(1)
  }

  console.log(chalk.green('✅ Deep agent initialized successfully!'))
  console.log(chalk.gray('Type "exit" or "quit" to end the session.\n'))

  let conversationId = options.conversation
  let lastResponseId: string | undefined

  while (true) {
    const { input } = await inquirer.prompt([
      {
        type: 'input',
        name: 'input',
        message: chalk.cyan('You:'),
      },
    ])

    if (input.toLowerCase() === 'exit' || input.toLowerCase() === 'quit') {
      console.log(chalk.yellow('👋 Goodbye!'))
      break
    }

    if (!input.trim()) continue

    const spinner = ora('Deep is thinking...').start()
    let responseText = ''

    try {
      for await (const event of engine.processMessage(input, conversationId)) {
        await handleChatEvent(event, spinner)

        if (event.type === 'content_delta') {
          responseText += event.data.text
        }

        if (event.type === 'turn_complete') {
          lastResponseId = event.data.responseId
          // Keep conversationId consistent; only generate new one if none exists
          if (!conversationId) {
            conversationId = lastResponseId
          }
        }
      }

      if (responseText) {
        console.log(chalk.green('\nDeep:'), responseText)
      }

    } catch (error) {
      spinner.fail(chalk.red('Error occurred'))
      console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'))
    }

    console.log() // Empty line for spacing
  }
}

export interface AskOptions {
  conversation?: string
  model?: string
  verbosity?: string
  reasoning?: string
  json?: boolean
}

export async function askCommand(message: string, options: AskOptions): Promise<void> {
  const config = loadConfig()

  // Override config with command options
  if (options.model) config.model = options.model
  if (options.verbosity) config.verbosity = options.verbosity
  if (options.reasoning) config.reasoningEffort = options.reasoning

  const engine = new DeepEngine(config)

  const spinner = ora('Processing...').start()
  let responseText = ''
  let usage: any = null

  for await (const event of engine.processMessage(message, options.conversation)) {
    if (event.type === 'content_delta') {
      responseText += event.data.text
    }

    if (event.type === 'turn_complete') {
      usage = event.data.usage
      spinner.succeed('Complete')
    }

    if (event.type === 'error') {
      spinner.fail(event.data.error)
      process.exit(1)
    }
  }

  if (options.json) {
    console.log(JSON.stringify({
      response: responseText,
      usage,
      model: config.model,
    }, null, 2))
  } else {
    console.log(responseText)
  }
}

export async function listCommand(): Promise<void> {
  const config = loadConfig()
  const engine = new DeepEngine(config)

  const conversations = await engine.listConversations()

  if (conversations.length === 0) {
    console.log(chalk.gray('No conversations found.'))
    return
  }

  console.log(chalk.blue(`Found ${conversations.length} conversation(s):\n`))

  conversations.forEach((conv: any, index: number) => {
    console.log(`${index + 1}. ${chalk.cyan(conv.id)}`)
    console.log(`   Created: ${chalk.gray(conv.createdAt.toLocaleString())}`)
    console.log(`   Updated: ${chalk.gray(conv.updatedAt.toLocaleString())}`)
    console.log(`   Messages: ${chalk.yellow(conv.messages.length)}`)
    console.log()
  })
}

export async function clearCommand(conversationId?: string): Promise<void> {
  const config = loadConfig()
  const engine = new DeepEngine(config)

  if (conversationId) {
    await engine.clearConversation(conversationId)
    console.log(chalk.green(`✅ Cleared conversation: ${conversationId}`))
  } else {
    const { confirmAll } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmAll',
        message: 'Are you sure you want to clear ALL conversations?',
        default: false,
      },
    ])

    if (confirmAll) {
      const conversations = await engine.listConversations()
      for (const conv of conversations) {
        await engine.clearConversation(conv.id)
      }
      console.log(chalk.green(`✅ Cleared ${conversations.length} conversation(s)`))
    } else {
      console.log(chalk.yellow('Operation cancelled.'))
    }
  }
}

export function configCommand(): void {
  const config = loadConfig()

  console.log(chalk.blue('Deep Agent Configuration:\n'))
  console.log(`Model: ${chalk.cyan(config.model)}`)
  console.log(`Verbosity: ${chalk.cyan(config.verbosity)}`)
  console.log(`Reasoning Effort: ${chalk.cyan(config.reasoningEffort)}`)
  console.log(`Streaming: ${chalk.cyan(config.stream ? 'enabled' : 'disabled')}`)
  console.log(`Store Conversations: ${chalk.cyan(config.store ? 'enabled' : 'disabled')}`)
  console.log(`Debug Logging: ${chalk.cyan(config.logPaths ? 'enabled' : 'disabled')}`)

  if (config.baseUrl) {
    console.log(`Base URL: ${chalk.cyan(config.baseUrl)}`)
  }

  if (config.allowedTools.length > 0) {
    console.log(`Allowed Tools: ${chalk.cyan(config.allowedTools.join(', '))}`)
  }
}