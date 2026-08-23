/**
 * High-level memory query API for agent runtime
 * Provides Hermès-style memory operations
 */

import { MemoryStore, MemoryEntry, Session } from './memory-store';

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
  }): Promise<MemoryContext> {
    this.store.updateSessionAccess(sessionId);

    // Get recent memories from current session
    const recent = this.store.getMemories(sessionId, {
      limit: options?.recentLimit || 20
    });

    // Search across all sessions for relevant context
    const searched = currentInput.length > 10
      ? this.store.searchMemories(currentInput, {
          limit: options?.searchLimit || 5
        })
      : [];

    // Combine and deduplicate
    const memoryMap = new Map<string, MemoryEntry>();
    [...recent, ...searched].forEach(m => memoryMap.set(m.id, m));

    // Get session ancestry for lineage
    const ancestry = this.store.getSessionAncestry(sessionId);

    return {
      currentSessionId: sessionId,
      relevantMemories: Array.from(memoryMap.values()),
      sessionHistory: ancestry
    };
  }

  /**
   * Record agent turn in memory
   */
  recordTurn(sessionId: string, userInput: string, agentResponse: string): void {
    this.store.addMemory({
      sessionId,
      type: 'user_input',
      content: userInput
    });

    this.store.addMemory({
      sessionId,
      type: 'agent_response',
      content: agentResponse
    });
  }

  /**
   * Record tool execution in memory with lineage
   */
  recordToolExecution(
    sessionId: string,
    toolName: string,
    args: any,
    result: any,
    parentId?: string,
    success: boolean = true,
    duration: number = 0
  ): string {
    const callEntry = this.store.addMemory({
      sessionId,
      type: 'tool_call',
      content: `${toolName}(${JSON.stringify(args)})`,
      metadata: { toolName, args, success, duration },
      parentId
    });

    const resultEntry = this.store.addMemory({
      sessionId,
      type: 'tool_result',
      content: JSON.stringify(result),
      metadata: { toolName, result, success, duration },
      parentId: callEntry.id
    });

    return resultEntry.id;
  }

  /**
   * Record learned skill pattern
   */
  recordSkillLearned(sessionId: string, skillName: string, pattern: any): void {
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
  findSimilarToolExecutions(toolName: string, args: any, limit: number = 5): MemoryEntry[] {
    const query = `${toolName} ${JSON.stringify(args)}`;
    return this.store.searchMemories(query, {
      type: 'tool_call',
      limit
    });
  }

  /**
   * Get all learned skills
   */
  getLearnedSkills(limit?: number): MemoryEntry[] {
    return this.store.searchMemories('Learned skill', {
      type: 'skill_learned',
      limit: limit || 100
    });
  }
}
