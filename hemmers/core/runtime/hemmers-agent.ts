/**
 * Hemmers Agent Wrapper
 * Wraps Hemmers runtime to implement Universal Agent Protocol
 */

import {
  IAgent,
  AgentMetadata,
  AgentSession,
  AgentRequest,
  AgentResponse,
  AgentToolDefinition,
  AgentMessage
} from '../../protocol/agent';
import { AgentRuntime } from '../runtime/agent';
import { randomUUID } from 'crypto';

export class HemmersAgent implements IAgent {
  private runtime: AgentRuntime | null = null;
  private sessions: Map<string, AgentRuntime> = new Map();

  getMetadata(): AgentMetadata {
    return {
      id: 'hemmers',
      name: 'Hemmers',
      version: '0.1.0',
      vendor: 'Hemmers',
      capabilities: [
        {
          id: 'memory',
          name: 'Persistent Memory',
          description: 'Cross-session memory with SQLite + FTS5',
          version: '1.0.0'
        },
        {
          id: 'learning',
          name: 'Pattern Learning',
          description: 'Evidence-based skill generation',
          version: '1.0.0'
        },
        {
          id: 'context',
          name: 'Context Intelligence',
          description: 'Token-aware context management',
          version: '1.0.0'
        },
        {
          id: 'tools',
          name: 'Tool Execution',
          description: 'Universal tool system',
          version: '1.0.0'
        }
      ],
      contextWindow: 200000,
      supportsStreaming: true,
      supportsTools: true,
      supportsMemory: true
    };
  }

  async initialize(config: Record<string, any>): Promise<void> {
    this.runtime = new AgentRuntime({
      provider: config.provider || 'anthropic',
      model: config.model || 'claude-opus-5',
      systemPrompt: config.systemPrompt,
      memoryPath: config.memoryPath,
      enableTools: true
    });
  }

  async createSession(parentSessionId?: string): Promise<AgentSession> {
    const sessionId = randomUUID();

    const runtime = new AgentRuntime({
      provider: 'anthropic',
      model: 'claude-opus-5',
      enableTools: true
    });

    this.sessions.set(sessionId, runtime);

    return {
      id: sessionId,
      createdAt: Date.now(),
      lastActiveAt: Date.now()
    };
  }

  async request(request: AgentRequest): Promise<AgentResponse> {
    const runtime = this.sessions.get(request.sessionId) || this.runtime;
    if (!runtime) {
      throw new Error('Agent not initialized');
    }

    const lastUserMessage = request.messages
      .filter(m => m.role === 'user')
      .pop();

    if (!lastUserMessage) {
      throw new Error('No user message in request');
    }

    const turn = await runtime.executeTurn(lastUserMessage.content);

    return {
      content: turn.assistantMessage,
      toolCalls: turn.toolCalls?.map(tc => ({
        id: tc.id,
        name: tc.name,
        arguments: JSON.parse(tc.arguments)
      })),
      metadata: {
        tokensUsed: turn.tokensUsed,
        finishReason: 'stop'
      }
    };
  }

  async *requestStream(request: AgentRequest): AsyncGenerator<string, AgentResponse, unknown> {
    const runtime = this.sessions.get(request.sessionId) || this.runtime;
    if (!runtime) {
      throw new Error('Agent not initialized');
    }

    const lastUserMessage = request.messages
      .filter(m => m.role === 'user')
      .pop();

    if (!lastUserMessage) {
      throw new Error('No user message in request');
    }

    let fullContent = '';

    for await (const chunk of runtime.executeStream(lastUserMessage.content)) {
      fullContent += chunk;
      yield chunk;
    }

    return {
      content: fullContent,
      metadata: {
        finishReason: 'stop'
      }
    };
  }

  async executeTool(toolName: string, args: Record<string, any>): Promise<any> {
    if (!this.runtime) {
      throw new Error('Agent not initialized');
    }

    // Tool execution handled by runtime
    throw new Error('Direct tool execution not supported - use request()');
  }

  async registerTool(tool: AgentToolDefinition): Promise<void> {
    if (!this.runtime) {
      throw new Error('Agent not initialized');
    }

    // Tools registered via ToolEngine
    console.log(`Tool ${tool.name} registration pending`);
  }

  async getSessionHistory(sessionId: string): Promise<AgentMessage[]> {
    const runtime = this.sessions.get(sessionId);
    if (!runtime) {
      throw new Error('Session not found');
    }

    return runtime.getHistory().map(msg => ({
      role: msg.role as any,
      content: msg.content
    }));
  }

  async clearSession(sessionId: string): Promise<void> {
    const runtime = this.sessions.get(sessionId);
    if (runtime) {
      runtime.clearHistory();
    }
  }

  async shutdown(): Promise<void> {
    this.sessions.clear();
    this.runtime = null;
  }
}
