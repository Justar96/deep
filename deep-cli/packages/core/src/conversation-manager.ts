// Conversation Manager - handles conversation state persistence
import { v4 as uuidv4 } from 'uuid'
import type { IConversationManager, ConversationState } from './types.js'

export class MemoryConversationManager implements IConversationManager {
  private conversations = new Map<string, ConversationState>()
  private maxConversations = 1000 // Limit to prevent memory issues
  private maxMessagesPerConversation = 500

  async get(id: string): Promise<ConversationState | null> {
    return this.conversations.get(id) || null
  }

  async create(id?: string): Promise<ConversationState> {
    // Clean up old conversations if we're at the limit
    if (this.conversations.size >= this.maxConversations) {
      const oldest = Array.from(this.conversations.values())
        .sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime())[0]
      if (oldest) {
        this.conversations.delete(oldest.id)
      }
    }

    const conversationId = id || uuidv4()
    const state: ConversationState = {
      id: conversationId,
      messages: [],
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    this.conversations.set(conversationId, state)
    return state
  }

  async update(
    id: string,
    items: any[],
    responseId?: string
  ): Promise<void> {
    const conversation = this.conversations.get(id)
    if (!conversation) {
      throw new Error(`Conversation ${id} not found`)
    }

    // Add new items and trim if conversation gets too long
    conversation.messages.push(...items)
    if (conversation.messages.length > this.maxMessagesPerConversation) {
      // Keep the most recent messages, preserving conversation context
      const trimAmount = Math.floor(this.maxMessagesPerConversation * 0.1) // Remove 10%
      conversation.messages = conversation.messages.slice(trimAmount)
    }

    if (responseId) {
      conversation.lastResponseId = responseId
    }
    conversation.updatedAt = new Date()

    this.conversations.set(id, conversation)
  }

  async list(): Promise<ConversationState[]> {
    return Array.from(this.conversations.values()).sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
    )
  }

  async delete(id: string): Promise<void> {
    this.conversations.delete(id)
  }

  async clear(): Promise<void> {
    this.conversations.clear()
  }
}

// Future: FileConversationManager for persistent storage
export class FileConversationManager implements IConversationManager {
  private basePath: string

  constructor(basePath: string = './.deep-conversations') {
    this.basePath = basePath
  }

  async get(id: string): Promise<ConversationState | null> {
    // TODO: Implement file-based storage
    throw new Error('FileConversationManager not implemented yet')
  }

  async create(id?: string): Promise<ConversationState> {
    throw new Error('FileConversationManager not implemented yet')
  }

  async update(id: string, items: any[], responseId?: string): Promise<void> {
    throw new Error('FileConversationManager not implemented yet')
  }

  async list(): Promise<ConversationState[]> {
    throw new Error('FileConversationManager not implemented yet')
  }

  async delete(id: string): Promise<void> {
    throw new Error('FileConversationManager not implemented yet')
  }
}