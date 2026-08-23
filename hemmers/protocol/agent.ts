/**
 * Universal Agent Protocol
 * Standard interface for integrating any AI coding agent with Hemmers
 */

export interface AgentCapability {
  id: string;
  name: string;
  description: string;
  version: string;
}

export interface AgentMetadata {
  id: string;
  name: string;
  version: string;
  vendor: string;
  capabilities: AgentCapability[];
  contextWindow?: number;
  supportsStreaming: boolean;
  supportsTools: boolean;
  supportsMemory: boolean;
}

export interface AgentMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  metadata?: Record<string, any>;
}

export interface AgentRequest {
  sessionId: string;
  messages: AgentMessage[];
  tools?: AgentToolDefinition[];
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
}

export interface AgentResponse {
  content: string;
  toolCalls?: AgentToolCall[];
  metadata?: {
    tokensUsed?: number;
    modelUsed?: string;
    finishReason?: string;
  };
}

export interface AgentToolDefinition {
  name: string;
  description: string;
  schema: Record<string, any>;
}

export interface AgentToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export interface AgentSession {
  id: string;
  createdAt: number;
  lastActiveAt: number;
  metadata?: Record<string, any>;
}

/**
 * Universal Agent Interface
 * Any AI agent must implement this to integrate with Hemmers
 */
export interface IAgent {
  /**
   * Get agent metadata
   */
  getMetadata(): AgentMetadata;

  /**
   * Initialize agent with configuration
   */
  initialize(config: Record<string, any>): Promise<void>;

  /**
   * Create new session
   */
  createSession(parentSessionId?: string): Promise<AgentSession>;

  /**
   * Send request to agent
   */
  request(request: AgentRequest): Promise<AgentResponse>;

  /**
   * Stream response from agent
   */
  requestStream(request: AgentRequest): AsyncGenerator<string, AgentResponse, unknown>;

  /**
   * Execute tool
   */
  executeTool(toolName: string, args: Record<string, any>): Promise<any>;

  /**
   * Register external tool
   */
  registerTool(tool: AgentToolDefinition): Promise<void>;

  /**
   * Get session history
   */
  getSessionHistory(sessionId: string): Promise<AgentMessage[]>;

  /**
   * Clear session
   */
  clearSession(sessionId: string): Promise<void>;

  /**
   * Shutdown agent
   */
  shutdown(): Promise<void>;
}

/**
 * Agent Adapter
 * Wraps external agents to implement Universal Protocol
 */
export abstract class AgentAdapter implements IAgent {
  protected config: Record<string, any> = {};

  abstract getMetadata(): AgentMetadata;
  abstract initialize(config: Record<string, any>): Promise<void>;
  abstract createSession(parentSessionId?: string): Promise<AgentSession>;
  abstract request(request: AgentRequest): Promise<AgentResponse>;
  abstract requestStream(request: AgentRequest): AsyncGenerator<string, AgentResponse, unknown>;
  abstract executeTool(toolName: string, args: Record<string, any>): Promise<any>;
  abstract registerTool(tool: AgentToolDefinition): Promise<void>;
  abstract getSessionHistory(sessionId: string): Promise<AgentMessage[]>;
  abstract clearSession(sessionId: string): Promise<void>;
  abstract shutdown(): Promise<void>;

  /**
   * Helper: Check if capability is supported
   */
  hasCapability(capabilityId: string): boolean {
    const metadata = this.getMetadata();
    return metadata.capabilities.some(cap => cap.id === capabilityId);
  }
}

/**
 * Agent Registry
 * Central registry for all connected agents
 */
export class AgentRegistry {
  private agents: Map<string, IAgent> = new Map();

  /**
   * Register an agent
   */
  register(agent: IAgent): void {
    const metadata = agent.getMetadata();
    this.agents.set(metadata.id, agent);
  }

  /**
   * Get agent by ID
   */
  get(id: string): IAgent | undefined {
    return this.agents.get(id);
  }

  /**
   * List all agents
   */
  list(): IAgent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Find agents by capability
   */
  findByCapability(capabilityId: string): IAgent[] {
    return this.list().filter(agent => {
      const metadata = agent.getMetadata();
      return metadata.capabilities.some(cap => cap.id === capabilityId);
    });
  }

  /**
   * Unregister agent
   */
  async unregister(id: string): Promise<void> {
    const agent = this.agents.get(id);
    if (agent) {
      await agent.shutdown();
      this.agents.delete(id);
    }
  }

  /**
   * Shutdown all agents
   */
  async shutdownAll(): Promise<void> {
    for (const agent of this.agents.values()) {
      await agent.shutdown();
    }
    this.agents.clear();
  }
}

/**
 * Global agent registry instance
 */
export const agentRegistry = new AgentRegistry();
