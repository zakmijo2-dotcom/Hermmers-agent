/**
 * Learning Engine - Production Grade
 * Evidence-based pattern detection and skill generation
 * Replaces MIJ's mocked learning with real evaluation
 */

import { MemoryEntry } from '../types';

export interface ToolExecution {
  toolName: string;
  args: any;
  result: any;
  success: boolean;
  duration: number;
  timestamp: number;
  context: string;
}

export interface Pattern {
  type: 'single-tool' | 'sequence' | 'error-recovery';
  frequency: number;
  successRate: number;
  examples: ToolExecution[];
  signature: string;
}

export interface LearnedSkill {
  name: string;
  version: string;
  description: string;
  pattern: Pattern;
  confidence: number;
  createdAt: number;
  evidence: {
    totalExecutions: number;
    successfulExecutions: number;
    averageDuration: number;
  };
}

export class LearningEngine {
  private readonly PATTERN_THRESHOLD = 3; // Min occurrences
  private readonly SUCCESS_THRESHOLD = 0.7; // 70% success rate
  private readonly MIN_CONFIDENCE = 0.6;

  /**
   * Detect patterns from tool execution history
   */
  detectPatterns(executions: ToolExecution[]): Pattern[] {
    const patterns: Pattern[] = [];

    // Detect single-tool patterns
    patterns.push(...this.detectSingleToolPatterns(executions));

    // Detect sequences
    patterns.push(...this.detectSequencePatterns(executions));

    // Detect error recovery patterns
    patterns.push(...this.detectErrorRecoveryPatterns(executions));

    return patterns.filter(p =>
      p.frequency >= this.PATTERN_THRESHOLD &&
      p.successRate >= this.SUCCESS_THRESHOLD
    );
  }

  /**
   * Detect repeated single-tool usage patterns
   */
  private detectSingleToolPatterns(executions: ToolExecution[]): Pattern[] {
    const toolGroups = new Map<string, ToolExecution[]>();

    // Group by tool + args signature
    for (const exec of executions) {
      const signature = this.createSignature(exec.toolName, exec.args);

      if (!toolGroups.has(signature)) {
        toolGroups.set(signature, []);
      }
      toolGroups.get(signature)!.push(exec);
    }

    const patterns: Pattern[] = [];

    for (const [signature, execs] of toolGroups) {
      if (execs.length < this.PATTERN_THRESHOLD) continue;

      const successful = execs.filter(e => e.success).length;
      const successRate = successful / execs.length;

      patterns.push({
        type: 'single-tool',
        frequency: execs.length,
        successRate,
        examples: execs.slice(0, 3),
        signature
      });
    }

    return patterns;
  }

  /**
   * Detect tool sequences that repeat
   */
  private detectSequencePatterns(executions: ToolExecution[]): Pattern[] {
    const sequences: ToolExecution[][] = [];
    const windowSize = 3; // Look for 3-tool sequences

    // Extract sequences
    for (let i = 0; i <= executions.length - windowSize; i++) {
      const window = executions.slice(i, i + windowSize);

      // Check if executions are close in time (within 30 seconds)
      const timeSpan = window[window.length - 1].timestamp - window[0].timestamp;
      if (timeSpan > 30000) continue;

      sequences.push(window);
    }

    // Group identical sequences
    const seqGroups = new Map<string, ToolExecution[][]>();

    for (const seq of sequences) {
      const signature = seq.map(e => e.toolName).join('→');

      if (!seqGroups.has(signature)) {
        seqGroups.set(signature, []);
      }
      seqGroups.get(signature)!.push(seq);
    }

    const patterns: Pattern[] = [];

    for (const [signature, seqs] of seqGroups) {
      if (seqs.length < this.PATTERN_THRESHOLD) continue;

      // Calculate success rate (all tools in sequence must succeed)
      const successful = seqs.filter(seq =>
        seq.every(e => e.success)
      ).length;

      const successRate = successful / seqs.length;

      patterns.push({
        type: 'sequence',
        frequency: seqs.length,
        successRate,
        examples: seqs[0], // First occurrence
        signature
      });
    }

    return patterns;
  }

  /**
   * Detect error recovery patterns (failed → succeeded)
   */
  private detectErrorRecoveryPatterns(executions: ToolExecution[]): Pattern[] {
    const patterns: Pattern[] = [];
    const recoveries: ToolExecution[][] = [];

    for (let i = 0; i < executions.length - 1; i++) {
      const failed = executions[i];
      const succeeded = executions[i + 1];

      if (!failed.success && succeeded.success) {
        // Same tool, different approach
        if (failed.toolName === succeeded.toolName) {
          recoveries.push([failed, succeeded]);
        }
      }
    }

    // Group by tool
    const recoveryGroups = new Map<string, ToolExecution[][]>();

    for (const recovery of recoveries) {
      const toolName = recovery[0].toolName;

      if (!recoveryGroups.has(toolName)) {
        recoveryGroups.set(toolName, []);
      }
      recoveryGroups.get(toolName)!.push(recovery);
    }

    for (const [toolName, recovs] of recoveryGroups) {
      if (recovs.length < 2) continue; // Need at least 2 recovery instances

      patterns.push({
        type: 'error-recovery',
        frequency: recovs.length,
        successRate: 1.0, // Recovery succeeded
        examples: recovs[0], // First recovery
        signature: `${toolName}-recovery`
      });
    }

    return patterns;
  }

  /**
   * Generate skill from detected pattern
   */
  generateSkill(pattern: Pattern): LearnedSkill {
    const name = this.generateSkillName(pattern);
    const description = this.generateSkillDescription(pattern);

    // Calculate confidence based on evidence
    const confidence = this.calculateConfidence(pattern);

    // Calculate evidence metrics
    const totalExecutions = pattern.frequency;
    const successfulExecutions = Math.round(pattern.frequency * pattern.successRate);

    const durations = pattern.examples.map(e =>
      Array.isArray(e) ? e[0].duration : e.duration
    );
    const averageDuration = durations.reduce((a, b) => a + b, 0) / durations.length;

    return {
      name,
      version: '0.1.0', // Auto-generated skills start at 0.1.0
      description,
      pattern,
      confidence,
      createdAt: Date.now(),
      evidence: {
        totalExecutions,
        successfulExecutions,
        averageDuration
      }
    };
  }

  /**
   * Calculate confidence score (0-1)
   */
  private calculateConfidence(pattern: Pattern): number {
    let confidence = 0;

    // Base confidence from success rate (0-0.4)
    confidence += pattern.successRate * 0.4;

    // Frequency bonus (0-0.3)
    const frequencyScore = Math.min(pattern.frequency / 10, 1);
    confidence += frequencyScore * 0.3;

    // Pattern type bonus (0-0.3)
    const typeBonus = {
      'single-tool': 0.2,
      'sequence': 0.3,
      'error-recovery': 0.25
    };
    confidence += typeBonus[pattern.type];

    return Math.min(confidence, 1);
  }

  /**
   * Generate skill name from pattern
   */
  private generateSkillName(pattern: Pattern): string {
    const timestamp = Date.now().toString(36);

    switch (pattern.type) {
      case 'single-tool':
        return `learned-${pattern.signature.split(':')[0]}-${timestamp}`;

      case 'sequence':
        const tools = pattern.signature.split('→').slice(0, 2).join('-');
        return `sequence-${tools}-${timestamp}`;

      case 'error-recovery':
        return `recovery-${pattern.signature.replace('-recovery', '')}-${timestamp}`;

      default:
        return `learned-${timestamp}`;
    }
  }

  /**
   * Generate skill description from pattern
   */
  private generateSkillDescription(pattern: Pattern): string {
    switch (pattern.type) {
      case 'single-tool':
        return `Learned pattern: ${pattern.signature} (${pattern.frequency}x, ${(pattern.successRate * 100).toFixed(0)}% success)`;

      case 'sequence':
        return `Learned sequence: ${pattern.signature} (${pattern.frequency}x, ${(pattern.successRate * 100).toFixed(0)}% success)`;

      case 'error-recovery':
        return `Learned error recovery for ${pattern.signature.replace('-recovery', '')} (${pattern.frequency}x)`;

      default:
        return `Learned pattern (${pattern.frequency}x, ${(pattern.successRate * 100).toFixed(0)}% success)`;
    }
  }

  /**
   * Create signature for tool + args
   */
  private createSignature(toolName: string, args: any): string {
    const argsStr = JSON.stringify(args);
    const hash = this.simpleHash(argsStr);
    return `${toolName}:${hash}`;
  }

  /**
   * Simple hash function
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Validate learned skill before saving
   */
  validateLearnedSkill(skill: LearnedSkill): { valid: boolean; reason?: string } {
    if (skill.confidence < this.MIN_CONFIDENCE) {
      return {
        valid: false,
        reason: `Confidence ${skill.confidence.toFixed(2)} below threshold ${this.MIN_CONFIDENCE}`
      };
    }

    if (skill.evidence.successfulExecutions < 2) {
      return {
        valid: false,
        reason: 'Not enough successful executions'
      };
    }

    return { valid: true };
  }
}
