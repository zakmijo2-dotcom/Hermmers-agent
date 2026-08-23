/**
 * Real Agent Runtime
 * Replaces echo placeholder with actual LLM execution
 */

import { ModelProvider, GenerateRequest, Message, ToolCall } from '../providers/base';
import { AnthropicProvider } from '../providers/anthropic';
import { OpenAIProvider } from '../providers/openai';
import { ToolEngine } from '../tools/engine';
import { HookEngine } from '../hooks/engine';
import { ContextEngine, ContextSegment } from '../context/engine';
import { MemoryStore } from '../memory/store';
import { PermissionManager } from '../permissions/manager';
import { randomUUID } from 'crypto';

export interface AgentConfig {
  provider: 'anthropic' | 'openai';
  model: string;
  systemPrompt?: string;
  maxTurns?: number;
  memoryPath?: string;
  enableTools?: boolean;
}

export interface AgentTurn {
  userMessage: string;
  assistantMessage: string;
  toolCalls?: ToolCall[];
  toolResults?: Record<string, any>;
  tokensUsed: number;
}

export class AgentRuntime {
  private provider: ModelProvider;
  private toolEngine: ToolEngine;
  private hookEngine: HookEngine;
  private contextEngine: ContextEngine;
  private memoryStore: MemoryStore;
  private permissionManager: PermissionManager;
  private conversationHistory: Message[] = [];
  private sessionId: string;

  constructor(private config: AgentConfig) {
    // Initialize provider
    this.provider = config.provider === 'anthropic'
      ? new AnthropicProvider()
      : new OpenAIProvider();

    // Initialize subsystems
    this.toolEngine = new ToolEngine();
    this.hookEngine = new HookEngine();
    this.contextEngine = new ContextEngine();
    this.memoryStore = new MemoryStore(config.memoryPath || ':memory:');
    this.permissionManager = new PermissionManager();

    this.sessionId = randomUUID();

    // Add system message
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

    // Add user message
    this.conversationHistory.push({
      role: 'user',
      content: input
    });

    let totalTokens = 0;
    const toolCalls: ToolCall[] = [];
    const toolResults: Record<string, any> = {};

    // Agent loop: LLM → Tool → LLM until done
    let turn = 0;
    const maxTurns = this.config.maxTurns || 10;

    while (turn < maxTurns) {
      turn++;

      // Get available tools
      const tools = this.config.enableTools
        ? this.toolEngine.listAll().map(reg => ({
            name: reg.tool.name,
            description: reg.tool.description,
            parameters: reg.tool.schema.parameters
          }))
        : undefined;

      // Call LLM
      const request: GenerateRequest = {
        messages: this.conversationHistory,
        tools,
        maxTokens: 4096
      };

      const response = await this.provider.generate(request, {
        provider: this.config.provider,
        model: this.config.model
      });

      totalTokens += response.usage.totalTokens;

      // Add assistant response
      this.conversationHistory.push({
        role: 'assistant',
        content: response.content,
        toolCalls: response.toolCalls
      });

      // If no tool calls, we're done
      if (!response.toolCalls || response.toolCalls.length === 0) {
        // Trigger after_prompt hook
        await this.hookEngine.trigger('after_prompt', {
          response: response.content
        }, 'agent');

        // Save to memory
        this.memoryStore.addMemory({
          sessionId: this.sessionId,
          type: 'user_input',
          content: input,
          metadata: {}
        });

        this.memoryStore.addMemory({
          sessionId: this.sessionId,
          type: 'agent_response',
          content: response.content,
          metadata: { tokens: totalTokens }
        });

        return {
          userMessage: input,
          assistantMessage: response.content,
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
          toolResults: Object.keys(toolResults).length > 0 ? toolResults : undefined,
          tokensUsed: totalTokens
        };
      }

      // Execute tool calls
      for (const toolCall of response.toolCalls) {
        toolCalls.push(toolCall);

        // Trigger before_tool hook
        await this.hookEngine.trigger('before_tool', {
          tool: toolCall.name,
          args: toolCall.arguments
        }, 'agent');

        // Check permissions
        const permission = this.permissionManager.check({
          resource: `tool.${toolCall.name}`,
          requester: 'agent'
        });

        if (!permission.allowed) {
          toolResults[toolCall.id] = { error: 'Permission denied' };
          continue;
        }

        // Execute tool
        const result = await this.toolEngine.execute(
          toolCall.name,
          JSON.parse(toolCall.arguments),
          { sessionId: this.sessionId, agent: 'hemmers' }
        );

        toolResults[toolCall.id] = result.success ? result.result : { error: result.error };

        // Trigger after_tool hook
        await this.hookEngine.trigger('after_tool', {
          tool: toolCall.name,
          result: result.success
        }, 'agent');

        // Add tool result to conversation
        this.conversationHistory.push({
          role: 'tool',
          content: JSON.stringify(toolResults[toolCall.id]),
          toolCallId: toolCall.id
        });
      }

      // Continue loop to let LLM process tool results
    }

    throw new Error(`Agent exceeded maximum turns (${maxTurns})`);
  }

  /**
   * Execute with streaming
   */
  async *executeStream(input: string): AsyncGenerator<string, AgentTurn, unknown> {
    this.conversationHistory.push({
      role: 'user',
      content: input
    });

    const request: GenerateRequest = {
      messages: this.conversationHistory,
      stream: true
    };

    let fullResponse = '';
    let totalTokens = 0;

    for await (const chunk of this.provider.generateStream(request, {
      provider: this.config.provider,
      model: this.config.model
    })) {
      if (chunk.done) break;
      fullResponse += chunk.delta;
      yield chunk.delta;
    }

    this.conversationHistory.push({
      role: 'assistant',
      content: fullResponse
    });

    return {
      userMessage: input,
      assistantMessage: fullResponse,
      tokensUsed: totalTokens
    };
  }

  /**
   * Get conversation history
   */
  getHistory(): Message[] {
    return [...this.conversationHistory];
  }

  /**
   * Clear conversation
   */
  clearHistory(): void {
    const systemMessages = this.conversationHistory.filter(m => m.role === 'system');
    this.conversationHistory = systemMessages;
  }

  /**
   * Get session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }
}
