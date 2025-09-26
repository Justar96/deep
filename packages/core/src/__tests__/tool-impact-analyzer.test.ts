// Test suite for Tool Impact Analyzer - Sprint 2 Enhanced Tool System
import { describe, it, expect, beforeEach } from 'vitest'
import { ToolImpactAnalyzer } from '@deep-agent/core'
import type { ToolImpactAnalysis, ToolRiskAssessment, ToolPermissions } from '@deep-agent/core'

describe('ToolImpactAnalyzer', () => {
  let analyzer: ToolImpactAnalyzer

  beforeEach(() => {
    analyzer = new ToolImpactAnalyzer()
  })

  describe('Basic Functionality', () => {
    it('should create analyzer instance', () => {
      expect(analyzer).toBeDefined()
      expect(analyzer).toBeInstanceOf(ToolImpactAnalyzer)
    })
  })

  describe('Tool Impact Analysis', () => {
    it('should analyze read operation impact', async () => {
      const toolName = 'read_file'
      const input = JSON.stringify({ path: '/home/user/document.txt' })

      const impact = await analyzer.analyzeToolImpact(toolName, input)

      expect(impact.operationType).toBe('read')
      expect(impact.reversible).toBe(true)
      expect(impact.dataLossRisk).toBe('none')
      expect(impact.systemImpact).toBe('none')
      expect(impact.filesAffected).toContain('/home/user/document.txt')
    })

    it('should analyze write operation impact', async () => {
      const toolName = 'write_file'
      const input = JSON.stringify({ path: '/home/user/document.txt', content: 'test' })

      const impact = await analyzer.analyzeToolImpact(toolName, input)

      expect(impact.operationType).toBe('write')
      expect(impact.dataLossRisk).toBe('low')
      expect(impact.systemImpact).toBe('local')
      expect(impact.filesAffected).toContain('/home/user/document.txt')
    })

    it('should analyze delete operation impact', async () => {
      const toolName = 'delete_file'
      const input = JSON.stringify({ path: '/home/user/document.txt' })

      const impact = await analyzer.analyzeToolImpact(toolName, input)

      expect(impact.operationType).toBe('delete')
      expect(impact.reversible).toBe(false)
      expect(impact.dataLossRisk).toBe('high')
      expect(impact.systemImpact).toBe('local')
    })

    it('should analyze execute operation impact', async () => {
      const toolName = 'execute_command'
      const input = JSON.stringify({ command: 'ls -la' })

      const impact = await analyzer.analyzeToolImpact(toolName, input)

      expect(impact.operationType).toBe('execute')
      expect(impact.reversible).toBe(false)
      expect(impact.dataLossRisk).toBe('high')
    })

    it('should analyze network operation impact', async () => {
      const toolName = 'http_request'
      const input = JSON.stringify({ url: 'https://api.example.com' })

      const impact = await analyzer.analyzeToolImpact(toolName, input)

      expect(impact.operationType).toBe('network')
      expect(impact.reversible).toBe(true)
      expect(impact.dataLossRisk).toBe('none')
      expect(impact.systemImpact).toBe('local')
    })

    it('should detect system path impact', async () => {
      const toolName = 'write_file'
      const input = JSON.stringify({ path: '/etc/passwd' })

      const impact = await analyzer.analyzeToolImpact(toolName, input)

      expect(impact.operationType).toBe('write')
      expect(impact.systemImpact).toBe('global')
      expect(impact.dataLossRisk).toBe('high')
    })

    it('should handle multiple affected files', async () => {
      const toolName = 'batch_operation'
      const input = JSON.stringify({
        files: ['/home/user/file1.txt', '/home/user/file2.txt'],
        operation: 'copy'
      })

      const impact = await analyzer.analyzeToolImpact(toolName, input)

      expect(impact.filesAffected.length).toBeGreaterThan(0)
      expect(impact.estimatedChangeScope).toBeGreaterThan(0)
    })

    it('should handle raw string input', async () => {
      const toolName = 'echo'
      const input = 'hello world'

      const impact = await analyzer.analyzeToolImpact(toolName, input)

      expect(impact.operationType).toBe('read')
      expect(impact.reversible).toBe(true)
      expect(impact.filesAffected).toHaveLength(0)
    })
  })

  describe('Tool Confirmation Creation', () => {
    it('should create tool confirmation for low-risk operation', async () => {
      const toolName = 'get_current_time'
      const input = JSON.stringify({ timezone: 'UTC' })
      const callId = 'test-call-id'

      const confirmation = await analyzer.createToolConfirmation(toolName, input, callId)

      expect(confirmation.toolName).toBe(toolName)
      expect(confirmation.riskLevel).toBe('low')
      expect(confirmation.requiresApproval).toBe(false)
      expect(confirmation.reversible).toBe(true)
    })

    it('should create tool confirmation for high-risk operation', async () => {
      const toolName = 'delete_file'
      const input = JSON.stringify({ path: '/important/file.txt' })
      const callId = 'test-call-id'

      const confirmation = await analyzer.createToolConfirmation(toolName, input, callId)

      expect(confirmation.toolName).toBe(toolName)
      expect(confirmation.riskLevel).toBe('high')
      expect(confirmation.requiresApproval).toBe(true)
      expect(confirmation.reversible).toBe(false)
      expect(confirmation.description).toContain('delete')
    })

    it('should create confirmation with proper impact analysis', async () => {
      const toolName = 'write_config'
      const input = JSON.stringify({ path: '/etc/config.json', data: '{}' })
      const callId = 'test-call-id'

      const confirmation = await analyzer.createToolConfirmation(toolName, input, callId)

      expect(confirmation.impact).toBeDefined()
      expect(confirmation.impact.operationType).toBe('write')
      expect(confirmation.affectedPaths).toContain('/etc/config.json')
    })
  })

  describe('Tool Risk Assessment', () => {
    it('should assess low-risk tool', () => {
      const toolName = 'get_current_time'
      const toolDefinition = {
        name: 'get_current_time',
        description: 'Get the current time',
        type: 'function'
      }

      const assessment = analyzer.assessToolRisk(toolName, toolDefinition)

      expect(assessment.baseRiskLevel).toBe('low')
      expect(assessment.destructiveCapability).toBe(false)
      expect(assessment.dataAccessLevel).toBe('read-only')
      expect(assessment.requiresConfirmation).toBe(false)
      expect(assessment.autoApprovalAllowed).toBe(true)
    })

    it('should assess high-risk tool', () => {
      const toolName = 'delete_files'
      const toolDefinition = {
        name: 'delete_files',
        description: 'Delete files from the system',
        type: 'function'
      }

      const assessment = analyzer.assessToolRisk(toolName, toolDefinition)

      expect(assessment.baseRiskLevel).toBe('high')
      expect(assessment.destructiveCapability).toBe(true)
      expect(assessment.dataAccessLevel).toBe('read-write')
      expect(assessment.requiresConfirmation).toBe(true)
      expect(assessment.autoApprovalAllowed).toBe(false)
    })

    it('should assess medium-risk tool', () => {
      const toolName = 'create_file'
      const toolDefinition = {
        name: 'create_file',
        description: 'Create a new file',
        type: 'function'
      }

      const assessment = analyzer.assessToolRisk(toolName, toolDefinition)

      expect(assessment.baseRiskLevel).toBe('medium')
      expect(assessment.destructiveCapability).toBe(false)
      expect(assessment.dataAccessLevel).toBe('read-write')
    })

    it('should assess admin-level tool', () => {
      const toolName = 'admin_command'
      const toolDefinition = {
        name: 'admin_command',
        description: 'Execute admin system commands',
        type: 'function'
      }

      const assessment = analyzer.assessToolRisk(toolName, toolDefinition)

      expect(assessment.dataAccessLevel).toBe('admin')
      expect(assessment.requiresConfirmation).toBe(true)
    })
  })

  describe('Required Permissions Analysis', () => {
    it('should detect file read permissions', () => {
      const toolName = 'read_file'
      const toolDefinition = {
        name: 'read_file',
        description: 'Read file contents',
        type: 'function'
      }

      const permissions = analyzer.getRequiredPermissions(toolName, toolDefinition)

      expect(permissions.fileRead).toBe(true)
      expect(permissions.fileWrite).toBe(false)
      expect(permissions.fileDelete).toBe(false)
      expect(permissions.networkAccess).toBe(false)
      expect(permissions.systemExecution).toBe(false)
      expect(permissions.environmentAccess).toBe(false)
    })

    it('should detect file write permissions', () => {
      const toolName = 'write_file'
      const toolDefinition = {
        name: 'write_file',
        description: 'Write content to file',
        type: 'function'
      }

      const permissions = analyzer.getRequiredPermissions(toolName, toolDefinition)

      expect(permissions.fileRead).toBe(false)
      expect(permissions.fileWrite).toBe(true)
      expect(permissions.fileDelete).toBe(false)
    })

    it('should detect file delete permissions', () => {
      const toolName = 'rm_file'
      const toolDefinition = {
        name: 'rm_file',
        description: 'Remove files from system',
        type: 'function'
      }

      const permissions = analyzer.getRequiredPermissions(toolName, toolDefinition)

      expect(permissions.fileDelete).toBe(true)
    })

    it('should detect network permissions', () => {
      const toolName = 'http_get'
      const toolDefinition = {
        name: 'http_get',
        description: 'Make HTTP GET request',
        type: 'function'
      }

      const permissions = analyzer.getRequiredPermissions(toolName, toolDefinition)

      expect(permissions.networkAccess).toBe(true)
    })

    it('should detect system execution permissions', () => {
      const toolName = 'exec_command'
      const toolDefinition = {
        name: 'exec_command',
        description: 'Execute shell command',
        type: 'function'
      }

      const permissions = analyzer.getRequiredPermissions(toolName, toolDefinition)

      expect(permissions.systemExecution).toBe(true)
    })

    it('should detect environment access permissions', () => {
      const toolName = 'get_env'
      const toolDefinition = {
        name: 'get_env',
        description: 'Get environment variables',
        type: 'function'
      }

      const permissions = analyzer.getRequiredPermissions(toolName, toolDefinition)

      expect(permissions.environmentAccess).toBe(true)
    })

    it('should detect multiple permissions', () => {
      const toolName = 'file_upload'
      const toolDefinition = {
        name: 'file_upload',
        description: 'Upload file via HTTP API',
        type: 'function'
      }

      const permissions = analyzer.getRequiredPermissions(toolName, toolDefinition)

      expect(permissions.fileRead).toBe(true)
      expect(permissions.networkAccess).toBe(true)
    })
  })

  describe('Path Analysis', () => {
    it('should identify system paths', async () => {
      const systemPaths = [
        '/etc/passwd',
        '/usr/bin/sudo',
        '/system/config',
        'C:\\Windows\\System32',
        'C:\\Program Files\\app'
      ]

      for (const path of systemPaths) {
        const toolName = 'write_file'
        const input = JSON.stringify({ path })

        const impact = await analyzer.analyzeToolImpact(toolName, input)

        expect(impact.systemImpact).toBe('global')
      }
    })

    it('should identify user paths', async () => {
      const userPaths = [
        '/home/user/document.txt',
        '/Users/john/Desktop/file.txt',
        'C:\\Users\\jane\\Documents\\file.doc'
      ]

      for (const path of userPaths) {
        const toolName = 'write_file'
        const input = JSON.stringify({ path })

        const impact = await analyzer.analyzeToolImpact(toolName, input)

        expect(impact.systemImpact).toBe('local')
      }
    })

    it('should extract paths from various parameter names', async () => {
      const pathParams = ['path', 'file', 'filename', 'directory', 'target', 'source']

      for (const param of pathParams) {
        const toolName = 'test_tool'
        const input = JSON.stringify({ [param]: '/test/file.txt' })

        const impact = await analyzer.analyzeToolImpact(toolName, input)

        expect(impact.filesAffected).toContain('/test/file.txt')
      }
    })
  })

  describe('Risk Calculation', () => {
    it('should calculate low risk for safe operations', async () => {
      const toolName = 'echo'
      const input = JSON.stringify({ text: 'hello' })

      const confirmation = await analyzer.createToolConfirmation(toolName, input, 'test')

      expect(confirmation.riskLevel).toBe('low')
    })

    it('should calculate high risk for destructive operations', async () => {
      const toolName = 'rm_rf'
      const input = JSON.stringify({ path: '/important/data' })

      const confirmation = await analyzer.createToolConfirmation(toolName, input, 'test')

      expect(confirmation.riskLevel).toBe('high')
    })

    it('should calculate high risk for system file operations', async () => {
      const toolName = 'modify_file'
      const input = JSON.stringify({ path: '/etc/passwd' })

      const confirmation = await analyzer.createToolConfirmation(toolName, input, 'test')

      expect(confirmation.riskLevel).toBe('high')
    })

    it('should require approval for high-risk operations', async () => {
      const toolName = 'execute_script'
      const input = JSON.stringify({ script: 'dangerous_script.sh' })

      const confirmation = await analyzer.createToolConfirmation(toolName, input, 'test')

      expect(confirmation.requiresApproval).toBe(true)
    })

    it('should require approval for operations affecting many files', async () => {
      const toolName = 'batch_process'
      const files = Array.from({ length: 10 }, (_, i) => `/file${i}.txt`)
      const input = JSON.stringify({ files })

      const confirmation = await analyzer.createToolConfirmation(toolName, input, 'test')

      expect(confirmation.requiresApproval).toBe(true)
    })
  })

  describe('Description Generation', () => {
    it('should generate descriptive confirmation message', async () => {
      const toolName = 'delete_file'
      const input = JSON.stringify({ path: '/home/user/temp.txt' })

      const confirmation = await analyzer.createToolConfirmation(toolName, input, 'test')

      expect(confirmation.description).toContain('delete_file')
      expect(confirmation.description).toContain('delete operation')
      expect(confirmation.description).toContain('irreversible')
      expect(confirmation.description).toContain('affecting 1 file')
    })

    it('should mention data loss risk in description', async () => {
      const toolName = 'truncate_file'
      const input = JSON.stringify({ path: '/data/important.txt' })

      const confirmation = await analyzer.createToolConfirmation(toolName, input, 'test')

      expect(confirmation.description).toContain('data loss risk')
    })

    it('should handle zero files affected', async () => {
      const toolName = 'echo'
      const input = JSON.stringify({ message: 'hello' })

      const confirmation = await analyzer.createToolConfirmation(toolName, input, 'test')

      expect(confirmation.description).toContain('Tool \'echo\'')
      expect(confirmation.description).toContain('reversible')
    })
  })
})