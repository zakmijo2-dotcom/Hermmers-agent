/**
 * Model Provider Interface
 * Universal abstraction for LLM providers (OpenAI, Anthropic, Google, etc.)
 */

export interface ModelCapabilities {
  streaming: boolean;
  toolCalling: boolean;
  vision: boolean;
  reasoning: boolean;
  contextWindow: number;
  maxOutputTokens: number;
  supportedFormats: string[];
}

export interface ModelConfig {
  provider: string;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stopSequences?: string[];
}

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: string; // JSON string
}

export interface ToolResult {
  toolCallId: string;
  result: string;
}

export interface GenerateRequest {
  messages: Message[];
  tools?: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>; // JSON Schema
}

export interface GenerateResponse {
  content: string;
  toolCalls?: ToolCall[];
  finishReason: 'stop' | 'length' | 'tool_calls' | 'error';
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface StreamChunk {
  delta: string;
  toolCall?: Partial<ToolCall>;
  done: boolean;
}

export abstract class ModelProvider {
  abstract readonly id: string;
  abstract readonly name: string;

  /**
   * Get capabilities of a specific model
   */
  abstract getCapabilities(model: string): ModelCapabilities;

  /**
   * Generate completion
   */
  abstract generate(request: GenerateRequest, config: ModelConfig): Promise<GenerateResponse>;

  /**
   * Generate streaming completion
   */
  abstract generateStream(
    request: GenerateRequest,
    config: ModelConfig
  ): AsyncGenerator<StreamChunk, void, unknown>;

  /**
   * Check if provider is available
   */
  abstract isAvailable(): Promise<boolean>;

  /**
   * List available models
   */
  abstract listModels(): Promise<string[]>;
}
