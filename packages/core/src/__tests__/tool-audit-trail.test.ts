// Test suite for Tool Audit Trail - Sprint 2 Enhanced Tool System
import { describe, it, expect, beforeEach } from 'vitest'
import { ToolAuditTrail } from '@deep-agent/core'
import type { ToolAuditEntry, ToolImpactAnalysis } from '@deep-agent/core'

describe('ToolAuditTrail', () => {
  let auditTrail: ToolAuditTrail

  const createMockImpactAnalysis = (
    operationType: 'read' | 'write' | 'delete' | 'execute' | 'network' = 'read',
    dataLossRisk: 'none' | 'low' | 'high' = 'none'
  ): ToolImpactAnalysis => ({
    filesAffected: ['/test/file.txt'],
    operationType,
    reversible: operationType === 'read',
    dataLossRisk,
    systemImpact: dataLossRisk === 'high' ? 'global' : 'none',
    estimatedChangeScope: 1
  })

  beforeEach(() => {
    auditTrail = new ToolAuditTrail({
      maxLogEntries: 100,
      persistenceEnabled: false
    })
  })

  describe('Basic Functionality', () => {
    it('should create audit trail instance', () => {
      expect(auditTrail).toBeDefined()
      expect(auditTrail).toBeInstanceOf(ToolAuditTrail)
    })

    it('should create audit trail with custom options', () => {
      const trail = new ToolAuditTrail({
        maxLogEntries: 500,
        persistenceEnabled: true,
        logFilePath: '/tmp/audit.log'
      })
      expect(trail).toBeDefined()
    })

    it('should start with empty audit log', () => {
      const entries = auditTrail.getAuditTrail()
      expect(entries).toHaveLength(0)
    })
  })

  describe('Logging Tool Executions', () => {
    it('should log successful tool execution', async () => {
      const entry = await auditTrail.logToolExecution(
        'test_tool',
        'call-123',
        'conv-456',
        '{"param": "value"}',
        'success result',
        150,
        true,
        undefined,
        'low',
        true,
        'user',
        createMockImpactAnalysis()
      )

      expect(entry.id).toBeDefined()
      expect(entry.timestamp).toBeInstanceOf(Date)
      expect(entry.toolName).toBe('test_tool')
      expect(entry.callId).toBe('call-123')
      expect(entry.conversationId).toBe('conv-456')
      expect(entry.input).toBe('{"param": "value"}')
      expect(entry.output).toBe('success result')
      expect(entry.executionTime).toBe(150)
      expect(entry.success).toBe(true)
      expect(entry.error).toBeUndefined()
      expect(entry.riskLevel).toBe('low')
      expect(entry.approved).toBe(true)
      expect(entry.approvalSource).toBe('user')
    })

    it('should log failed tool execution', async () => {
      const entry = await auditTrail.logToolExecution(
        'failing_tool',
        'call-789',
        'conv-456',
        '{"param": "value"}',
        '',
        75,
        false,
        'Tool execution failed',
        'high',
        true,
        'auto'
      )

      expect(entry.success).toBe(false)
      expect(entry.error).toBe('Tool execution failed')
      expect(entry.output).toBe('')
      expect(entry.executionTime).toBe(75)
      expect(entry.riskLevel).toBe('high')
    })

    it('should include impact analysis in log entry', async () => {
      const impact = createMockImpactAnalysis('write', 'low')

      const entry = await auditTrail.logToolExecution(
        'write_tool',
        'call-456',
        'conv-789',
        '{"file": "test.txt"}',
        'written',
        200,
        true,
        undefined,
        'medium',
        true,
        'policy',
        impact
      )

      expect(entry.impactAnalysis).toEqual(impact)
      expect(entry.impactAnalysis.operationType).toBe('write')
      expect(entry.impactAnalysis.dataLossRisk).toBe('low')
    })

    it('should create default impact analysis if none provided', async () => {
      const entry = await auditTrail.logToolExecution(
        'simple_tool',
        'call-123',
        'conv-456',
        '{}',
        'result',
        50,
        true
      )

      expect(entry.impactAnalysis).toBeDefined()
      expect(entry.impactAnalysis.operationType).toBe('read')
      expect(entry.impactAnalysis.dataLossRisk).toBe('none')
      expect(entry.impactAnalysis.systemImpact).toBe('none')
    })
  })

  describe('Audit Trail Retrieval', () => {
    beforeEach(async () => {
      // Add some test entries
      await auditTrail.logToolExecution('tool1', 'call1', 'conv1', '{}', 'result1', 100, true, undefined, 'low')
      await auditTrail.logToolExecution('tool2', 'call2', 'conv1', '{}', 'result2', 150, true, undefined, 'medium')
      await auditTrail.logToolExecution('tool3', 'call3', 'conv2', '{}', 'result3', 200, false, 'error', 'high')
    })

    it('should retrieve all audit entries', () => {
      const entries = auditTrail.getAuditTrail()
      expect(entries).toHaveLength(3)
      // Should be in reverse chronological order (most recent first)
      expect(entries[0].toolName).toBe('tool3')
      expect(entries[1].toolName).toBe('tool2')
      expect(entries[2].toolName).toBe('tool1')
    })

    it('should retrieve limited audit entries', () => {
      const entries = auditTrail.getAuditTrail(2)
      expect(entries).toHaveLength(2)
      expect(entries[0].toolName).toBe('tool3')
      expect(entries[1].toolName).toBe('tool2')
    })

    it('should retrieve entries for specific conversation', () => {
      const entries = auditTrail.getAuditTrailForConversation('conv1')
      expect(entries).toHaveLength(2)
      expect(entries.every(entry => entry.conversationId === 'conv1')).toBe(true)
    })

    it('should retrieve entries for specific tool', () => {
      const entries = auditTrail.getAuditTrailForTool('tool2')
      expect(entries).toHaveLength(1)
      expect(entries[0].toolName).toBe('tool2')
    })

    it('should retrieve failed executions', () => {
      const entries = auditTrail.getFailedExecutions()
      expect(entries).toHaveLength(1)
      expect(entries[0].success).toBe(false)
      expect(entries[0].toolName).toBe('tool3')
    })

    it('should retrieve high-risk executions', () => {
      const entries = auditTrail.getHighRiskExecutions()
      expect(entries).toHaveLength(1)
      expect(entries[0].riskLevel).toBe('high')
      expect(entries[0].toolName).toBe('tool3')
    })

    it('should retrieve unauthorized attempts', async () => {
      // Add an unauthorized attempt (high risk, not approved)
      await auditTrail.logToolExecution(
        'dangerous_tool',
        'call4',
        'conv3',
        '{}',
        '',
        0,
        false,
        'Unauthorized',
        'high',
        false,
        'user'
      )

      const entries = auditTrail.getUnauthorizedAttempts()
      expect(entries).toHaveLength(1)
      expect(entries[0].approved).toBe(false)
      expect(entries[0].riskLevel).toBe('high')
    })
  })

  describe('Execution Statistics', () => {
    beforeEach(async () => {
      await auditTrail.logToolExecution('tool1', 'call1', 'conv1', '{}', 'result', 100, true, undefined, 'low', true, 'auto')
      await auditTrail.logToolExecution('tool2', 'call2', 'conv1', '{}', 'result', 150, true, undefined, 'medium', true, 'user')
      await auditTrail.logToolExecution('tool3', 'call3', 'conv2', '{}', '', 200, false, 'error', 'high', false, 'policy')
      await auditTrail.logToolExecution('tool1', 'call4', 'conv2', '{}', 'result', 120, true, undefined, 'low', true, 'auto')
    })

    it('should calculate execution statistics', () => {
      const stats = auditTrail.getExecutionStatistics()

      expect(stats.totalExecutions).toBe(4)
      expect(stats.successfulExecutions).toBe(3)
      expect(stats.failedExecutions).toBe(1)
      expect(stats.averageExecutionTime).toBe((100 + 150 + 200 + 120) / 4)

      expect(stats.riskDistribution.low).toBe(2)
      expect(stats.riskDistribution.medium).toBe(1)
      expect(stats.riskDistribution.high).toBe(1)

      expect(stats.approvalSources.auto).toBe(2)
      expect(stats.approvalSources.user).toBe(1)
      expect(stats.approvalSources.policy).toBe(1)

      expect(stats.topTools).toHaveLength(3)
      expect(stats.topTools[0].toolName).toBe('tool1')
      expect(stats.topTools[0].count).toBe(2)
    })

    it('should handle empty audit log statistics', () => {
      const emptyTrail = new ToolAuditTrail()
      const stats = emptyTrail.getExecutionStatistics()

      expect(stats.totalExecutions).toBe(0)
      expect(stats.successfulExecutions).toBe(0)
      expect(stats.failedExecutions).toBe(0)
      expect(stats.averageExecutionTime).toBe(0)
    })
  })

  describe('Security Report Generation', () => {
    beforeEach(async () => {
      // Add various test scenarios
      await auditTrail.logToolExecution('safe_tool', 'call1', 'conv1', '{}', 'ok', 100, true, undefined, 'low')
      await auditTrail.logToolExecution('risky_tool', 'call2', 'conv1', '{}', 'ok', 150, true, undefined, 'high')
      await auditTrail.logToolExecution('failing_tool', 'call3', 'conv1', '{}', '', 200, false, 'error', 'medium')
      await auditTrail.logToolExecution('unauthorized_tool', 'call4', 'conv1', '{}', '', 0, false, 'denied', 'high', false)
    })

    it('should generate security report', () => {
      const report = auditTrail.generateSecurityReport()

      expect(report.summary).toContain('Total Executions: 4')
      expect(report.summary).toContain('Success Rate: 50.0%')
      expect(report.summary).toContain('High-Risk Operations: 2')
      expect(report.summary).toContain('Unauthorized Attempts: 1')
      expect(report.riskScore).toBeGreaterThan(0)
      expect(report.riskScore).toBeLessThanOrEqual(100)
    })

    it('should include alerts for high failure rate', () => {
      const report = auditTrail.generateSecurityReport()

      expect(report.alerts.some(alert => alert.includes('failure rate'))).toBe(true)
    })

    it('should include alerts for high-risk operations', () => {
      const report = auditTrail.generateSecurityReport()

      expect(report.alerts.some(alert => alert.includes('high-risk'))).toBe(true)
    })

    it('should include alerts for unauthorized attempts', () => {
      const report = auditTrail.generateSecurityReport()

      expect(report.alerts.some(alert => alert.includes('unauthorized'))).toBe(true)
    })

    it('should include recommendations', () => {
      const report = auditTrail.generateSecurityReport()

      expect(report.recommendations.length).toBeGreaterThan(0)
      expect(report.recommendations.some(rec => rec.includes('Review'))).toBe(true)
    })

    it('should calculate appropriate risk score', () => {
      const report = auditTrail.generateSecurityReport()

      // With 50% failure rate, high-risk ops, and unauthorized attempts
      expect(report.riskScore).toBeGreaterThan(30)
    })
  })

  describe('Search Functionality', () => {
    beforeEach(async () => {
      const baseDate = new Date('2024-01-01T00:00:00Z')

      await auditTrail.logToolExecution('tool1', 'call1', 'conv1', '{}', 'result', 100, true, undefined, 'low', true, 'user')
      await auditTrail.logToolExecution('tool2', 'call2', 'conv2', '{}', 'result', 150, true, undefined, 'high', false, 'auto')
      await auditTrail.logToolExecution('tool1', 'call3', 'conv1', '{}', '', 200, false, 'error', 'medium', true, 'policy')
    })

    it('should search by tool name', () => {
      const results = auditTrail.searchAuditLog({ toolName: 'tool1' })
      expect(results).toHaveLength(2)
      expect(results.every(entry => entry.toolName === 'tool1')).toBe(true)
    })

    it('should search by conversation ID', () => {
      const results = auditTrail.searchAuditLog({ conversationId: 'conv1' })
      expect(results).toHaveLength(2)
      expect(results.every(entry => entry.conversationId === 'conv1')).toBe(true)
    })

    it('should search by success status', () => {
      const results = auditTrail.searchAuditLog({ success: false })
      expect(results).toHaveLength(1)
      expect(results[0].success).toBe(false)
    })

    it('should search by risk level', () => {
      const results = auditTrail.searchAuditLog({ riskLevel: 'high' })
      expect(results).toHaveLength(1)
      expect(results[0].riskLevel).toBe('high')
    })

    it('should search by approval source', () => {
      const results = auditTrail.searchAuditLog({ approvalSource: 'user' })
      expect(results).toHaveLength(1)
      expect(results[0].approvalSource).toBe('user')
    })

    it('should combine multiple search criteria', () => {
      const results = auditTrail.searchAuditLog({
        conversationId: 'conv1',
        success: true
      })
      expect(results).toHaveLength(1)
      expect(results[0].conversationId).toBe('conv1')
      expect(results[0].success).toBe(true)
    })

    it('should limit search results', () => {
      const results = auditTrail.searchAuditLog({ toolName: 'tool1' }, 1)
      expect(results).toHaveLength(1)
    })
  })

  describe('Data Export', () => {
    beforeEach(async () => {
      await auditTrail.logToolExecution('tool1', 'call1', 'conv1', '{}', 'result', 100, true, undefined, 'low')
      await auditTrail.logToolExecution('tool2', 'call2', 'conv2', '{}', 'error', 150, false, 'Failed', 'high')
    })

    it('should export audit log as JSON', () => {
      const jsonExport = auditTrail.exportAuditLog('json')

      const parsed = JSON.parse(jsonExport)
      expect(Array.isArray(parsed)).toBe(true)
      expect(parsed).toHaveLength(2)
      expect(parsed[0].toolName).toBe('tool1')
    })

    it('should export audit log as CSV', () => {
      const csvExport = auditTrail.exportAuditLog('csv')

      const lines = csvExport.split('\n')
      expect(lines.length).toBeGreaterThan(2) // Header + 2 data rows
      expect(lines[0]).toContain('ID,Timestamp,Tool Name')
      expect(lines[1]).toContain('tool1')
      expect(lines[2]).toContain('tool2')
    })

    it('should default to JSON export', () => {
      const defaultExport = auditTrail.exportAuditLog()

      expect(() => JSON.parse(defaultExport)).not.toThrow()
    })
  })

  describe('Log Management', () => {
    it('should maintain maximum log entries', async () => {
      const smallTrail = new ToolAuditTrail({ maxLogEntries: 2 })

      await smallTrail.logToolExecution('tool1', 'call1', 'conv1', '{}', 'result', 100, true)
      await smallTrail.logToolExecution('tool2', 'call2', 'conv1', '{}', 'result', 100, true)
      await smallTrail.logToolExecution('tool3', 'call3', 'conv1', '{}', 'result', 100, true)

      const entries = smallTrail.getAuditTrail()
      expect(entries).toHaveLength(2)
      // Should keep the most recent entries
      expect(entries[0].toolName).toBe('tool3')
      expect(entries[1].toolName).toBe('tool2')
    })

    it('should clear audit log with confirmation', () => {
      const cleared = auditTrail.clearAuditLog('CLEAR_AUDIT_LOG_CONFIRMED')
      expect(cleared).toBe(true)

      const entries = auditTrail.getAuditTrail()
      expect(entries).toHaveLength(0)
    })

    it('should not clear audit log without proper confirmation', () => {
      const cleared = auditTrail.clearAuditLog('invalid_confirmation')
      expect(cleared).toBe(false)
    })

    it('should cleanup old entries', async () => {
      await auditTrail.logToolExecution('old_tool', 'call1', 'conv1', '{}', 'result', 100, true)

      const removedCount = auditTrail.cleanupOldEntries(0) // Remove all entries older than 0 days
      expect(removedCount).toBe(1)

      const entries = auditTrail.getAuditTrail()
      expect(entries).toHaveLength(0)
    })
  })
})