/**
 * Context Intelligence Engine
 * Token-aware context management with compaction and retrieval
 */

import { MemoryEntry } from '../types/index.js';

export interface ContextSegment {
  id: string;
  type: 'system' | 'memory' | 'skill' | 'instruction' | 'history';
  content: string;
  tokens: number;
  importance: number; // 0-1
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface ContextBudget {
  total: number;
  used: number;
  available: number;
  pressure: number; // 0-1, how close to limit
}

export interface CompactionResult {
  original: ContextSegment[];
  compacted: ContextSegment[];
  tokensSaved: number;
  itemsRemoved: number;
}

export class ContextEngine {
  private readonly DEFAULT_TOKEN_LIMIT = 100000; // 100k tokens
  private readonly HIGH_PRESSURE_THRESHOLD = 0.8; // 80%
  private readonly CRITICAL_PRESSURE_THRESHOLD = 0.95; // 95%

  /**
   * Estimate tokens for text
   * Simple approximation: ~4 chars per token for English
   */
  estimateTokens(text: string): number {
    // More accurate: count words, punctuation, special chars
    const words = text.split(/\s+/).length;
    const chars = text.length;

    // Heuristic: average of word-based and char-based estimates
    const wordEstimate = words * 1.3;
    const charEstimate = chars / 4;

    return Math.ceil((wordEstimate + charEstimate) / 2);
  }

  /**
   * Calculate context budget
   */
  calculateBudget(segments: ContextSegment[], limit: number = this.DEFAULT_TOKEN_LIMIT): ContextBudget {
    const used = segments.reduce((sum, seg) => sum + seg.tokens, 0);
    const available = limit - used;
    const pressure = used / limit;

    return {
      total: limit,
      used,
      available,
      pressure
    };
  }

  /**
   * Check if context is under pressure
   */
  isPressured(budget: ContextBudget): {
    high: boolean;
    critical: boolean;
  } {
    return {
      high: budget.pressure >= this.HIGH_PRESSURE_THRESHOLD,
      critical: budget.pressure >= this.CRITICAL_PRESSURE_THRESHOLD
    };
  }

  /**
   * Score importance of context segment
   */
  scoreImportance(segment: ContextSegment, context: {
    currentTask?: string;
    recentKeywords?: string[];
  }): number {
    let score = 0;

    // Base importance by type
    const typeWeights = {
      system: 1.0,      // Always important
      instruction: 0.9, // Very important
      skill: 0.7,       // Important
      memory: 0.5,      // Context-dependent
      history: 0.3      // Least important
    };

    score += typeWeights[segment.type];

    // Recency bonus (newer = more important)
    const age = Date.now() - segment.timestamp;
    const ageHours = age / (1000 * 60 * 60);
    const recencyBonus = Math.max(0, 0.2 - (ageHours / 100));
    score += recencyBonus;

    // Relevance bonus (if content matches current context)
    if (context.currentTask && segment.content.toLowerCase().includes(context.currentTask.toLowerCase())) {
      score += 0.3;
    }

    if (context.recentKeywords) {
      const matches = context.recentKeywords.filter(kw =>
        segment.content.toLowerCase().includes(kw.toLowerCase())
      ).length;
      score += Math.min(matches * 0.1, 0.2);
    }

    // Metadata-based importance
    if (segment.metadata?.pinned) {
      score += 0.5;
    }

    if (segment.metadata?.critical) {
      score += 0.3;
    }

    return Math.min(score, 1);
  }

  /**
   * Compact context by removing low-importance segments
   */
  compact(
    segments: ContextSegment[],
    targetTokens: number,
    context?: {
      currentTask?: string;
      recentKeywords?: string[];
      preserveTypes?: Array<ContextSegment['type']>;
    }
  ): CompactionResult {
    // Score all segments
    const scored = segments.map(seg => ({
      segment: seg,
      importance: this.scoreImportance(seg, context || {})
    }));

    // Sort by importance (descending)
    scored.sort((a, b) => b.importance - a.importance);

    // Keep segments until we reach target
    const compacted: ContextSegment[] = [];
    let totalTokens = 0;
    const removed: ContextSegment[] = [];

    for (const item of scored) {
      const { segment } = item;

      // Always preserve certain types if specified
      const shouldPreserve = context?.preserveTypes?.includes(segment.type) ||
                            segment.type === 'system';

      if (shouldPreserve || totalTokens + segment.tokens <= targetTokens) {
        compacted.push(segment);
        totalTokens += segment.tokens;
      } else {
        removed.push(segment);
      }
    }

    const originalTokens = segments.reduce((sum, s) => sum + s.tokens, 0);

    return {
      original: segments,
      compacted,
      tokensSaved: originalTokens - totalTokens,
      itemsRemoved: removed.length
    };
  }

  /**
   * Summarize long content to reduce tokens
   */
  summarize(content: string, maxTokens: number): string {
    const currentTokens = this.estimateTokens(content);

    if (currentTokens <= maxTokens) {
      return content;
    }

    // Calculate compression ratio
    const ratio = maxTokens / currentTokens;

    // Simple summarization: take first portion + last portion
    const chars = content.length;
    const keepFirst = Math.floor(chars * ratio * 0.7);
    const keepLast = Math.floor(chars * ratio * 0.3);

    const firstPart = content.slice(0, keepFirst);
    const lastPart = content.slice(-keepLast);

    return `${firstPart}\n\n[... content truncated ...]\n\n${lastPart}`;
  }

  /**
   * Truncate tool output to reasonable size
   */
  truncateToolOutput(output: string, maxTokens: number = 1000): string {
    const tokens = this.estimateTokens(output);

    if (tokens <= maxTokens) {
      return output;
    }

    // Keep first portion and show truncation info
    const ratio = maxTokens / tokens;
    const chars = Math.floor(output.length * ratio);

    return `${output.slice(0, chars)}\n\n[Output truncated: ${tokens} tokens → ${maxTokens} tokens]`;
  }

  /**
   * Retrieve most relevant memories given current context
   */
  retrieveRelevant(
    memories: MemoryEntry[],
    context: {
      query?: string;
      limit?: number;
      maxTokens?: number;
    }
  ): MemoryEntry[] {
    const limit = context.limit || 10;
    const maxTokens = context.maxTokens || 5000;

    // Score memories by relevance
    const scored = memories.map(mem => ({
      memory: mem,
      score: this.scoreMemoryRelevance(mem, context.query)
    }));

    // Sort by score
    scored.sort((a, b) => b.score - a.score);

    // Take top N that fit within token budget
    const selected: MemoryEntry[] = [];
    let totalTokens = 0;

    for (const item of scored) {
      if (selected.length >= limit) break;

      const tokens = this.estimateTokens(item.memory.content);

      if (totalTokens + tokens <= maxTokens) {
        selected.push(item.memory);
        totalTokens += tokens;
      }
    }

    return selected;
  }

  /**
   * Score memory relevance to current query
   */
  private scoreMemoryRelevance(memory: MemoryEntry, query?: string): number {
    let score = 0;

    // Recency (newer = better)
    const age = Date.now() - memory.timestamp;
    const ageHours = age / (1000 * 60 * 60);
    score += Math.max(0, 1 - (ageHours / 168)); // Decay over 1 week

    // Type importance
    const typeScores = {
      user_input: 0.3,
      agent_response: 0.2,
      tool_call: 0.4,
      tool_result: 0.5,
      skill_learned: 0.6,
      context: 0.3
    };
    score += typeScores[memory.type] || 0.2;

    // Query match
    if (query) {
      const contentLower = memory.content.toLowerCase();
      const queryLower = query.toLowerCase();

      if (contentLower.includes(queryLower)) {
        score += 0.5;
      }

      // Keyword matching
      const queryWords = queryLower.split(/\s+/);
      const matches = queryWords.filter(word =>
        word.length > 3 && contentLower.includes(word)
      ).length;

      score += Math.min(matches * 0.1, 0.3);
    }

    return score;
  }

  /**
   * Create context segment from various sources
   */
  createSegment(
    id: string,
    type: ContextSegment['type'],
    content: string,
    importance: number = 0.5,
    metadata?: Record<string, any>
  ): ContextSegment {
    return {
      id,
      type,
      content,
      tokens: this.estimateTokens(content),
      importance,
      timestamp: Date.now(),
      metadata
    };
  }

  /**
   * Get context statistics
   */
  getStats(segments: ContextSegment[]): {
    totalSegments: number;
    totalTokens: number;
    byType: Record<string, { count: number; tokens: number }>;
    avgImportance: number;
  } {
    const byType: Record<string, { count: number; tokens: number }> = {};

    let totalImportance = 0;

    for (const seg of segments) {
      if (!byType[seg.type]) {
        byType[seg.type] = { count: 0, tokens: 0 };
      }

      byType[seg.type].count++;
      byType[seg.type].tokens += seg.tokens;
      totalImportance += seg.importance;
    }

    return {
      totalSegments: segments.length,
      totalTokens: segments.reduce((sum, s) => sum + s.tokens, 0),
      byType,
      avgImportance: segments.length > 0 ? totalImportance / segments.length : 0
    };
  }
}
