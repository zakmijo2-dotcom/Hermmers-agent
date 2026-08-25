/**
 * High-level memory query API for agent runtime
 * Provides Hermès-style memory operations
 */

import { MemoryStore, MemoryEntry, Session } from './store.js';

export interface MemoryContext {
  currentSessionId: string;
  relevantMemories: MemoryEntry[];
  sessionHistory: Session[];
}

export class MemoryInterface {
  constructor(private store: MemoryStore) {}

  /**
   * Load relevant context for current agent turn
   * Combines recent memories + FTS search results
   */
  async loadContext(sessionId: string, currentInput: string, options?: {
    recentLimit?: number;
    searchLimit?: number;
    includeHistory?: boolean;
  }): Promise<MemoryContext> {
    const recentLimit = options?.recentLimit ?? 10;
    const searchLimit = options?.searchLimit ?? 5;
    const includeHistory = options?.includeHistory ?? true;

    // 1. Get recent memories from current session
    const recentMemories = this.store.getMemories(sessionId, {
      limit: recentLimit
    });

    // 2. Search cross-session memories for relevant context (FTS)
    const searchResults = this.store.searchMemories(currentInput, {
      limit: searchLimit
    });

    // 3. Deduplicate (prefer search results that aren't already in recent)
    const recentIds = new Set(recentMemories.map(m => m.id));
    const uniqueSearchResults = searchResults.filter(m => !recentIds.has(m.id));

    // Combine
    const relevantMemories = [...recentMemories, ...uniqueSearchResults];

    // 4. Get session genealogy
    const sessionHistory = includeHistory
      ? this.store.getSessionAncestry(sessionId)
      : [];

    return {
      currentSessionId: sessionId,
      relevantMemories,
      sessionHistory
    };
  }

  /**
   * Record agent turn in memory
   */
  recordTurn(sessionId: string, userInput: string, agentResponse: string): void {
    const userMemory = this.store.addMemory({
      sessionId,
      type: 'user_input',
      content: userInput
    });

    this.store.addMemory({
      sessionId,
      type: 'agent_response',
      content: agentResponse,
      parentId: userMemory.id
    });
  }

  /**
   * Record tool execution in memory with lineage
   */
  recordToolExecution(
    sessionId: string,
    toolName: string,
    args: unknown,
    result: unknown,
    parentId?: string,
    success: boolean = true,
    duration: number = 0
  ): string {
    const callMemory = this.store.addMemory({
      sessionId,
      type: 'tool_call',
      content: `Tool: ${toolName}`,
      metadata: {
        toolName,
        args,
        duration
      },
      parentId
    });

    const resultMemory = this.store.addMemory({
      sessionId,
      type: 'tool_result',
      content: typeof result === 'string' ? result : JSON.stringify(result),
      metadata: {
        toolName,
        success,
        duration
      },
      parentId: callMemory.id
    });

    return resultMemory.id;
  }

  /**
   * Record learned skill pattern
   */
  recordSkillLearned(sessionId: string, skillName: string, pattern: unknown): void {
    this.store.addMemory({
      sessionId,
      type: 'skill_learned',
      content: `Learned skill: ${skillName}`,
      metadata: { skillName, pattern }
    });
  }

  /**
   * Find similar past tool executions (for learning loop)
   */
  findSimilarToolExecutions(toolName: string, args: unknown, limit: number = 5): MemoryEntry[] {
    return this.store.searchMemories(toolName, {
      type: 'tool_call',
      limit
    });
  }

  /**
   * Get all learned skills
   */
  getLearnedSkills(limit: number = 50): MemoryEntry[] {
    return this.store.searchMemories('Learned skill', {
      type: 'skill_learned',
      limit
    });
  }

  getStore(): MemoryStore {
    return this.store;
  }
}
