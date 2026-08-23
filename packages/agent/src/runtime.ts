/**
 * Basic agent runtime with memory integration
 * Simplified from OpenCode's event-driven async generator
 */

import { MemoryStore } from './memory-store';
import { MemoryInterface } from './memory-interface';

export interface AgentConfig {
  memoryPath?: string;
  sessionId?: string;
  parentSessionId?: string;
}

export interface AgentTurn {
  input: string;
  response: string;
  sessionId: string;
}

export class AgentRuntime {
  private memoryStore: MemoryStore;
  private memoryInterface: MemoryInterface;
  private sessionId: string;

  constructor(config: AgentConfig = {}) {
    this.memoryStore = new MemoryStore(config.memoryPath || ':memory:');
    this.memoryInterface = new MemoryInterface(this.memoryStore);

    if (config.sessionId) {
      // Resume existing session
      this.sessionId = config.sessionId;
      const session = this.memoryStore.getSession(config.sessionId);
      if (!session) {
        throw new Error(`Session ${config.sessionId} not found`);
      }
    } else {
      // Create new session
      const session = this.memoryStore.createSession(config.parentSessionId);
      this.sessionId = session.id;
    }
  }

  async executeTurn(input: string): Promise<AgentTurn> {
    // Load relevant context from memory
    const context = await this.memoryInterface.loadContext(this.sessionId, input);

    // Placeholder agent logic - real implementation would call LLM here
    const response = `Echo: ${input} (session: ${this.sessionId}, relevant memories: ${context.relevantMemories.length})`;

    // Record turn in memory
    this.memoryInterface.recordTurn(this.sessionId, input, response);

    return {
      input,
      response,
      sessionId: this.sessionId
    };
  }

  getSessionId(): string {
    return this.sessionId;
  }

  getMemoryInterface(): MemoryInterface {
    return this.memoryInterface;
  }

  close(): void {
    this.memoryStore.close();
  }
}
