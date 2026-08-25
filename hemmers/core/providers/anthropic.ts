/**
 * Anthropic Provider
 * Implementation for Claude models with canonical message handling and schema validation
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

export class AnthropicProvider extends ModelProvider {
  readonly id = 'anthropic';
  readonly name = 'Anthropic';

  private readonly defaultApiUrl = 'https://api.anthropic.com/v1/messages';

  getCapabilities(model: string): ModelCapabilities {
    const baseCapabilities: ModelCapabilities = {
      streaming: true,
      toolCalling: true,
      vision: true,
      reasoning: false,
      contextWindow: 200000,
      maxOutputTokens: 4096,
      supportedFormats: ['text', 'json']
    };

    if (model.includes('claude-3-5-sonnet') || model.includes('claude-3-7-sonnet')) {
      return {
        ...baseCapabilities,
        maxOutputTokens: 8192,
        reasoning: true
      };
    }

    if (model.includes('claude-3-opus')) {
      return {
        ...baseCapabilities,
        contextWindow: 200000
      };
    }

    return baseCapabilities;
  }

  async generate(request: GenerateRequest, config: ModelConfig): Promise<GenerateResponse> {
    const apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('Anthropic API key not found. Set ANTHROPIC_API_KEY environment variable.');
    }

    const { system, messages, tools } = this.formatRequest(request);
    const apiUrl = config.baseUrl || this.defaultApiUrl;

    const body: Record<string, unknown> = {
      model: config.model,
      messages,
      max_tokens: config.maxTokens || request.maxTokens || 4096,
      temperature: config.temperature ?? request.temperature ?? 0.7
    };

    if (system) {
      body.system = system;
    }

    if (tools && tools.length > 0) {
      body.tools = tools;
    }

    return executeWithRetry(
      async () => {
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify(body),
          signal: config.signal || request.signal
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Anthropic API error (${response.status}): ${errorText}`);
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
    const apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('Anthropic API key not found');
    }

    const { system, messages, tools } = this.formatRequest(request);
    const apiUrl = config.baseUrl || this.defaultApiUrl;

    const body: Record<string, unknown> = {
      model: config.model,
      messages,
      max_tokens: config.maxTokens || request.maxTokens || 4096,
      temperature: config.temperature ?? request.temperature ?? 0.7,
      stream: true
    };

    if (system) {
      body.system = system;
    }

    if (tools && tools.length > 0) {
      body.tools = tools;
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(body),
      signal: config.signal || request.signal
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic API error (${response.status}): ${errorText}`);
    }

    if (!response.body) {
      throw new Error('No response body from Anthropic API stream');
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
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6).trim();
            if (!dataStr || dataStr === '[DONE]') continue;

            try {
              const event = JSON.parse(dataStr) as Record<string, unknown>;
              const type = event.type as string;

              if (type === 'content_block_delta') {
                const delta = event.delta as Record<string, unknown>;
                if (delta?.type === 'text_delta' && typeof delta.text === 'string') {
                  yield {
                    delta: delta.text,
                    done: false
                  };
                }
              } else if (type === 'message_stop') {
                yield {
                  delta: '',
                  done: true
                };
              }
            } catch {
              // ignore parse errors in partial stream data
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async isAvailable(): Promise<boolean> {
    return !!process.env.ANTHROPIC_API_KEY;
  }

  async listModels(): Promise<string[]> {
    return [
      'claude-3-7-sonnet-20250219',
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
      'claude-3-opus-20240229'
    ];
  }

  private formatRequest(request: GenerateRequest): {
    system?: string;
    messages: Array<{ role: string; content: unknown }>;
    tools?: Array<{ name: string; description: string; input_schema: Record<string, unknown> }>;
  } {
    // 1. Extract system messages properly
    const systemParts: string[] = [];
    if (request.system) {
      systemParts.push(request.system);
    }

    for (const m of request.messages) {
      if (m.role === 'system') {
        systemParts.push(m.content);
      }
    }

    const system = systemParts.length > 0 ? systemParts.join('\n\n') : undefined;

    // 2. Format messages with tool calls and tool results properly
    const formattedMessages: Array<{ role: string; content: unknown }> = [];

    for (const m of request.messages) {
      if (m.role === 'system') continue;

      if (m.role === 'tool') {
        // Tool result block
        formattedMessages.push({
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: m.toolCallId || 'unknown',
              content: m.content
            }
          ]
        });
      } else if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
        // Assistant message with tool calls
        const contentBlocks: unknown[] = [];
        if (m.content) {
          contentBlocks.push({ type: 'text', text: m.content });
        }
        for (const tc of m.toolCalls) {
          let inputObj: unknown = {};
          try {
            inputObj = JSON.parse(tc.arguments);
          } catch {
            inputObj = { raw: tc.arguments };
          }
          contentBlocks.push({
            type: 'tool_use',
            id: tc.id,
            name: tc.name,
            input: inputObj
          });
        }
        formattedMessages.push({
          role: 'assistant',
          content: contentBlocks
        });
      } else {
        formattedMessages.push({
          role: m.role,
          content: m.content
        });
      }
    }

    // 3. Format tools
    const tools = request.tools?.map(t => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters
    }));

    return { system, messages: formattedMessages, tools };
  }

  private formatResponse(data: Record<string, unknown>): GenerateResponse {
    const contentBlocks = Array.isArray(data.content) ? (data.content as Array<Record<string, unknown>>) : [];

    const textContent = contentBlocks
      .filter(c => c.type === 'text')
      .map(c => String(c.text || ''))
      .join('');

    const toolCalls: ToolCall[] = contentBlocks
      .filter(c => c.type === 'tool_use')
      .map(c => ({
        id: String(c.id || ''),
        name: String(c.name || ''),
        arguments: JSON.stringify(c.input || {})
      }));

    const usage = (data.usage as Record<string, number>) || {};
    const promptTokens = usage.input_tokens || 0;
    const completionTokens = usage.output_tokens || 0;

    return {
      content: textContent,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      finishReason: data.stop_reason === 'tool_use' ? 'tool_calls' : 'stop',
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens
      }
    };
  }
}
