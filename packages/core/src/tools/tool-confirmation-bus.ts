// Tool Confirmation Message Bus - handles async user approvals for tool execution
import { EventEmitter } from 'eventemitter3'
import { v4 as uuidv4 } from 'uuid'
import type {
  ToolConfirmation,
  ToolConfirmationRequest,
  DeepEvent
} from '../types/core-types.js'

export class ToolConfirmationBus extends EventEmitter<{
  'confirmation_request': (request: ToolConfirmationRequest) => void
  'confirmation_response': (requestId: string, approved: boolean, reason?: string) => void
  'request_timeout': (requestId: string) => void
}> {
  private pendingRequests: Map<string, ToolConfirmationRequest> = new Map()
  private defaultTimeoutMs: number = 30000 // 30 seconds

  constructor(defaultTimeoutMs?: number) {
    super()
    if (defaultTimeoutMs) {
      this.defaultTimeoutMs = defaultTimeoutMs
    }
  }

  async requestApproval(
    confirmation: ToolConfirmation,
    timeoutMs?: number
  ): Promise<boolean> {
    return new Promise((resolve) => {
      const requestId = uuidv4()
      const timeout = timeoutMs || this.defaultTimeoutMs

      const request: ToolConfirmationRequest = {
        id: requestId,
        toolCall: confirmation,
        requestTime: new Date(),
        timeoutMs: timeout,
        callback: (approved: boolean, reason?: string) => {
          this.pendingRequests.delete(requestId)
          resolve(approved)
        }
      }

      this.pendingRequests.set(requestId, request)

      // Emit confirmation request event
      this.emit('confirmation_request', request)

      // Set timeout
      setTimeout(() => {
        const pendingRequest = this.pendingRequests.get(requestId)
        if (pendingRequest) {
          this.pendingRequests.delete(requestId)
          this.emit('request_timeout', requestId)
          resolve(false) // Default to deny on timeout
        }
      }, timeout)
    })
  }

  approveRequest(requestId: string, reason?: string): boolean {
    const request = this.pendingRequests.get(requestId)
    if (request) {
      this.emit('confirmation_response', requestId, true, reason)
      request.callback(true, reason)
      return true
    }
    return false
  }

  denyRequest(requestId: string, reason?: string): boolean {
    const request = this.pendingRequests.get(requestId)
    if (request) {
      this.emit('confirmation_response', requestId, false, reason)
      request.callback(false, reason)
      return true
    }
    return false
  }

  getPendingRequests(): ToolConfirmationRequest[] {
    return Array.from(this.pendingRequests.values())
  }

  cancelRequest(requestId: string): boolean {
    const request = this.pendingRequests.get(requestId)
    if (request) {
      this.pendingRequests.delete(requestId)
      request.callback(false, 'Request cancelled')
      return true
    }
    return false
  }

  // Batch operations for multiple related tool calls
  async requestBatchApproval(
    confirmations: ToolConfirmation[],
    timeoutMs?: number
  ): Promise<boolean[]> {
    const promises = confirmations.map(confirmation =>
      this.requestApproval(confirmation, timeoutMs)
    )
    return Promise.all(promises)
  }

  // Auto-approval based on risk assessment
  shouldAutoApprove(confirmation: ToolConfirmation): boolean {
    // Only auto-approve low-risk, reversible operations
    return (
      confirmation.riskLevel === 'low' &&
      confirmation.reversible &&
      confirmation.impact.dataLossRisk === 'none' &&
      confirmation.impact.systemImpact === 'none'
    )
  }

  // Get confirmation request statistics
  getStatistics(): {
    totalRequests: number
    pendingRequests: number
    averageResponseTime: number
  } {
    return {
      totalRequests: this.listenerCount('confirmation_request'),
      pendingRequests: this.pendingRequests.size,
      averageResponseTime: 0 // Would need to track response times
    }
  }

  // Clean up expired requests
  cleanup(): void {
    const now = new Date()
    for (const [requestId, request] of this.pendingRequests.entries()) {
      const elapsedMs = now.getTime() - request.requestTime.getTime()
      if (elapsedMs > request.timeoutMs) {
        this.cancelRequest(requestId)
      }
    }
  }
}