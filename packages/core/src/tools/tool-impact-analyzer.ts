// Tool Impact Analyzer - analyzes tool calls for risk assessment and impact analysis
import * as path from 'path'
import * as fs from 'fs/promises'
import type {
  ToolImpactAnalysis,
  ToolRiskAssessment,
  ToolConfirmation,
  ToolPermissions
} from '../types/core-types.js'

export class ToolImpactAnalyzer {
  private riskPatterns: Map<string, RegExp[]> = new Map()
  private destructiveOperations: Set<string> = new Set()
  private systemPaths: Set<string> = new Set()

  constructor() {
    this.initializeRiskPatterns()
    this.initializeDestructiveOperations()
    this.initializeSystemPaths()
  }

  async analyzeToolImpact(
    toolName: string,
    input: string,
    toolSchema?: any
  ): Promise<ToolImpactAnalysis> {
    const parsedInput = this.parseToolInput(input)
    const operationType = this.determineOperationType(toolName, parsedInput, toolSchema)
    const filesAffected = await this.extractAffectedPaths(parsedInput)
    const reversible = this.isOperationReversible(toolName, operationType, parsedInput, filesAffected)
    const dataLossRisk = this.assessDataLossRisk(toolName, operationType, filesAffected)
    const systemImpact = this.assessSystemImpact(filesAffected, operationType)

    return {
      filesAffected,
      operationType,
      reversible,
      dataLossRisk,
      systemImpact,
      estimatedChangeScope: filesAffected.length
    }
  }

  async createToolConfirmation(
    toolName: string,
    input: string,
    callId: string,
    toolSchema?: any
  ): Promise<ToolConfirmation> {
    const impact = await this.analyzeToolImpact(toolName, input, toolSchema)
    const riskLevel = this.calculateRiskLevel(impact, toolName)
    const requiresApproval = this.shouldRequireApproval(riskLevel, impact)

    return {
      toolName,
      riskLevel,
      affectedPaths: impact.filesAffected,
      description: this.generateDescription(toolName, impact),
      requiresApproval,
      impact,
      reversible: impact.reversible
    }
  }

  assessToolRisk(toolName: string, toolDefinition: any): ToolRiskAssessment {
    const baseRiskLevel = this.getBaseRiskLevel(toolName, toolDefinition)
    const destructiveCapability = this.hasDestructiveCapability(toolName, toolDefinition)
    const dataAccessLevel = this.getDataAccessLevel(toolName, toolDefinition)

    return {
      baseRiskLevel,
      destructiveCapability,
      dataAccessLevel,
      requiresConfirmation: baseRiskLevel !== 'low' || destructiveCapability,
      autoApprovalAllowed: baseRiskLevel === 'low' && !destructiveCapability
    }
  }

  getRequiredPermissions(toolName: string, toolDefinition: any): ToolPermissions {
    const permissions: ToolPermissions = {
      fileRead: false,
      fileWrite: false,
      fileDelete: false,
      networkAccess: false,
      systemExecution: false,
      environmentAccess: false
    }

    // Analyze tool definition to determine required permissions
    const description = toolDefinition.description?.toLowerCase() || ''
    const name = toolName.toLowerCase()

    // File operations
    if (this.hasPattern(name, description, ['read', 'list', 'view', 'show', 'cat', 'get', 'upload'])) {
      permissions.fileRead = true
    }
    if (this.hasPattern(name, description, ['write', 'create', 'save', 'update', 'edit', 'modify'])) {
      permissions.fileWrite = true
    }
    if (this.hasPattern(name, description, ['delete', 'remove', 'rm', 'unlink', 'destroy'])) {
      permissions.fileDelete = true
    }

    // Network operations
    if (this.hasPattern(name, description, ['http', 'fetch', 'download', 'upload', 'request', 'api', 'web'])) {
      permissions.networkAccess = true
    }

    // System operations
    if (this.hasPattern(name, description, ['execute', 'run', 'exec', 'command', 'shell', 'subprocess'])) {
      permissions.systemExecution = true
    }

    // Environment access
    if (this.hasPattern(name, description, ['env', 'environment', 'config', 'settings', 'system'])) {
      permissions.environmentAccess = true
    }

    return permissions
  }

  private parseToolInput(input: string): any {
    try {
      return JSON.parse(input)
    } catch {
      return { raw: input }
    }
  }

  private determineOperationType(
    toolName: string,
    parsedInput: any,
    toolSchema?: any
  ): 'read' | 'write' | 'delete' | 'execute' | 'network' {
    const name = toolName.toLowerCase()
    const description = (toolSchema?.description || '').toLowerCase()

    if (this.destructiveOperations.has(name) ||
        this.hasPattern(name, description, ['delete', 'remove', 'rm', 'destroy'])) {
      return 'delete'
    }

    if (this.hasPattern(name, description, ['write', 'create', 'save', 'update', 'edit', 'modify'])) {
      return 'write'
    }

    if (this.hasPattern(name, description, ['execute', 'run', 'exec', 'command'])) {
      return 'execute'
    }

    if (this.hasPattern(name, description, ['http', 'fetch', 'download', 'request', 'web'])) {
      return 'network'
    }

    return 'read'
  }

  private async extractAffectedPaths(parsedInput: any): Promise<string[]> {
    const paths: string[] = []

    // Extract paths from common parameter names
    const pathFields = ['path', 'file', 'filename', 'directory', 'dir', 'target', 'source']

    for (const field of pathFields) {
      if (parsedInput[field]) {
        paths.push(this.normalizePath(parsedInput[field]))
      }
    }

    // Look for path-like strings in any field
    for (const [key, value] of Object.entries(parsedInput)) {
      if (typeof value === 'string' && this.looksLikePath(value)) {
        paths.push(this.normalizePath(value))
      } else if (Array.isArray(value)) {
        // Handle array parameters (e.g., files: ['/path1', '/path2'])
        value.forEach(item => {
          if (typeof item === 'string' && this.looksLikePath(item)) {
            paths.push(this.normalizePath(item))
          }
        })
      }
    }

    return [...new Set(paths)] // Remove duplicates
  }

  private isOperationReversible(
    toolName: string,
    operationType: 'read' | 'write' | 'delete' | 'execute' | 'network',
    parsedInput: any,
    filesAffected?: string[]
  ): boolean {
    // Read and network operations are typically reversible
    if (operationType === 'read' || operationType === 'network') {
      return true
    }

    // Delete operations are typically not reversible
    if (operationType === 'delete') {
      return false
    }

    // Execute operations depend on what they do
    if (operationType === 'execute') {
      return false // Conservative approach
    }

    // Write operations are usually reversible if they create new files or can be undone
    if (operationType === 'write') {
      // Check if it's creating a new file vs modifying existing
      const toolNameLower = toolName.toLowerCase()

      // If tool name/operation suggests creation of new files
      if (this.hasPattern(toolNameLower, '', ['create', 'new', 'init', 'write'])) {
        return true
      }

      // Check if files being written to are likely new files (e.g., in temp directories)
      if (filesAffected && filesAffected.length > 0) {
        const tempDirPatterns = ['/tmp/', '/temp/', '/temporary/', '.tmp', '.temp']
        const hasTemporaryFiles = filesAffected.some(file =>
          tempDirPatterns.some(pattern => file.includes(pattern))
        )
        if (hasTemporaryFiles) {
          return true
        }
      }

      // For write operations to non-temporary locations, be more conservative
      // but still consider them reversible for small-scale operations
      return true // Most file writes can be undone
    }

    return false
  }

  private assessDataLossRisk(
    toolName: string,
    operationType: 'read' | 'write' | 'delete' | 'execute' | 'network',
    filesAffected: string[]
  ): 'none' | 'low' | 'high' {
    if (operationType === 'read' || operationType === 'network') {
      return 'none'
    }

    if (operationType === 'delete') {
      return 'high'
    }

    if (operationType === 'execute') {
      return 'high' // Conservative approach
    }

    if (operationType === 'write') {
      // Check if affecting system files
      const affectsSystemFiles = filesAffected.some(path =>
        this.systemPaths.has(path) || this.isSystemPath(path)
      )
      return affectsSystemFiles ? 'high' : 'low'
    }

    return 'low'
  }

  private assessSystemImpact(
    filesAffected: string[],
    operationType: 'read' | 'write' | 'delete' | 'execute' | 'network'
  ): 'none' | 'local' | 'global' {
    if (operationType === 'read') {
      return 'none'
    }

    if (operationType === 'network') {
      return 'local'
    }

    const affectsSystemFiles = filesAffected.some(path => this.isSystemPath(path))
    if (affectsSystemFiles) {
      return 'global'
    }

    return 'local'
  }

  private calculateRiskLevel(
    impact: ToolImpactAnalysis,
    toolName: string
  ): 'low' | 'medium' | 'high' {
    // High risk conditions
    if (impact.dataLossRisk === 'high' ||
        impact.systemImpact === 'global' ||
        impact.operationType === 'delete' ||
        impact.operationType === 'execute') {
      return 'high'
    }

    // Medium risk conditions
    if (impact.dataLossRisk === 'low' ||
        impact.systemImpact === 'local' ||
        impact.operationType === 'write' ||
        impact.estimatedChangeScope > 10) {
      return 'medium'
    }

    return 'low'
  }

  private shouldRequireApproval(
    riskLevel: 'low' | 'medium' | 'high',
    impact: ToolImpactAnalysis
  ): boolean {
    // Always require approval for high-risk operations
    if (riskLevel === 'high') {
      return true
    }

    // Require approval for medium-risk non-reversible operations
    if (riskLevel === 'medium' && !impact.reversible) {
      return true
    }

    // Require approval for operations affecting many files
    if (impact.estimatedChangeScope > 5) {
      return true
    }

    return false
  }

  private generateDescription(toolName: string, impact: ToolImpactAnalysis): string {
    const operation = impact.operationType
    const fileCount = impact.filesAffected.length
    const reversible = impact.reversible ? 'reversible' : 'irreversible'

    let description = `Tool '${toolName}' will perform ${operation} operation`

    if (fileCount > 0) {
      description += ` affecting ${fileCount} file(s)`
    }

    description += `. This operation is ${reversible}`

    if (impact.dataLossRisk !== 'none') {
      description += ` with ${impact.dataLossRisk} data loss risk`
    }

    return description
  }

  private getBaseRiskLevel(toolName: string, toolDefinition: any): 'low' | 'medium' | 'high' {
    const name = toolName.toLowerCase()
    const description = toolDefinition.description?.toLowerCase() || ''

    // High-risk patterns
    if (this.hasPattern(name, description, ['delete', 'destroy', 'remove', 'rm', 'unlink', 'execute', 'exec', 'run'])) {
      return 'high'
    }

    // Medium-risk patterns
    if (this.hasPattern(name, description, ['write', 'create', 'modify', 'update', 'save', 'upload'])) {
      return 'medium'
    }

    return 'low'
  }

  private hasDestructiveCapability(toolName: string, toolDefinition: any): boolean {
    const name = toolName.toLowerCase()
    const description = toolDefinition.description?.toLowerCase() || ''

    return this.hasPattern(name, description, ['delete', 'destroy', 'remove', 'rm', 'unlink', 'truncate', 'wipe', 'clear'])
  }

  private getDataAccessLevel(toolName: string, toolDefinition: any): 'read-only' | 'read-write' | 'admin' {
    const name = toolName.toLowerCase()
    const description = toolDefinition.description?.toLowerCase() || ''

    // Check for read-write operations first (including delete) before admin
    if (this.hasPattern(name, description, ['write', 'create', 'modify', 'update', 'save', 'upload', 'delete'])) {
      return 'read-write'
    }

    if (this.hasPattern(name, description, ['admin', 'root', 'system', 'config', 'settings'])) {
      return 'admin'
    }

    return 'read-only'
  }

  private hasPattern(name: string, description: string, patterns: string[]): boolean {
    const text = `${name} ${description}`.toLowerCase()
    return patterns.some(pattern => text.includes(pattern))
  }

  private looksLikePath(str: string): boolean {
    // Simple heuristic for path-like strings
    return str.includes('/') || str.includes('\\') || str.includes('.') || Boolean(str.match(/^[a-zA-Z]:[\\\/]/))
  }

  private normalizePath(pathStr: string): string {
    // For cross-platform compatibility, normalize to Unix-style paths
    // This ensures consistent behavior across Windows and Unix systems
    return path.posix.normalize(pathStr.replace(/\\/g, '/'))
  }

  private isSystemPath(pathStr: string): boolean {
    const normalizedPath = pathStr.toLowerCase()
    // Handle both original and normalized path formats
    const systemPrefixes = [
      '/system', '/usr/bin', '/etc', '/var/log', '/bin', '/sbin', '/usr/sbin',
      'c:/windows', 'c:/program files',  // normalized Windows paths
      'c:\\windows', 'c:\\program files'  // original Windows paths
    ]
    return systemPrefixes.some(prefix => normalizedPath.startsWith(prefix.toLowerCase()))
  }

  private initializeRiskPatterns(): void {
    this.riskPatterns = new Map([
      ['file_write', [/write|create|save|modify/i]],
      ['file_delete', [/delete|remove|rm|unlink/i]],
      ['system_exec', [/execute|exec|run|command|shell/i]],
      ['network', [/http|fetch|download|upload|request/i]]
    ])
  }

  private initializeDestructiveOperations(): void {
    this.destructiveOperations = new Set([
      'file_delete',
      'directory_delete',
      'system_shutdown',
      'process_kill',
      'database_drop',
      'rm',
      'rmdir',
      'unlink',
      'truncate'
    ])
  }

  private initializeSystemPaths(): void {
    this.systemPaths = new Set([
      '/etc',
      '/usr/bin',
      '/system',
      '/var/log',
      'c:\\windows',
      'c:\\program files',
      '/bin',
      '/sbin',
      '/usr/sbin'
    ])
  }
}