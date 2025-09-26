// Tool Audit Trail - comprehensive logging and tracking of all tool executions
import { v4 as uuidv4 } from 'uuid'
import type {
  ToolAuditEntry,
  ToolImpactAnalysis,
  DeepEvent
} from '../types/core-types.js'

export class ToolAuditTrail {
  private auditLog: ToolAuditEntry[] = []
  private maxLogEntries: number = 10000
  private persistenceEnabled: boolean = false
  private logFilePath?: string

  constructor(options?: {
    maxLogEntries?: number
    persistenceEnabled?: boolean
    logFilePath?: string
  }) {
    if (options?.maxLogEntries) {
      this.maxLogEntries = options.maxLogEntries
    }
    if (options?.persistenceEnabled) {
      this.persistenceEnabled = options.persistenceEnabled
    }
    if (options?.logFilePath) {
      this.logFilePath = options.logFilePath
    }
  }

  async logToolExecution(
    toolName: string,
    callId: string,
    conversationId: string,
    input: string,
    output: string,
    executionTime: number,
    success: boolean,
    error?: string,
    riskLevel: 'low' | 'medium' | 'high' = 'low',
    approved: boolean = false,
    approvalSource: 'user' | 'auto' | 'policy' = 'auto',
    impactAnalysis?: ToolImpactAnalysis
  ): Promise<ToolAuditEntry> {
    const entry: ToolAuditEntry = {
      id: uuidv4(),
      timestamp: new Date(),
      toolName,
      callId,
      conversationId,
      input,
      output,
      executionTime,
      success,
      error,
      riskLevel,
      approved,
      approvalSource,
      impactAnalysis: impactAnalysis || this.createDefaultImpactAnalysis()
    }

    // Add to in-memory log
    this.auditLog.push(entry)

    // Maintain log size limit
    if (this.auditLog.length > this.maxLogEntries) {
      this.auditLog = this.auditLog.slice(-this.maxLogEntries)
    }

    // Persist to file if enabled
    if (this.persistenceEnabled && this.logFilePath) {
      await this.persistEntry(entry)
    }

    return entry
  }

  getAuditTrail(limit?: number): ToolAuditEntry[] {
    const entries = [...this.auditLog].reverse() // Most recent first
    return limit ? entries.slice(0, limit) : entries
  }

  getAuditTrailForConversation(conversationId: string, limit?: number): ToolAuditEntry[] {
    const entries = this.auditLog
      .filter(entry => entry.conversationId === conversationId)
      .reverse()
    return limit ? entries.slice(0, limit) : entries
  }

  getAuditTrailForTool(toolName: string, limit?: number): ToolAuditEntry[] {
    const entries = this.auditLog
      .filter(entry => entry.toolName === toolName)
      .reverse()
    return limit ? entries.slice(0, limit) : entries
  }

  getFailedExecutions(limit?: number): ToolAuditEntry[] {
    const entries = this.auditLog
      .filter(entry => !entry.success)
      .reverse()
    return limit ? entries.slice(0, limit) : entries
  }

  getHighRiskExecutions(limit?: number): ToolAuditEntry[] {
    const entries = this.auditLog
      .filter(entry => entry.riskLevel === 'high')
      .reverse()
    return limit ? entries.slice(0, limit) : entries
  }

  getUnauthorizedAttempts(limit?: number): ToolAuditEntry[] {
    const entries = this.auditLog
      .filter(entry => !entry.approved && entry.riskLevel !== 'low')
      .reverse()
    return limit ? entries.slice(0, limit) : entries
  }

  getExecutionStatistics(): {
    totalExecutions: number
    successfulExecutions: number
    failedExecutions: number
    averageExecutionTime: number
    riskDistribution: { low: number; medium: number; high: number }
    approvalSources: { user: number; auto: number; policy: number }
    topTools: Array<{ toolName: string; count: number }>
  } {
    const total = this.auditLog.length
    const successful = this.auditLog.filter(entry => entry.success).length
    const failed = total - successful
    const avgExecutionTime = total > 0
      ? this.auditLog.reduce((sum, entry) => sum + entry.executionTime, 0) / total
      : 0

    const riskDistribution = {
      low: this.auditLog.filter(entry => entry.riskLevel === 'low').length,
      medium: this.auditLog.filter(entry => entry.riskLevel === 'medium').length,
      high: this.auditLog.filter(entry => entry.riskLevel === 'high').length
    }

    const approvalSources = {
      user: this.auditLog.filter(entry => entry.approvalSource === 'user').length,
      auto: this.auditLog.filter(entry => entry.approvalSource === 'auto').length,
      policy: this.auditLog.filter(entry => entry.approvalSource === 'policy').length
    }

    // Calculate top tools
    const toolCounts = new Map<string, number>()
    this.auditLog.forEach(entry => {
      toolCounts.set(entry.toolName, (toolCounts.get(entry.toolName) || 0) + 1)
    })

    const topTools = Array.from(toolCounts.entries())
      .map(([toolName, count]) => ({ toolName, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    return {
      totalExecutions: total,
      successfulExecutions: successful,
      failedExecutions: failed,
      averageExecutionTime: avgExecutionTime,
      riskDistribution,
      approvalSources,
      topTools
    }
  }

  generateSecurityReport(): {
    summary: string
    alerts: string[]
    recommendations: string[]
    riskScore: number
  } {
    const stats = this.getExecutionStatistics()
    const failureRate = stats.totalExecutions > 0 ? (stats.failedExecutions / stats.totalExecutions) : 0
    const highRiskRate = stats.totalExecutions > 0 ? (stats.riskDistribution.high / stats.totalExecutions) : 0
    const unauthorizedAttempts = this.getUnauthorizedAttempts().length

    const alerts: string[] = []
    const recommendations: string[] = []

    // Check for security concerns
    if (failureRate > 0.1) {
      alerts.push(`High failure rate detected: ${(failureRate * 100).toFixed(1)}%`)
      recommendations.push('Review failed tool executions and improve error handling')
    }

    if (highRiskRate > 0.05) {
      alerts.push(`Frequent high-risk operations: ${(highRiskRate * 100).toFixed(1)}% of executions`)
      recommendations.push('Consider additional approval workflows for high-risk tools')
    }

    if (unauthorizedAttempts > 0) {
      alerts.push(`${unauthorizedAttempts} unauthorized tool execution attempts detected`)
      recommendations.push('Review user permissions and tool access controls')
    }

    // Calculate overall risk score (0-100)
    let riskScore = 0
    riskScore += failureRate * 30
    riskScore += highRiskRate * 40
    riskScore += (unauthorizedAttempts / Math.max(stats.totalExecutions, 1)) * 30

    const summary = `
Audit Summary:
- Total Executions: ${stats.totalExecutions}
- Success Rate: ${((stats.successfulExecutions / Math.max(stats.totalExecutions, 1)) * 100).toFixed(1)}%
- High-Risk Operations: ${stats.riskDistribution.high}
- Unauthorized Attempts: ${unauthorizedAttempts}
- Risk Score: ${Math.min(100, Math.round(riskScore))}/100
    `.trim()

    return {
      summary,
      alerts,
      recommendations,
      riskScore: Math.min(100, Math.round(riskScore))
    }
  }

  // Search audit log
  searchAuditLog(query: {
    toolName?: string
    conversationId?: string
    success?: boolean
    riskLevel?: 'low' | 'medium' | 'high'
    dateFrom?: Date
    dateTo?: Date
    approvalSource?: 'user' | 'auto' | 'policy'
  }, limit?: number): ToolAuditEntry[] {
    let entries = this.auditLog.filter(entry => {
      if (query.toolName && entry.toolName !== query.toolName) return false
      if (query.conversationId && entry.conversationId !== query.conversationId) return false
      if (query.success !== undefined && entry.success !== query.success) return false
      if (query.riskLevel && entry.riskLevel !== query.riskLevel) return false
      if (query.approvalSource && entry.approvalSource !== query.approvalSource) return false
      if (query.dateFrom && entry.timestamp < query.dateFrom) return false
      if (query.dateTo && entry.timestamp > query.dateTo) return false
      return true
    })

    entries = entries.reverse() // Most recent first
    return limit ? entries.slice(0, limit) : entries
  }

  // Export audit log
  exportAuditLog(format: 'json' | 'csv' = 'json'): string {
    if (format === 'csv') {
      const headers = [
        'ID', 'Timestamp', 'Tool Name', 'Call ID', 'Conversation ID',
        'Success', 'Risk Level', 'Approved', 'Approval Source', 'Execution Time'
      ]

      const rows = this.auditLog.map(entry => [
        entry.id,
        entry.timestamp.toISOString(),
        entry.toolName,
        entry.callId,
        entry.conversationId,
        entry.success.toString(),
        entry.riskLevel,
        entry.approved.toString(),
        entry.approvalSource,
        entry.executionTime.toString()
      ])

      return [headers.join(','), ...rows.map(row => row.join(','))].join('\n')
    }

    return JSON.stringify(this.auditLog, null, 2)
  }

  // Clear audit log (with confirmation)
  clearAuditLog(confirmation: string): boolean {
    if (confirmation !== 'CLEAR_AUDIT_LOG_CONFIRMED') {
      return false
    }
    this.auditLog = []
    return true
  }

  private createDefaultImpactAnalysis(): ToolImpactAnalysis {
    return {
      filesAffected: [],
      operationType: 'read',
      reversible: true,
      dataLossRisk: 'none',
      systemImpact: 'none',
      estimatedChangeScope: 0
    }
  }

  private async persistEntry(entry: ToolAuditEntry): Promise<void> {
    // In a real implementation, this would write to a file or database
    // For now, we'll just simulate async persistence
    await new Promise(resolve => setTimeout(resolve, 1))

    // TODO: Implement actual file persistence
    // Example: append JSON line to log file
    // await fs.appendFile(this.logFilePath!, JSON.stringify(entry) + '\n')
  }

  // Cleanup old entries based on retention policy
  cleanupOldEntries(retentionDays: number = 30): number {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

    const originalLength = this.auditLog.length
    this.auditLog = this.auditLog.filter(entry => entry.timestamp > cutoffDate)

    return originalLength - this.auditLog.length
  }
}