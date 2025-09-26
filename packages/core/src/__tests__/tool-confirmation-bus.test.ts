// Test suite for Tool Confirmation Bus - Sprint 2 Enhanced Tool System
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { ToolConfirmationBus } from '@deep-agent/core'
import type { ToolConfirmation, ToolImpactAnalysis } from '@deep-agent/core'

describe('ToolConfirmationBus', () => {
  let confirmationBus: ToolConfirmationBus
  const defaultTimeout = 1000 // 1 second for tests

  const createMockImpactAnalysis = (): ToolImpactAnalysis => ({
    filesAffected: ['/test/file.txt'],
    operationType: 'read',
    reversible: true,
    dataLossRisk: 'none',
    systemImpact: 'none',
    estimatedChangeScope: 1
  })

  const createMockToolConfirmation = (
    riskLevel: 'low' | 'medium' | 'high' = 'low',
    reversible: boolean = true
  ): ToolConfirmation => ({
    toolName: 'test_tool',
    riskLevel,
    affectedPaths: ['/test/file.txt'],
    description: 'Test tool confirmation',
    requiresApproval: riskLevel !== 'low' || !reversible,
    impact: createMockImpactAnalysis(),
    reversible
  })

  beforeEach(() => {
    confirmationBus = new ToolConfirmationBus(defaultTimeout)
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  describe('Basic Functionality', () => {
    it('should create confirmation bus with default timeout', () => {
      const bus = new ToolConfirmationBus()
      expect(bus).toBeDefined()
    })

    it('should create confirmation bus with custom timeout', () => {
      const customTimeout = 5000
      const bus = new ToolConfirmationBus(customTimeout)
      expect(bus).toBeDefined()
    })

    it('should start with no pending requests', () => {
      expect(confirmationBus.getPendingRequests()).toHaveLength(0)
    })
  })

  describe('Request Approval', () => {
    it('should request approval and resolve when approved', async () => {
      const confirmation = createMockToolConfirmation()

      // Set up event listener to auto-approve
      confirmationBus.on('confirmation_request', (request) => {
        setTimeout(() => {
          confirmationBus.approveRequest(request.id, 'Approved for testing')
        }, 10)
      })

      const result = await confirmationBus.requestApproval(confirmation, 500)
      expect(result).toBe(true)
    })

    it('should request approval and resolve when denied', async () => {
      const confirmation = createMockToolConfirmation()

      // Set up event listener to auto-deny
      confirmationBus.on('confirmation_request', (request) => {
        setTimeout(() => {
          confirmationBus.denyRequest(request.id, 'Denied for testing')
        }, 10)
      })

      const result = await confirmationBus.requestApproval(confirmation, 500)
      expect(result).toBe(false)
    })

    it('should timeout and return false by default', async () => {
      const confirmation = createMockToolConfirmation()

      const startTime = Date.now()
      const result = await confirmationBus.requestApproval(confirmation, 100)
      const endTime = Date.now()

      expect(result).toBe(false)
      expect(endTime - startTime).toBeGreaterThanOrEqual(100)
    })

    it('should emit confirmation_request event', async () => {
      const confirmation = createMockToolConfirmation()

      const eventPromise = new Promise<void>((resolve) => {
        confirmationBus.on('confirmation_request', (request) => {
          expect(request.id).toBeDefined()
          expect(request.toolCall).toEqual(confirmation)
          expect(request.timeoutMs).toBe(500)
          expect(request.requestTime).toBeInstanceOf(Date)
          resolve()
        })
      })

      confirmationBus.requestApproval(confirmation, 500)
      await eventPromise
    })
  })

  describe('Request Management', () => {
    it('should track pending requests', async () => {
      const confirmation = createMockToolConfirmation()

      const approvalPromise = confirmationBus.requestApproval(confirmation, 500)

      expect(confirmationBus.getPendingRequests()).toHaveLength(1)

      // Cancel to prevent timeout
      const pendingRequest = confirmationBus.getPendingRequests()[0]
      confirmationBus.cancelRequest(pendingRequest.id)

      await approvalPromise
    })

    it('should remove request after approval', async () => {
      const confirmation = createMockToolConfirmation()

      confirmationBus.on('confirmation_request', (request) => {
        setTimeout(() => {
          confirmationBus.approveRequest(request.id)
        }, 10)
      })

      await confirmationBus.requestApproval(confirmation, 500)

      expect(confirmationBus.getPendingRequests()).toHaveLength(0)
    })

    it('should remove request after denial', async () => {
      const confirmation = createMockToolConfirmation()

      confirmationBus.on('confirmation_request', (request) => {
        setTimeout(() => {
          confirmationBus.denyRequest(request.id)
        }, 10)
      })

      await confirmationBus.requestApproval(confirmation, 500)

      expect(confirmationBus.getPendingRequests()).toHaveLength(0)
    })

    it('should handle cancellation of requests', async () => {
      const confirmation = createMockToolConfirmation()

      const approvalPromise = confirmationBus.requestApproval(confirmation, 500)
      const pendingRequest = confirmationBus.getPendingRequests()[0]

      const cancelled = confirmationBus.cancelRequest(pendingRequest.id)
      expect(cancelled).toBe(true)

      const result = await approvalPromise
      expect(result).toBe(false)
      expect(confirmationBus.getPendingRequests()).toHaveLength(0)
    })

    it('should return false when cancelling non-existent request', () => {
      const result = confirmationBus.cancelRequest('non-existent-id')
      expect(result).toBe(false)
    })
  })

  describe('Batch Operations', () => {
    it('should handle batch approval requests', async () => {
      const confirmations = [
        createMockToolConfirmation('low'),
        createMockToolConfirmation('medium'),
        createMockToolConfirmation('high')
      ]

      // Auto-approve all requests
      confirmationBus.on('confirmation_request', (request) => {
        setTimeout(() => {
          confirmationBus.approveRequest(request.id)
        }, 10)
      })

      const results = await confirmationBus.requestBatchApproval(confirmations, 500)

      expect(results).toHaveLength(3)
      expect(results.every(result => result === true)).toBe(true)
    })

    it('should handle mixed batch results', async () => {
      const confirmations = [
        createMockToolConfirmation('low'),
        createMockToolConfirmation('medium'),
        createMockToolConfirmation('high')
      ]

      let requestCount = 0
      confirmationBus.on('confirmation_request', (request) => {
        setTimeout(() => {
          // Approve first, deny others
          if (requestCount === 0) {
            confirmationBus.approveRequest(request.id)
          } else {
            confirmationBus.denyRequest(request.id)
          }
          requestCount++
        }, 10)
      })

      const results = await confirmationBus.requestBatchApproval(confirmations, 500)

      expect(results).toHaveLength(3)
      expect(results[0]).toBe(true)
      expect(results[1]).toBe(false)
      expect(results[2]).toBe(false)
    })
  })

  describe('Auto-approval Logic', () => {
    it('should auto-approve low-risk reversible operations', () => {
      const confirmation = createMockToolConfirmation('low', true)
      confirmation.impact.dataLossRisk = 'none'
      confirmation.impact.systemImpact = 'none'

      const shouldApprove = confirmationBus.shouldAutoApprove(confirmation)
      expect(shouldApprove).toBe(true)
    })

    it('should not auto-approve high-risk operations', () => {
      const confirmation = createMockToolConfirmation('high', true)

      const shouldApprove = confirmationBus.shouldAutoApprove(confirmation)
      expect(shouldApprove).toBe(false)
    })

    it('should not auto-approve irreversible operations', () => {
      const confirmation = createMockToolConfirmation('low', false)

      const shouldApprove = confirmationBus.shouldAutoApprove(confirmation)
      expect(shouldApprove).toBe(false)
    })

    it('should not auto-approve operations with data loss risk', () => {
      const confirmation = createMockToolConfirmation('low', true)
      confirmation.impact.dataLossRisk = 'high'

      const shouldApprove = confirmationBus.shouldAutoApprove(confirmation)
      expect(shouldApprove).toBe(false)
    })

    it('should not auto-approve operations with system impact', () => {
      const confirmation = createMockToolConfirmation('low', true)
      confirmation.impact.systemImpact = 'global'

      const shouldApprove = confirmationBus.shouldAutoApprove(confirmation)
      expect(shouldApprove).toBe(false)
    })
  })

  describe('Statistics', () => {
    it('should return initial statistics', () => {
      const stats = confirmationBus.getStatistics()

      expect(stats.totalRequests).toBe(0)
      expect(stats.pendingRequests).toBe(0)
      expect(stats.averageResponseTime).toBe(0)
    })

    it('should track pending requests in statistics', async () => {
      const confirmation = createMockToolConfirmation()

      const approvalPromise = confirmationBus.requestApproval(confirmation, 500)
      const stats = confirmationBus.getStatistics()

      expect(stats.pendingRequests).toBe(1)

      // Clean up
      const pendingRequest = confirmationBus.getPendingRequests()[0]
      confirmationBus.cancelRequest(pendingRequest.id)
      await approvalPromise
    })
  })

  describe('Cleanup', () => {
    it('should clean up expired requests', async () => {
      const confirmation = createMockToolConfirmation()

      // Start a request but don't handle it
      const approvalPromise = confirmationBus.requestApproval(confirmation, 50)

      // Wait for it to expire
      await approvalPromise

      // Should be cleaned up automatically
      expect(confirmationBus.getPendingRequests()).toHaveLength(0)
    })

    it('should manually clean up expired requests', async () => {
      const confirmation = createMockToolConfirmation()

      const approvalPromise = confirmationBus.requestApproval(confirmation, 1000)

      expect(confirmationBus.getPendingRequests()).toHaveLength(1)

      // Manually clean up
      confirmationBus.cleanup()

      // Should still be pending since it hasn't expired
      expect(confirmationBus.getPendingRequests()).toHaveLength(1)

      // Cancel to clean up
      const pendingRequest = confirmationBus.getPendingRequests()[0]
      confirmationBus.cancelRequest(pendingRequest.id)
      await approvalPromise
    })
  })

  describe('Event Handling', () => {
    it('should emit request_timeout event on timeout', async () => {
      const confirmation = createMockToolConfirmation()

      const timeoutPromise = new Promise<void>((resolve) => {
        confirmationBus.on('request_timeout', (requestId) => {
          expect(requestId).toBeDefined()
          resolve()
        })
      })

      confirmationBus.requestApproval(confirmation, 50)
      await timeoutPromise
    })

    it('should emit confirmation_response event on approval', async () => {
      const confirmation = createMockToolConfirmation()

      const responsePromise = new Promise<void>((resolve) => {
        confirmationBus.on('confirmation_response', (requestId, approved, reason) => {
          expect(requestId).toBeDefined()
          expect(approved).toBe(true)
          expect(reason).toBe('Test approval')
          resolve()
        })
      })

      confirmationBus.on('confirmation_request', (request) => {
        setTimeout(() => {
          confirmationBus.approveRequest(request.id, 'Test approval')
        }, 10)
      })

      confirmationBus.requestApproval(confirmation, 500)
      await responsePromise
    })

    it('should emit confirmation_response event on denial', async () => {
      const confirmation = createMockToolConfirmation()

      const responsePromise = new Promise<void>((resolve) => {
        confirmationBus.on('confirmation_response', (requestId, approved, reason) => {
          expect(requestId).toBeDefined()
          expect(approved).toBe(false)
          expect(reason).toBe('Test denial')
          resolve()
        })
      })

      confirmationBus.on('confirmation_request', (request) => {
        setTimeout(() => {
          confirmationBus.denyRequest(request.id, 'Test denial')
        }, 10)
      })

      confirmationBus.requestApproval(confirmation, 500)
      await responsePromise
    })
  })
})