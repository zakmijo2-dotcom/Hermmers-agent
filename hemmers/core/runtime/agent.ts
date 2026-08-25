/**
 * Agent Runtime
 * Production-grade autonomous LLM agent execution with memory, tools, security, and streaming
 */

import {
  ModelProvider,
  GenerateRequest,
  Message,
  ToolCall
} from '../providers/base.js';
import { ProviderFactory, ProviderType } from '../providers/factory.js';
import { ToolEngine } from '../tools/engine.js';
import { standardTools } from '../tools/standard.js';
import { HookEngine } from '../hooks/engine.js';
import { ContextEngine } from '../context/engine.js';
import { MemoryStore } from '../memory/store.js';
import { SecurityEngine } from '../security/engine.js';
import { PermissionManager } from '../permissions/manager.js';

export interface AgentConfig {
  provider: ProviderType;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  maxTurns?: number; // default 10
  maxOutputSize?: number; // default 100,000 characters
  memoryPath?: string;
  enableTools?: boolean;
  workspaceRoot?: string;
  securityEngine?: SecurityEngine;
  permissionManager?: PermissionManager;
}

export interface AgentTurn {
  userMessage: string;
  assistantMessage: string;
  toolCalls?: ToolCall[];
  toolResults?: Record<string, unknown>;
  tokensUsed: number;
  sessionId: string;
}

export class AgentRuntime {
  private provider: ModelProvider;
  private toolEngine: ToolEngine;
  private hookEngine: HookEngine;
  private contextEngine: ContextEngine;
  private memoryStore: MemoryStore;
  private securityEngine: SecurityEngine;
  private permissionManager?: PermissionManager;
  private conversationHistory: Message[] = [];
  private sessionId: string;
  private workspaceRoot: string;

  constructor(private config: AgentConfig) {
    // 1. Initialize provider
    this.provider = ProviderFactory.getProvider(config.provider, { baseUrl: config.baseUrl });

    // 2. Initialize security & permissions
    this.securityEngine = config.securityEngine || new SecurityEngine();
    this.permissionManager = config.permissionManager;

    // 3. Initialize tool engine
    this.toolEngine = new ToolEngine({
      securityEngine: this.securityEngine,
      permissionManager: this.permissionManager
    });

    // Register standard tools by default
    for (const tool of standardTools) {
      this.toolEngine.register(tool);
    }

    // 4. Initialize context & hooks
    this.hookEngine = new HookEngine();
    this.contextEngine = new ContextEngine();

    // 5. Initialize memory & session
    this.memoryStore = new MemoryStore(config.memoryPath || ':memory:');
    const session = this.memoryStore.createSession(undefined, {
      provider: config.provider,
      model: config.model
    });
    this.sessionId = session.id;
    this.workspaceRoot = config.workspaceRoot || process.cwd();

    // 6. Setup initial system message
    if (config.systemPrompt) {
      this.conversationHistory.push({
        role: 'system',
        content: config.systemPrompt
      });
    }
  }

  /**
   * Execute agent turn with real LLM
   */
  async executeTurn(input: string): Promise<AgentTurn> {
    // Trigger before_prompt hook
    await this.hookEngine.trigger('before_prompt', { input }, 'agent');

    // Add user message to conversation history
    this.conversationHistory.push({
      role: 'user',
      content: input
    });

    let totalTokens = 0;
    const turnToolCalls: ToolCall[] = [];
    const turnToolResults: Record<string, unknown> = {};
    const recordedToolExecutions: Array<{
      tool: string;
      args: unknown;
      result: unknown;
      success: boolean;
      duration: number;
    }> = [];

    let turn = 0;
    const maxTurns = this.config.maxTurns || 10;
    const maxOutputSize = this.config.maxOutputSize || 100000;

    let finalAssistantMessage = '';

    while (turn < maxTurns) {
      turn++;

      // Get available tools if enabled
      const tools = this.config.enableTools
        ? this.toolEngine.listAll().map(reg => ({
            name: reg.tool.name,
            description: reg.tool.description,
            parameters: (reg.tool.schema.parameters as Record<string, unknown>) || {}
          }))
        : undefined;

      // Call LLM provider
      const request: GenerateRequest = {
        messages: this.conversationHistory,
        tools,
        maxTokens: this.config.maxTokens || 4096,
        temperature: this.config.temperature ?? 0.7
      };

      const response = await this.provider.generate(request, {
        provider: this.config.provider,
        model: this.config.model,
        apiKey: this.config.apiKey,
        baseUrl: this.config.baseUrl,
        temperature: this.config.temperature,
        maxTokens: this.config.maxTokens
      });

      totalTokens += response.usage.totalTokens;
      finalAssistantMessage = response.content;

      // Truncate output if exceeding max output size
      if (finalAssistantMessage.length > maxOutputSize) {
        finalAssistantMessage = finalAssistantMessage.slice(0, maxOutputSize) + '\n[Output truncated]';
      }

      // Add assistant response to history
      this.conversationHistory.push({
        role: 'assistant',
        content: finalAssistantMessage,
        toolCalls: response.toolCalls
      });

      // If no tool calls, turn is complete
      if (!response.toolCalls || response.toolCalls.length === 0) {
        // Trigger after_prompt hook
        await this.hookEngine.trigger('after_prompt', { response: finalAssistantMessage }, 'agent');

        // Atomically record turn in persistent SQLite database
        this.memoryStore.recordTurnTransaction(this.sessionId, {
          userInput: input,
          assistantResponse: finalAssistantMessage,
          toolExecutions: recordedToolExecutions,
          metadata: { tokens: totalTokens }
        });

        return {
          userMessage: input,
          assistantMessage: finalAssistantMessage,
          toolCalls: turnToolCalls.length > 0 ? turnToolCalls : undefined,
          toolResults: Object.keys(turnToolResults).length > 0 ? turnToolResults : undefined,
          tokensUsed: totalTokens,
          sessionId: this.sessionId
        };
      }

      // Execute each tool call requested by LLM
      for (const toolCall of response.toolCalls) {
        turnToolCalls.push(toolCall);

        // Safe JSON parsing of tool arguments
        let parsedArgs: unknown = {};
        try {
          parsedArgs = JSON.parse(toolCall.arguments);
        } catch {
          parsedArgs = { raw: toolCall.arguments };
        }

        // Trigger before_tool hook
        await this.hookEngine.trigger('before_tool', { tool: toolCall.name, args: parsedArgs }, 'agent');

        const toolStartTime = Date.now();

        // Execute tool via ToolEngine (which enforces SecurityEngine)
        const execResult = await this.toolEngine.execute(
          toolCall.name,
          parsedArgs,
          { sessionId: this.sessionId, agent: 'hemmers' },
          { workspaceRoot: this.workspaceRoot }
        );

        const duration = Date.now() - toolStartTime;
        const toolOutput = execResult.success ? execResult.result : { error: execResult.error };
        turnToolResults[toolCall.id] = toolOutput;

        recordedToolExecutions.push({
          tool: toolCall.name,
          args: parsedArgs,
          result: toolOutput,
          success: execResult.success,
          duration
        });

        // Trigger after_tool hook
        await this.hookEngine.trigger('after_tool', { tool: toolCall.name, success: execResult.success }, 'agent');

        // Add tool result to conversation history
        this.conversationHistory.push({
          role: 'tool',
          name: toolCall.name,
          content: typeof toolOutput === 'string' ? toolOutput : JSON.stringify(toolOutput),
          toolCallId: toolCall.id
        });
      }
    }

    throw new Error(`Agent exceeded maximum turn limit of ${maxTurns}`);
  }

  /**
   * Execute with streaming
   */
  async *executeStream(input: string): AsyncGenerator<string, AgentTurn, unknown> {
    await this.hookEngine.trigger('before_prompt', { input }, 'agent');

    this.conversationHistory.push({
      role: 'user',
      content: input
    });

    const request: GenerateRequest = {
      messages: this.conversationHistory,
      stream: true,
      maxTokens: this.config.maxTokens || 4096,
      temperature: this.config.temperature ?? 0.7
    };

    let fullResponse = '';
    let totalTokens = 0;

    for await (const chunk of this.provider.generateStream(request, {
      provider: this.config.provider,
      model: this.config.model,
      apiKey: this.config.apiKey,
      baseUrl: this.config.baseUrl
    })) {
      if (chunk.done) break;
      fullResponse += chunk.delta;
      yield chunk.delta;
    }

    this.conversationHistory.push({
      role: 'assistant',
      content: fullResponse
    });

    await this.hookEngine.trigger('after_prompt', { response: fullResponse }, 'agent');

    // Save to memory
    this.memoryStore.recordTurnTransaction(this.sessionId, {
      userInput: input,
      assistantResponse: fullResponse,
      metadata: { tokens: totalTokens }
    });

    return {
      userMessage: input,
      assistantMessage: fullResponse,
      tokensUsed: totalTokens,
      sessionId: this.sessionId
    };
  }

  /**
   * Get conversation history
   */
  getHistory(): Message[] {
    return [...this.conversationHistory];
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.conversationHistory = [];
    if (this.config.systemPrompt) {
      this.conversationHistory.push({
        role: 'system',
        content: this.config.systemPrompt
      });
    }
  }

  /**
   * Get session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Get tool engine
   */
  getToolEngine(): ToolEngine {
    return this.toolEngine;
  }

  /**
   * Get memory store
   */
  getMemoryStore(): MemoryStore {
    return this.memoryStore;
  }

  /**
   * Get security engine
   */
  getSecurityEngine(): SecurityEngine {
    return this.securityEngine;
  }

  /**
   * Close memory and resources
   */
  close(): void {
    this.memoryStore.close();
  }
}
