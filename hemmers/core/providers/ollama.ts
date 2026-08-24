/**
 * Ollama Provider (Local LLMs)
 */

import {
  ModelProvider,
  ModelCapabilities,
  ModelConfig,
  GenerateRequest,
  GenerateResponse,
  StreamChunk
} from './base';

export class OllamaProvider extends ModelProvider {
  readonly id = 'ollama';
  readonly name = 'Ollama';

  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:11434') {
    super();
    this.baseUrl = baseUrl;
  }

  getCapabilities(model: string): ModelCapabilities {
    // Default capabilities for local models
    return {
      streaming: true,
      toolCalling: false, // Most local models don't support tool calling
      vision: model.includes('vision') || model.includes('llava'),
      reasoning: false,
      contextWindow: 4096,
      maxOutputTokens: 2048,
      supportedFormats: ['text']
    };
  }

  async generate(request: GenerateRequest, config: ModelConfig): Promise<GenerateResponse> {
    const url = `${config.baseUrl || this.baseUrl}/api/generate`;

    // Convert messages to prompt
    const prompt = request.messages
      .map(m => {
        if (m.role === 'system') return `System: ${m.content}`;
        if (m.role === 'user') return `User: ${m.content}`;
        return `Assistant: ${m.content}`;
      })
      .join('\n\n');

    const body = {
      model: config.model,
      prompt,
      stream: false,
      options: {
        temperature: request.temperature ?? config.temperature ?? 0.8,
        num_predict: request.maxTokens || config.maxTokens || 2048
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`);
    }

    const data = await response.json();

    return {
      content: data.response,
      finishReason: data.done ? 'stop' : 'length',
      usage: {
        promptTokens: data.prompt_eval_count || 0,
        completionTokens: data.eval_count || 0,
        totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0)
      }
    };
  }

  async *generateStream(request: GenerateRequest, config: ModelConfig): AsyncGenerator<StreamChunk> {
    const url = `${config.baseUrl || this.baseUrl}/api/generate`;

    const prompt = request.messages
      .map(m => {
        if (m.role === 'system') return `System: ${m.content}`;
        if (m.role === 'user') return `User: ${m.content}`;
        return `Assistant: ${m.content}`;
      })
      .join('\n\n');

    const body = {
      model: config.model,
      prompt,
      stream: true,
      options: {
        temperature: request.temperature ?? config.temperature ?? 0.8
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) throw new Error(`Ollama API error: ${response.status}`);

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const data = JSON.parse(line);
          if (data.response) {
            yield {
              delta: data.response,
              done: data.done || false
            };
          }

          if (data.done) {
            return;
          }
        } catch {}
      }
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      return response.ok;
    } catch {
      return false;
    }
  }

  async listModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      if (!response.ok) return [];

      const data = await response.json();
      return data.models?.map((m: any) => m.name) || [];
    } catch {
      return [];
    }
  }
}
