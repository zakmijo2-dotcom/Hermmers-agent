/**
 * Stable context system: replaces OpenCode's cache-epoch with Hermès-style prompt stability
 * Key: baseline prompt remains stable, only incremental updates sent
 */

import { MemoryContext } from './memory-interface';
import { SkillDefinition } from './learning-engine';

export interface ContextSegment {
  id: string;
  type: 'system' | 'user' | 'assistant' | 'update';
  content: string;
  priority: number;
  stability: 'stable' | 'volatile';
  cacheable: boolean;
}

export interface StablePrompt {
  baselineSegments: ContextSegment[];
  updates: ContextSegment[];
  fingerprint: string;
}

export class StableContextManager {
  private currentBaseline: ContextSegment[] | null = null;
  private baselineFingerprint: string | null = null;

  /**
   * Build stable baseline prompt (changes rarely)
   */
  buildBaseline(config: {
    systemInstructions: string;
    skills: SkillDefinition[];
    sessionMetadata?: Record<string, any>;
  }): ContextSegment[] {
    const segments: ContextSegment[] = [];

    // System instructions (highest stability)
    segments.push({
      id: 'system-instructions',
      type: 'system',
      content: config.systemInstructions,
      priority: 100,
      stability: 'stable',
      cacheable: true
    });

    // Available skills (stable, changes only when skills learned)
    if (config.skills.length > 0) {
      const skillsContent = this.formatSkills(config.skills);
      segments.push({
        id: 'available-skills',
        type: 'system',
        content: skillsContent,
        priority: 90,
        stability: 'stable',
        cacheable: true
      });
    }

    // Session context (stable within session)
    if (config.sessionMetadata) {
      segments.push({
        id: 'session-metadata',
        type: 'system',
        content: `Session: ${JSON.stringify(config.sessionMetadata)}`,
        priority: 80,
        stability: 'stable',
        cacheable: true
      });
    }

    return segments;
  }

  /**
   * Build incremental updates (change frequently)
   */
  buildUpdates(memoryContext: MemoryContext): ContextSegment[] {
    const segments: ContextSegment[] = [];

    // Recent memories (volatile, changes every turn)
    if (memoryContext.relevantMemories.length > 0) {
      const memoryContent = this.formatMemories(memoryContext);
      segments.push({
        id: 'recent-memories',
        type: 'update',
        content: memoryContent,
        priority: 50,
        stability: 'volatile',
        cacheable: false
      });
    }

    return segments;
  }

  /**
   * Assemble complete prompt with baseline + updates
   * Returns flag indicating if baseline changed (cache break)
   */
  assemblePrompt(
    baseline: ContextSegment[],
    updates: ContextSegment[]
  ): { prompt: StablePrompt; baselineChanged: boolean } {
    const fingerprint = this.computeFingerprint(baseline);
    const baselineChanged = fingerprint !== this.baselineFingerprint;

    if (baselineChanged) {
      this.currentBaseline = baseline;
      this.baselineFingerprint = fingerprint;
    }

    return {
      prompt: {
        baselineSegments: baseline,
        updates,
        fingerprint
      },
      baselineChanged
    };
  }

  /**
   * Format prompt for provider (combines baseline + updates)
   */
  formatForProvider(prompt: StablePrompt): string {
    const allSegments = [...prompt.baselineSegments, ...prompt.updates];
    allSegments.sort((a, b) => b.priority - a.priority);

    return allSegments.map(s => s.content).join('\n\n');
  }

  /**
   * Compute fingerprint for baseline stability tracking
   */
  private computeFingerprint(segments: ContextSegment[]): string {
    const content = segments.map(s => `${s.id}:${s.content}`).join('|');
    // Simple hash - real impl would use crypto
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      hash = ((hash << 5) - hash) + content.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  private formatSkills(skills: SkillDefinition[]): string {
    if (skills.length === 0) return '';

    const lines = ['Available learned skills:'];
    for (const skill of skills) {
      lines.push(`- ${skill.name}: ${skill.description} (confidence: ${skill.confidence.toFixed(2)})`);
    }
    return lines.join('\n');
  }

  private formatMemories(context: MemoryContext): string {
    const lines = ['Recent context:'];

    // Limit to most recent 10 memories
    const recent = context.relevantMemories.slice(0, 10);

    for (const memory of recent) {
      const timestamp = new Date(memory.timestamp).toISOString();
      lines.push(`[${timestamp}] ${memory.type}: ${memory.content.slice(0, 100)}`);
    }

    return lines.join('\n');
  }

  /**
   * Check if baseline needs rebuild (skill learned, session changed)
   */
  shouldRebuildBaseline(currentSkillCount: number, lastSkillCount: number): boolean {
    return currentSkillCount !== lastSkillCount;
  }

  /**
   * Get cache hit rate metrics
   */
  getCacheMetrics(): { baselineStable: boolean; fingerprint: string | null } {
    return {
      baselineStable: this.baselineFingerprint !== null,
      fingerprint: this.baselineFingerprint
    };
  }
}
