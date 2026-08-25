/**
 * Model Provider Interface
 * Universal abstraction for LLM providers (Anthropic, OpenAI, Google, Ollama)
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
  signal?: AbortSignal;
  timeout?: number;
}

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
  toolCalls?: ToolCall[];
  name?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: string; // JSON string
}

export interface ToolResult {
  toolCallId: string;
  result: unknown;
  error?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface GenerateRequest {
  messages: Message[];
  system?: string;
  tools?: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  signal?: AbortSignal;
}

export interface GenerateResponse {
  content: string;
  toolCalls?: ToolCall[];
  finishReason: 'stop' | 'tool_calls' | 'length' | 'content_filter' | 'error';
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface StreamChunk {
  delta: string;
  toolCalls?: ToolCall[];
  done: boolean;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Executes a network call with exponential backoff retry for transient errors
 */
export async function executeWithRetry<T>(
  fn: () => Promise<T>,
  options?: { maxRetries?: number; baseDelayMs?: number; signal?: AbortSignal }
): Promise<T> {
  const maxRetries = options?.maxRetries ?? 3;
  const baseDelayMs = options?.baseDelayMs ?? 300;
  const signal = options?.signal;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (signal?.aborted) {
      throw new Error('Operation aborted');
    }

    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const isRetryable =
        error instanceof Error &&
        (error.message.includes('429') ||
          error.message.includes('500') ||
          error.message.includes('502') ||
          error.message.includes('503') ||
          error.message.includes('504') ||
          error.message.includes('ECONNRESET') ||
          error.message.includes('ETIMEDOUT') ||
          error.message.includes('fetch failed'));

      if (attempt === maxRetries || !isRetryable) {
        throw error;
      }

      const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 100;
      await new Promise(r => setTimeout(r, delay));
    }
  }

  throw lastError;
}

export abstract class ModelProvider {
  abstract readonly id: string;
  abstract readonly name: string;

  /**
   * Get provider capabilities for specific model
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
   * Check if provider is available (API key set, local server running, etc.)
   */
  abstract isAvailable(): Promise<boolean>;

  /**
   * List available models for this provider
   */
  abstract listModels(): Promise<string[]>;
}
