/**
 * Enhanced Memory Store
 * Implements Scopes, Importance, Deduplication, Contradiction Detection, and Expiration
 */

import { randomUUID } from 'crypto';
import { MemoryStore, MemoryEntry } from './store.js';

export enum MemoryScope {
  GLOBAL = 'global',           // Across all projects
  ORGANIZATION = 'organization', // Organization-wide
  PROJECT = 'project',          // Project-specific
  SESSION = 'session',          // Session-only
  AGENT = 'agent'              // Agent-specific
}

export enum MemoryType {
  WORKING = 'working',         // Short-term working memory
  EPISODIC = 'episodic',       // Event-based memories
  SEMANTIC = 'semantic',        // Knowledge/facts
  PROCEDURAL = 'procedural',    // How-to/skills
  USER = 'user',               // User preferences
  PROJECT = 'project',         // Project context
  AGENT = 'agent'              // Agent-specific
}

export interface EnhancedMemory {
  id: string;
  sessionId: string;
  scope: MemoryScope;
  type: MemoryType;
  content: string;
  importance: number;          // 0-1
  confidence: number;          // 0-1
  timestamp: number;
  expiresAt?: number;
  accessCount: number;
  lastAccessedAt: number;
  metadata?: Record<string, unknown>;
  parentId?: string;
  tags?: string[];
}

export interface MemoryConsolidation {
  originalIds: string[];
  consolidatedMemory: EnhancedMemory;
  reason: string;
}

export class EnhancedMemoryStore {
  private store: MemoryStore;

  constructor(storeOrPath?: MemoryStore | string) {
    if (storeOrPath instanceof MemoryStore) {
      this.store = storeOrPath;
    } else {
      this.store = new MemoryStore(storeOrPath || ':memory:');
    }
  }

  /**
   * Store memory with scope, importance, and confidence
   */
  addMemory(memory: Omit<EnhancedMemory, 'id' | 'timestamp' | 'accessCount' | 'lastAccessedAt'> & { id?: string }): EnhancedMemory {
    const rawEntry = this.store.addMemory({
      sessionId: memory.sessionId,
      type: this.mapTypeToCore(memory.type),
      scope: memory.scope as MemoryEntry['scope'],
      content: memory.content,
      importance: memory.importance,
      confidence: memory.confidence,
      expiresAt: memory.expiresAt,
      metadata: {
        ...memory.metadata,
        enhancedType: memory.type,
        tags: memory.tags || []
      },
      parentId: memory.parentId
    });

    return this.coreToEnhanced(rawEntry);
  }

  /**
   * Retrieve memories by scope
   */
  getByScope(scope: MemoryScope, limit: number = 50): EnhancedMemory[] {
    const all = this.store.exportMemories();
    return all
      .filter(m => m.scope === scope)
      .slice(0, limit)
      .map(m => this.coreToEnhanced(m));
  }

  /**
   * Retrieve by importance threshold
   */
  getByImportance(minImportance: number, limit: number = 50): EnhancedMemory[] {
    const all = this.store.exportMemories();
    return all
      .filter(m => m.importance >= minImportance)
      .sort((a, b) => b.importance - a.importance)
      .slice(0, limit)
      .map(m => this.coreToEnhanced(m));
  }

  /**
   * Update importance based on usage
   */
  updateImportance(memoryId: string, delta: number): void {
    const all = this.store.exportMemories();
    const entry = all.find(m => m.id === memoryId);
    if (!entry) return;

    const newImportance = Math.max(0.0, Math.min(1.0, entry.importance + delta));
    entry.importance = newImportance;
    entry.accessCount = (entry.accessCount || 0) + 1;
    entry.lastAccessedAt = Date.now();

    this.store.importMemories([entry]);
  }

  /**
   * Expire old memories whose expiration time has passed
   */
  expireOldMemories(): string[] {
    const now = Date.now();
    const all = this.store.exportMemories();
    const expiredIds: string[] = [];

    for (const m of all) {
      if (m.expiresAt && m.expiresAt <= now) {
        this.store.deleteMemory(m.id);
        expiredIds.push(m.id);
      }
    }

    return expiredIds;
  }

  /**
   * Deduplicate identical or near-identical memories
   */
  deduplicate(sessionId?: string): string[] {
    const memories = this.store.exportMemories(sessionId);
    const seenContent = new Map<string, string>(); // content -> first id
    const deletedIds: string[] = [];

    for (const m of memories) {
      const normalized = m.content.trim().toLowerCase().replace(/\s+/g, ' ');
      if (seenContent.has(normalized)) {
        this.store.deleteMemory(m.id);
        deletedIds.push(m.id);
      } else {
        seenContent.set(normalized, m.id);
      }
    }

    return deletedIds;
  }

  /**
   * Detect contradictory facts in memory
   */
  detectContradictions(sessionId?: string): Array<{
    memory1: EnhancedMemory;
    memory2: EnhancedMemory;
    reason: string;
  }> {
    const memories = this.store.exportMemories(sessionId).map(m => this.coreToEnhanced(m));
    const contradictions: Array<{ memory1: EnhancedMemory; memory2: EnhancedMemory; reason: string }> = [];

    // Simple semantic contradiction heuristics (e.g. Positive vs negative statements)
    const patterns = [
      { pos: /\b(always|must|enable|enabled|true|love|prefer|use)\b/i, neg: /\b(never|must not|disable|disabled|false|hate|avoid|do not use)\b/i }
    ];

    for (let i = 0; i < memories.length; i++) {
      for (let j = i + 1; j < memories.length; j++) {
        const m1 = memories[i];
        const m2 = memories[j];

        for (const p of patterns) {
          if (
            (p.pos.test(m1.content) && p.neg.test(m2.content)) ||
            (p.neg.test(m1.content) && p.pos.test(m2.content))
          ) {
            // Check if they discuss similar keywords
            const words1 = new Set(m1.content.toLowerCase().split(/\s+/).filter(w => w.length > 4));
            const words2 = new Set(m2.content.toLowerCase().split(/\s+/).filter(w => w.length > 4));
            let common = 0;
            for (const w of words1) {
              if (words2.has(w)) common++;
            }

            if (common >= 1) {
              contradictions.push({
                memory1: m1,
                memory2: m2,
                reason: `Contradictory polarity detected on shared subject words`
              });
            }
          }
        }
      }
    }

    return contradictions;
  }

  /**
   * Consolidate similar memories into a summarized representation
   */
  consolidate(memoryIds: string[]): MemoryConsolidation {
    const all = this.store.exportMemories();
    const targets = all.filter(m => memoryIds.includes(m.id));

    if (targets.length === 0) {
      throw new Error('No memories found matching provided IDs');
    }

    const sessionId = targets[0].sessionId;
    const combinedContent = targets.map(t => t.content).join('; ');
    const avgImportance = targets.reduce((sum, t) => sum + t.importance, 0) / targets.length;

    const consolidated = this.addMemory({
      sessionId,
      scope: (targets[0].scope as MemoryScope) || MemoryScope.SESSION,
      type: MemoryType.SEMANTIC,
      content: `Consolidated memory: ${combinedContent}`,
      importance: avgImportance,
      confidence: 0.9,
      metadata: { consolidatedFrom: memoryIds }
    });

    return {
      originalIds: memoryIds,
      consolidatedMemory: consolidated,
      reason: `Consolidated ${targets.length} related memories`
    };
  }

  /**
   * Get project memories
   */
  getProjectMemories(projectPath?: string): EnhancedMemory[] {
    return this.getByScope(MemoryScope.PROJECT);
  }

  /**
   * Get agent memories
   */
  getAgentMemories(agentId: string): EnhancedMemory[] {
    return this.getByScope(MemoryScope.AGENT);
  }

  /**
   * Get underlying store
   */
  getStore(): MemoryStore {
    return this.store;
  }

  private mapTypeToCore(type: MemoryType): MemoryEntry['type'] {
    switch (type) {
      case MemoryType.USER:
        return 'user_input';
      case MemoryType.AGENT:
        return 'agent_response';
      case MemoryType.PROCEDURAL:
        return 'skill_learned';
      default:
        return 'context';
    }
  }

  private coreToEnhanced(entry: MemoryEntry): EnhancedMemory {
    const meta = entry.metadata || {};
    const tags = Array.isArray(meta.tags) ? (meta.tags as string[]) : [];
    const type = (meta.enhancedType as MemoryType) || MemoryType.SEMANTIC;

    return {
      id: entry.id,
      sessionId: entry.sessionId,
      scope: (entry.scope as MemoryScope) || MemoryScope.SESSION,
      type,
      content: entry.content,
      importance: entry.importance,
      confidence: entry.confidence,
      timestamp: entry.timestamp,
      expiresAt: entry.expiresAt,
      accessCount: entry.accessCount,
      lastAccessedAt: entry.lastAccessedAt,
      metadata: entry.metadata,
      parentId: entry.parentId,
      tags
    };
  }
}
