/**
 * OpenAI Provider
 * Implementation for OpenAI GPT models with canonical message handling
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

export class OpenAIProvider extends ModelProvider {
  readonly id = 'openai';
  readonly name = 'OpenAI';

  private readonly defaultApiUrl = 'https://api.openai.com/v1/chat/completions';

  getCapabilities(model: string): ModelCapabilities {
    const baseCapabilities: ModelCapabilities = {
      streaming: true,
      toolCalling: true,
      vision: true,
      reasoning: false,
      contextWindow: 128000,
      maxOutputTokens: 4096,
      supportedFormats: ['text', 'json']
    };

    if (model.includes('gpt-4o') || model.includes('o1') || model.includes('o3')) {
      return {
        ...baseCapabilities,
        maxOutputTokens: 16384,
        reasoning: model.startsWith('o1') || model.startsWith('o3')
      };
    }

    return baseCapabilities;
  }

  async generate(request: GenerateRequest, config: ModelConfig): Promise<GenerateResponse> {
    const apiKey = config.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API key not found. Set OPENAI_API_KEY environment variable.');
    }

    const messages = this.formatMessages(request);
    const apiUrl = config.baseUrl || this.defaultApiUrl;

    const body: Record<string, unknown> = {
      model: config.model,
      messages,
      temperature: config.temperature ?? request.temperature ?? 0.7,
      max_tokens: config.maxTokens || request.maxTokens || 4096
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
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`
          },
          body: JSON.stringify(body),
          signal: config.signal || request.signal
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
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
    const apiKey = config.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API key not found');
    }

    const messages = this.formatMessages(request);
    const apiUrl = config.baseUrl || this.defaultApiUrl;

    const body: Record<string, unknown> = {
      model: config.model,
      messages,
      temperature: config.temperature ?? request.temperature ?? 0.7,
      max_tokens: config.maxTokens || request.maxTokens || 4096,
      stream: true
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

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(body),
      signal: config.signal || request.signal
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
    }

    if (!response.body) {
      throw new Error('No response body from OpenAI API stream');
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
          if (trimmed.startsWith('data: ')) {
            const dataStr = trimmed.slice(6).trim();
            if (dataStr === '[DONE]') {
              yield { delta: '', done: true };
              return;
            }

            try {
              const parsed = JSON.parse(dataStr) as {
                choices?: Array<{ delta?: { content?: string } }>;
              };
              const contentDelta = parsed.choices?.[0]?.delta?.content;
              if (contentDelta) {
                yield { delta: contentDelta, done: false };
              }
            } catch {
              // ignore partial chunk json errors
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async isAvailable(): Promise<boolean> {
    return !!process.env.OPENAI_API_KEY;
  }

  async listModels(): Promise<string[]> {
    return ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'o1', 'o3-mini'];
  }

  private formatMessages(request: GenerateRequest): Array<Record<string, unknown>> {
    const formatted: Array<Record<string, unknown>> = [];

    // System prompt
    if (request.system) {
      formatted.push({ role: 'system', content: request.system });
    }

    for (const m of request.messages) {
      if (m.role === 'system') {
        formatted.push({ role: 'system', content: m.content });
      } else if (m.role === 'tool') {
        formatted.push({
          role: 'tool',
          tool_call_id: m.toolCallId || 'unknown',
          content: m.content
        });
      } else if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
        formatted.push({
          role: 'assistant',
          content: m.content || null,
          tool_calls: m.toolCalls.map(tc => ({
            id: tc.id,
            type: 'function',
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
    const choices = (data.choices as Array<Record<string, unknown>>) || [];
    const firstChoice = choices[0] || {};
    const message = (firstChoice.message as Record<string, unknown>) || {};
    const content = (message.content as string) || '';

    let toolCalls: ToolCall[] | undefined;
    if (Array.isArray(message.tool_calls)) {
      toolCalls = (message.tool_calls as Array<Record<string, unknown>>).map(tc => {
        const fn = (tc.function as Record<string, string>) || {};
        return {
          id: (tc.id as string) || '',
          name: fn.name || '',
          arguments: fn.arguments || '{}'
        };
      });
    }

    const usage = (data.usage as Record<string, number>) || {};
    const promptTokens = usage.prompt_tokens || 0;
    const completionTokens = usage.completion_tokens || 0;

    return {
      content,
      toolCalls: toolCalls && toolCalls.length > 0 ? toolCalls : undefined,
      finishReason: (firstChoice.finish_reason as GenerateResponse['finishReason']) || 'stop',
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens
      }
    };
  }
}
