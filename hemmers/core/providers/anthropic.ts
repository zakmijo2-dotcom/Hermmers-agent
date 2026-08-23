/**
 * Anthropic Provider
 * Implementation for Claude models
 */

import {
  ModelProvider,
  ModelCapabilities,
  ModelConfig,
  GenerateRequest,
  GenerateResponse,
  StreamChunk,
  Message,
  ToolCall
} from './base';

export class AnthropicProvider extends ModelProvider {
  readonly id = 'anthropic';
  readonly name = 'Anthropic';

  private readonly apiUrl = 'https://api.anthropic.com/v1/messages';

  getCapabilities(model: string): ModelCapabilities {
    const baseCapabilities = {
      streaming: true,
      toolCalling: true,
      vision: false,
      reasoning: false,
      supportedFormats: ['text', 'json']
    };

    if (model.includes('claude-3')) {
      return {
        ...baseCapabilities,
        vision: true,
        contextWindow: 200000,
        maxOutputTokens: 4096
      };
    }

    if (model.includes('claude-opus-5')) {
      return {
        ...baseCapabilities,
        vision: true,
        contextWindow: 1000000,
        maxOutputTokens: 8192
      };
    }

    return {
      ...baseCapabilities,
      contextWindow: 100000,
      maxOutputTokens: 4096
    };
  }

  async generate(request: GenerateRequest, config: ModelConfig): Promise<GenerateResponse> {
    const apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('Anthropic API key not found');
    }

    const { messages, tools } = this.formatRequest(request);

    const body: any = {
      model: config.model,
      messages,
      max_tokens: request.maxTokens || config.maxTokens || 4096,
      temperature: request.temperature ?? config.temperature ?? 1.0
    };

    if (tools && tools.length > 0) {
      body.tools = tools;
    }

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${response.status} ${error}`);
    }

    const data = await response.json();

    return this.formatResponse(data);
  }

  async *generateStream(
    request: GenerateRequest,
    config: ModelConfig
  ): AsyncGenerator<StreamChunk, void, unknown> {
    const apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('Anthropic API key not found');
    }

    const { messages, tools } = this.formatRequest(request);

    const body: any = {
      model: config.model,
      messages,
      max_tokens: request.maxTokens || config.maxTokens || 4096,
      temperature: request.temperature ?? config.temperature ?? 1.0,
      stream: true
    };

    if (tools && tools.length > 0) {
      body.tools = tools;
    }

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status}`);
    }

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
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6);
        if (data === '[DONE]') {
          yield { delta: '', done: true };
          return;
        }

        try {
          const parsed = JSON.parse(data);
          if (parsed.type === 'content_block_delta') {
            yield {
              delta: parsed.delta?.text || '',
              done: false
            };
          }
        } catch {}
      }
    }
  }

  async isAvailable(): Promise<boolean> {
    return !!(process.env.ANTHROPIC_API_KEY);
  }

  async listModels(): Promise<string[]> {
    return [
      'claude-opus-5',
      'claude-sonnet-5',
      'claude-3-5-sonnet-20241022',
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307'
    ];
  }

  private formatRequest(request: GenerateRequest): {
    messages: any[];
    tools?: any[];
  } {
    const messages = request.messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
      }));

    const tools = request.tools?.map(t => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters
    }));

    return { messages, tools };
  }

  private formatResponse(data: any): GenerateResponse {
    const content = data.content
      ?.filter((c: any) => c.type === 'text')
      .map((c: any) => c.text)
      .join('') || '';

    const toolCalls: ToolCall[] = data.content
      ?.filter((c: any) => c.type === 'tool_use')
      .map((c: any) => ({
        id: c.id,
        name: c.name,
        arguments: JSON.stringify(c.input)
      })) || [];

    return {
      content,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      finishReason: data.stop_reason === 'tool_use' ? 'tool_calls' : 'stop',
      usage: {
        promptTokens: data.usage?.input_tokens || 0,
        completionTokens: data.usage?.output_tokens || 0,
        totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)
      }
    };
  }
}
