/**
 * Learning engine: pattern detection and skill generation
 * Hermès-style autonomous skill creation from execution patterns
 */

import { MemoryInterface } from './memory-interface';
import { MemoryEntry } from './memory-store';

export interface ToolPattern {
  toolName: string;
  frequency: number;
  argPatterns: Record<string, any>[];
  successRate: number;
  lastSeen: number;
}

export interface SkillDefinition {
  name: string;
  description: string;
  trigger: string; // Pattern that activates this skill
  toolSequence: Array<{ tool: string; args: any }>;
  confidence: number;
  createdAt: number;
  usageCount: number;
}

export class LearningEngine {
  private readonly PATTERN_THRESHOLD = 3; // Min occurrences to create skill
  private readonly SUCCESS_THRESHOLD = 0.7; // Min success rate

  constructor(private memory: MemoryInterface) {}

  /**
   * Analyze recent tool executions for patterns
   */
  detectPatterns(sessionId: string): ToolPattern[] {
    const toolCalls = this.memory['store'].getMemories(sessionId, {
      type: 'tool_call',
      limit: 100
    });

    // Group by tool name
    const grouped = new Map<string, MemoryEntry[]>();
    for (const call of toolCalls) {
      const toolName = call.metadata?.toolName;
      if (!toolName) continue;

      if (!grouped.has(toolName)) {
        grouped.set(toolName, []);
      }
      grouped.get(toolName)!.push(call);
    }

    // Analyze patterns
    const patterns: ToolPattern[] = [];
    for (const [toolName, calls] of grouped) {
      if (calls.length < this.PATTERN_THRESHOLD) continue;

      // Extract arg patterns
      const argPatterns = calls.map(c => c.metadata?.args || {});

      // Calculate success rate (placeholder - would check tool_result success)
      const successRate = 0.85; // Mock for now

      patterns.push({
        toolName,
        frequency: calls.length,
        argPatterns,
        successRate,
        lastSeen: calls[0].timestamp
      });
    }

    return patterns.filter(p => p.successRate >= this.SUCCESS_THRESHOLD);
  }

  /**
   * Detect tool sequences that repeat
   */
  detectSequencePatterns(sessionId: string): Array<MemoryEntry[]> {
    const toolCalls = this.memory['store'].getMemories(sessionId, {
      type: 'tool_call',
      limit: 100
    });

    // Simple sequence detection: find consecutive tool calls
    const sequences: Array<MemoryEntry[]> = [];
    let currentSeq: MemoryEntry[] = [];

    for (let i = 0; i < toolCalls.length; i++) {
      const call = toolCalls[i];
      const nextCall = toolCalls[i + 1];

      currentSeq.push(call);

      // End sequence if gap > 5 seconds or end of list
      if (!nextCall || nextCall.timestamp - call.timestamp > 5000) {
        if (currentSeq.length >= 2) {
          sequences.push([...currentSeq]);
        }
        currentSeq = [];
      }
    }

    // Find repeating sequences
    const seqMap = new Map<string, MemoryEntry[][]>();
    for (const seq of sequences) {
      const key = seq.map(c => c.metadata?.toolName).join('→');
      if (!seqMap.has(key)) {
        seqMap.set(key, []);
      }
      seqMap.get(key)!.push(seq);
    }

    // Return sequences that appear multiple times
    const repeating: Array<MemoryEntry[]> = [];
    for (const [key, seqs] of seqMap) {
      if (seqs.length >= this.PATTERN_THRESHOLD) {
        repeating.push(seqs[0]); // Return first occurrence
      }
    }

    return repeating;
  }

  /**
   * Generate skill from detected pattern
   */
  generateSkill(pattern: ToolPattern | MemoryEntry[]): SkillDefinition {
    if (Array.isArray(pattern)) {
      // Sequence pattern
      const toolNames = pattern.map(c => c.metadata?.toolName);
      const name = `auto_${toolNames.join('_')}_${Date.now()}`;

      return {
        name,
        description: `Auto-generated: ${toolNames.join(' → ')}`,
        trigger: `sequence: ${toolNames[0]}`, // Simplified trigger
        toolSequence: pattern.map(c => ({
          tool: c.metadata?.toolName,
          args: c.metadata?.args || {}
        })),
        confidence: 0.8,
        createdAt: Date.now(),
        usageCount: 0
      };
    } else {
      // Single tool pattern
      const name = `auto_${pattern.toolName}_${Date.now()}`;

      return {
        name,
        description: `Auto-generated: ${pattern.toolName} (used ${pattern.frequency}x)`,
        trigger: `tool: ${pattern.toolName}`,
        toolSequence: [{
          tool: pattern.toolName,
          args: pattern.argPatterns[0] || {}
        }],
        confidence: pattern.successRate,
        createdAt: Date.now(),
        usageCount: 0
      };
    }
  }

  /**
   * Main learning loop: detect patterns and create skills
   */
  async runLearningCycle(sessionId: string): Promise<SkillDefinition[]> {
    const newSkills: SkillDefinition[] = [];

    // Detect single-tool patterns
    const toolPatterns = this.detectPatterns(sessionId);
    for (const pattern of toolPatterns) {
      const skill = this.generateSkill(pattern);
      newSkills.push(skill);

      // Record in memory
      this.memory.recordSkillLearned(sessionId, skill.name, skill);
    }

    // Detect sequence patterns
    const seqPatterns = this.detectSequencePatterns(sessionId);
    for (const seq of seqPatterns) {
      const skill = this.generateSkill(seq);
      newSkills.push(skill);

      // Record in memory
      this.memory.recordSkillLearned(sessionId, skill.name, skill);
    }

    return newSkills;
  }

  /**
   * Get all learned skills
   */
  getLearnedSkills(): SkillDefinition[] {
    const memories = this.memory.getLearnedSkills();
    return memories
      .map(m => m.metadata?.pattern as SkillDefinition)
      .filter(Boolean);
  }

  /**
   * Find applicable skill for current context
   */
  findApplicableSkill(toolName: string): SkillDefinition | null {
    const skills = this.getLearnedSkills();

    // Simple matching: find skill with matching trigger
    for (const skill of skills) {
      if (skill.trigger.includes(toolName)) {
        return skill;
      }
    }

    return null;
  }
}
