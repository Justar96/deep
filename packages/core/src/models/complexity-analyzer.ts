// Request complexity analyzer for intelligent model routing
import type {
  RequestComplexityAnalysis,
  IDEContext
} from '../types/core-types.js'
import type { Item } from '../types/index.js'

export class ComplexityAnalyzer {
  private readonly toolKeywords = [
    'execute', 'run', 'call', 'invoke', 'function', 'tool',
    'file', 'read', 'write', 'create', 'delete', 'modify',
    'search', 'find', 'grep', 'edit', 'replace'
  ]

  private readonly reasoningKeywords = [
    'analyze', 'explain', 'why', 'how', 'compare', 'evaluate',
    'reasoning', 'logic', 'think', 'solve', 'plan', 'strategy',
    'understand', 'interpret', 'deduce', 'infer', 'conclude',
    'assess', 'judge', 'consider', 'examine', 'investigate'
  ]

  private readonly complexityKeywords = [
    'complex', 'complicated', 'difficult', 'challenging',
    'advanced', 'sophisticated', 'intricate', 'detailed',
    'comprehensive', 'thorough', 'extensive', 'elaborate'
  ]

  private readonly multiStepIndicators = [
    'first', 'then', 'next', 'after', 'finally', 'step',
    'and then', 'followed by', 'subsequently', 'afterwards',
    'meanwhile', 'while', 'during', 'before', 'when'
  ]

  private readonly technicalDomains = {
    programming: [
      'code', 'function', 'variable', 'class', 'method', 'algorithm',
      'typescript', 'javascript', 'python', 'rust', 'go', 'java',
      'react', 'vue', 'angular', 'node', 'express', 'fastify',
      'database', 'sql', 'mongodb', 'postgresql', 'redis'
    ],
    devops: [
      'docker', 'kubernetes', 'deployment', 'ci/cd', 'pipeline',
      'aws', 'azure', 'gcp', 'terraform', 'ansible', 'jenkins'
    ],
    architecture: [
      'microservice', 'api', 'rest', 'graphql', 'architecture',
      'design pattern', 'scalability', 'performance', 'optimization'
    ],
    data: [
      'data', 'analytics', 'machine learning', 'ai', 'model',
      'training', 'dataset', 'statistics', 'visualization'
    ]
  }

  async analyzeComplexity(
    input: string,
    context?: IDEContext,
    conversationHistory?: Item[]
  ): Promise<RequestComplexityAnalysis> {
    const factors = this.analyzeFactors(input, context, conversationHistory)
    const complexity = this.calculateComplexity(factors)
    const confidence = this.calculateConfidence(factors, input)
    const suggestedModel = this.suggestModel(complexity, factors)
    const reasoning = this.generateReasoning(factors, complexity)

    return {
      complexity,
      factors,
      confidence,
      suggestedModel,
      reasoning
    }
  }

  private analyzeFactors(
    input: string,
    context?: IDEContext,
    conversationHistory?: Item[]
  ) {
    const lowerInput = input.toLowerCase()
    const sentences = input.split(/[.!?]+/).filter(s => s.trim().length > 0)

    return {
      hasToolCalls: this.detectToolCalls(lowerInput),
      requiresReasoning: this.detectReasoningRequirement(lowerInput),
      contentLength: input.length,
      previousContext: conversationHistory?.length || 0,
      domainSpecific: this.detectDomainSpecificity(lowerInput, context),
      multiStep: this.detectMultiStepRequest(lowerInput, sentences)
    }
  }

  private detectToolCalls(lowerInput: string): boolean {
    return this.toolKeywords.some(keyword => lowerInput.includes(keyword))
  }

  private detectReasoningRequirement(lowerInput: string): boolean {
    // Check for reasoning keywords
    const hasReasoningKeywords = this.reasoningKeywords.some(keyword =>
      lowerInput.includes(keyword)
    )

    // Check for complexity indicators
    const hasComplexityIndicators = this.complexityKeywords.some(keyword =>
      lowerInput.includes(keyword)
    )

    // Check for question patterns that require reasoning
    // Exclude simple greetings and social questions
    const simpleGreetings = ['hello', 'hi', 'how are you', 'good morning', 'good evening']
    const isSimpleGreeting = simpleGreetings.some(greeting => lowerInput.includes(greeting))

    if (isSimpleGreeting) {
      return false
    }

    const hasReasoningQuestions = [
      'why', 'what if', 'what would happen',
      'explain', 'justify', 'compare', 'contrast'
    ].some(pattern => lowerInput.includes(pattern))

    // Be more specific with "how" - exclude casual "how" usage
    const hasDeepHowQuestions = lowerInput.includes('how') &&
      !lowerInput.includes('how are you') &&
      !lowerInput.includes('how\'s') &&
      (lowerInput.includes('how do') || lowerInput.includes('how to') ||
       lowerInput.includes('how does') || lowerInput.includes('how can'))

    // Additional reasoning patterns for complex tasks
    const hasAnalysisTerms = [
      'analyz', 'explaining', 'architecture', 'suggesting', 'improvements',
      'comprehensive', 'report', 'understand', 'interpret'
    ].some(term => lowerInput.includes(term))


    return hasReasoningKeywords || hasComplexityIndicators || hasReasoningQuestions || hasDeepHowQuestions || hasAnalysisTerms
  }

  private detectDomainSpecificity(lowerInput: string, context?: IDEContext): boolean {
    // Check for technical domain keywords
    const hasTechnicalTerms = Object.values(this.technicalDomains)
      .flat()
      .some(term => lowerInput.includes(term))

    // Check context clues from IDE
    let hasContextClues = false
    if (context) {
      hasContextClues = context.workspaceSettings.projectType !== 'other' ||
                       context.openFiles.some(file =>
                         file.path.includes('.ts') ||
                         file.path.includes('.js') ||
                         file.path.includes('.py') ||
                         file.path.includes('.rs') ||
                         file.path.includes('.go')
                       )
    }

    return hasTechnicalTerms || hasContextClues
  }

  private detectMultiStepRequest(lowerInput: string, sentences: string[]): boolean {
    // Check for multi-step indicators
    const hasMultiStepIndicators = this.multiStepIndicators.some(indicator =>
      lowerInput.includes(indicator)
    )

    // Check for multiple action verbs (either across sentences or within single sentence)
    const actionVerbs = [
      'analyze', 'create', 'make', 'build', 'generate', 'write', 'implement',
      'update', 'modify', 'change', 'fix', 'debug', 'test', 'find', 'read',
      'deploy', 'configure', 'setup', 'install', 'explain', 'suggest', 'improve'
    ]

    // Count total action verbs in the entire input
    const actionVerbCount = actionVerbs.filter(verb => lowerInput.includes(verb)).length

    // Check for multiple sentences with action verbs
    const sentencesWithActions = sentences.filter(sentence =>
      actionVerbs.some(verb => sentence.toLowerCase().includes(verb))
    ).length

    // Check for numbered lists or bullet points
    const hasListStructure = /\d+\.|\*|\-/.test(lowerInput)

    // Check for coordinating conjunctions indicating multiple actions
    const hasCoordinatingConjunctions = /,\s*and|;\s*|,\s*then|,\s*after/.test(lowerInput)

    return hasMultiStepIndicators ||
           actionVerbCount >= 3 ||  // Multiple action verbs indicate multi-step
           sentencesWithActions > 1 ||
           hasListStructure ||
           sentences.length > 3 ||
           hasCoordinatingConjunctions
  }

  private calculateComplexity(factors: RequestComplexityAnalysis['factors']): 'simple' | 'moderate' | 'complex' {
    let score = 0

    // Weight different factors
    if (factors.hasToolCalls) score += 2
    if (factors.requiresReasoning) score += 2
    if (factors.contentLength > 500) score += 1
    if (factors.contentLength > 1500) score += 1
    if (factors.previousContext > 5) score += 1
    if (factors.previousContext > 15) score += 1
    if (factors.domainSpecific) score += 1
    if (factors.multiStep) score += 2

    // Additional scoring based on content analysis
    if (factors.contentLength > 2000 && factors.requiresReasoning) score += 1
    if (factors.hasToolCalls && factors.multiStep) score += 2  // Increased from 1 to 2
    if (factors.domainSpecific && factors.requiresReasoning) score += 1

    // Extra scoring for very complex requests
    if (factors.hasToolCalls && factors.requiresReasoning && factors.multiStep) score += 1
    if (factors.contentLength > 100 && factors.hasToolCalls && factors.multiStep) score += 1


    if (score <= 2) return 'simple'
    if (score <= 5) return 'moderate'  // Reduced from 6 to 5 to make complex classification easier
    return 'complex'
  }

  private calculateConfidence(
    factors: RequestComplexityAnalysis['factors'],
    input: string
  ): number {
    let confidence = 0.8 // Base confidence

    // Increase confidence for clear indicators
    if (factors.hasToolCalls && input.toLowerCase().includes('execute')) {
      confidence += 0.1
    }

    if (factors.multiStep && this.multiStepIndicators.some(indicator =>
      input.toLowerCase().includes(indicator))) {
      confidence += 0.1
    }

    if (factors.requiresReasoning && this.reasoningKeywords.some(keyword =>
      input.toLowerCase().includes(keyword))) {
      confidence += 0.05
    }

    // Decrease confidence for ambiguous cases
    if (factors.contentLength < 50) {
      confidence -= 0.1
    }

    if (!factors.hasToolCalls && !factors.requiresReasoning && !factors.multiStep) {
      confidence -= 0.05
    }

    return Math.max(0.5, Math.min(1.0, confidence))
  }

  private suggestModel(
    complexity: 'simple' | 'moderate' | 'complex',
    factors: RequestComplexityAnalysis['factors']
  ): string {
    // Model suggestions based on complexity and factors
    if (complexity === 'simple') {
      // For simple tasks, use efficient models
      if (factors.hasToolCalls) return 'gpt-5-mini'
      return 'gpt-5-nano'
    }

    if (complexity === 'moderate') {
      // For moderate tasks, balance capability and cost
      if (factors.requiresReasoning || factors.domainSpecific) return 'gpt-5'
      return 'gpt-5-mini'
    }

    // For complex tasks, use the most capable model
    return 'gpt-5'
  }

  private generateReasoning(
    factors: RequestComplexityAnalysis['factors'],
    complexity: 'simple' | 'moderate' | 'complex'
  ): string {
    const reasons: string[] = []

    reasons.push(`Classified as ${complexity} complexity`)

    if (factors.hasToolCalls) {
      reasons.push('requires tool execution')
    }

    if (factors.requiresReasoning) {
      reasons.push('requires analytical reasoning')
    }

    if (factors.multiStep) {
      reasons.push('involves multiple steps')
    }

    if (factors.domainSpecific) {
      reasons.push('domain-specific technical knowledge required')
    }

    if (factors.contentLength > 1000) {
      reasons.push('long-form content processing')
    }

    if (factors.previousContext > 10) {
      reasons.push('extensive conversation history')
    }

    return reasons.join(', ')
  }

  // Utility method to get detailed analysis
  async getDetailedAnalysis(
    input: string,
    context?: IDEContext,
    conversationHistory?: Item[]
  ): Promise<{
    analysis: RequestComplexityAnalysis
    breakdown: {
      wordCount: number
      sentenceCount: number
      technicalTerms: string[]
      actionVerbs: string[]
      questionPatterns: string[]
    }
  }> {
    const analysis = await this.analyzeComplexity(input, context, conversationHistory)

    const words = input.toLowerCase().split(/\s+/)
    const sentences = input.split(/[.!?]+/).filter(s => s.trim().length > 0)

    const technicalTerms = Object.values(this.technicalDomains)
      .flat()
      .filter(term => words.some(word => word.includes(term)))

    const actionVerbs = [
      'create', 'make', 'build', 'generate', 'write', 'implement',
      'update', 'modify', 'change', 'fix', 'debug', 'test'
    ].filter(verb => words.includes(verb))

    const questionPatterns = [
      'why', 'how', 'what', 'when', 'where', 'who'
    ].filter(pattern => words.includes(pattern))

    return {
      analysis,
      breakdown: {
        wordCount: words.length,
        sentenceCount: sentences.length,
        technicalTerms,
        actionVerbs,
        questionPatterns
      }
    }
  }
}