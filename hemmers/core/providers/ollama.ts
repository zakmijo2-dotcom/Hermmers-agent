/**
 * Ollama Provider (Local LLMs)
 * Implementation for Ollama chat API with tools and streaming
 */

import {
  ModelProvider,
  ModelCapabilities,
  ModelConfig,
  GenerateRequest,
  GenerateResponse,
  StreamChunk,
  Message,
  ToolCall,
  executeWithRetry
} from './base.js';

export class OllamaProvider extends ModelProvider {
  readonly id = 'ollama';
  readonly name = 'Ollama';

  private defaultBaseUrl: string;

  constructor(baseUrl: string = 'http://localhost:11434') {
    super();
    this.defaultBaseUrl = baseUrl;
  }

  getCapabilities(model: string): ModelCapabilities {
    return {
      streaming: true,
      toolCalling: model.includes('llama3.1') || model.includes('qwen2.5') || model.includes('mistral'),
      vision: model.includes('llava') || model.includes('vision'),
      reasoning: model.includes('deepseek-r1'),
      contextWindow: 32768,
      maxOutputTokens: 4096,
      supportedFormats: ['text', 'json']
    };
  }

  async generate(request: GenerateRequest, config: ModelConfig): Promise<GenerateResponse> {
    const baseUrl = config.baseUrl || this.defaultBaseUrl;
    const url = `${baseUrl}/api/chat`;

    const messages = this.formatMessages(request);

    const body: Record<string, unknown> = {
      model: config.model,
      messages,
      stream: false,
      options: {
        temperature: config.temperature ?? request.temperature ?? 0.7,
        num_predict: config.maxTokens || request.maxTokens || 4096
      }
    };

    if (request.tools && request.tools.length > 0) {
      body.tools = request.tools.map(t => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters
        }
      }));
    }

    return executeWithRetry(
      async () => {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: config.signal || request.signal
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Ollama API error (${response.status}): ${errorText}`);
        }

        const data = (await response.json()) as Record<string, unknown>;
        return this.formatResponse(data);
      },
      { signal: config.signal || request.signal }
    );
  }

  async *generateStream(
    request: GenerateRequest,
    config: ModelConfig
  ): AsyncGenerator<StreamChunk, void, unknown> {
    const baseUrl = config.baseUrl || this.defaultBaseUrl;
    const url = `${baseUrl}/api/chat`;

    const messages = this.formatMessages(request);

    const body: Record<string, unknown> = {
      model: config.model,
      messages,
      stream: true,
      options: {
        temperature: config.temperature ?? request.temperature ?? 0.7,
        num_predict: config.maxTokens || request.maxTokens || 4096
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: config.signal || request.signal
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API error (${response.status}): ${errorText}`);
    }

    if (!response.body) {
      throw new Error('No response body from Ollama API stream');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          try {
            const parsed = JSON.parse(trimmed) as Record<string, unknown>;
            const message = (parsed.message as Record<string, unknown>) || {};
            const content = (message.content as string) || '';
            const isDone = Boolean(parsed.done);

            if (content) {
              yield { delta: content, done: false };
            }

            if (isDone) {
              yield { delta: '', done: true };
              return;
            }
          } catch {
            // ignore partial json chunk error
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.defaultBaseUrl}/api/tags`, {
        signal: AbortSignal.timeout(2000)
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async listModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.defaultBaseUrl}/api/tags`);
      if (!response.ok) return ['llama3.2', 'qwen2.5-coder', 'deepseek-r1'];
      const data = (await response.json()) as { models?: Array<{ name: string }> };
      return data.models?.map(m => m.name) || ['llama3.2', 'qwen2.5-coder'];
    } catch {
      return ['llama3.2', 'qwen2.5-coder'];
    }
  }

  private formatMessages(request: GenerateRequest): Array<Record<string, unknown>> {
    const formatted: Array<Record<string, unknown>> = [];

    if (request.system) {
      formatted.push({ role: 'system', content: request.system });
    }

    for (const m of request.messages) {
      if (m.role === 'system') {
        formatted.push({ role: 'system', content: m.content });
      } else if (m.role === 'tool') {
        formatted.push({
          role: 'tool',
          content: m.content
        });
      } else if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
        formatted.push({
          role: 'assistant',
          content: m.content || '',
          tool_calls: m.toolCalls.map(tc => ({
            function: {
              name: tc.name,
              arguments: tc.arguments
            }
          }))
        });
      } else {
        formatted.push({
          role: m.role,
          content: m.content
        });
      }
    }

    return formatted;
  }

  private formatResponse(data: Record<string, unknown>): GenerateResponse {
    const message = (data.message as Record<string, unknown>) || {};
    const content = (message.content as string) || '';

    let toolCalls: ToolCall[] | undefined;
    if (Array.isArray(message.tool_calls)) {
      toolCalls = (message.tool_calls as Array<Record<string, unknown>>).map(tc => {
        const fn = (tc.function as Record<string, unknown>) || {};
        return {
          id: `call_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          name: (fn.name as string) || '',
          arguments: typeof fn.arguments === 'string' ? fn.arguments : JSON.stringify(fn.arguments || {})
        };
      });
    }

    const promptTokens = (data.prompt_eval_count as number) || 0;
    const completionTokens = (data.eval_count as number) || 0;

    return {
      content,
      toolCalls: toolCalls && toolCalls.length > 0 ? toolCalls : undefined,
      finishReason: toolCalls && toolCalls.length > 0 ? 'tool_calls' : 'stop',
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens
      }
    };
  }
}
