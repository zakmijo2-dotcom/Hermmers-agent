/**
 * OpenAI Provider
 */

import {
  ModelProvider,
  ModelCapabilities,
  ModelConfig,
  GenerateRequest,
  GenerateResponse,
  StreamChunk
} from './base';

export class OpenAIProvider extends ModelProvider {
  readonly id = 'openai';
  readonly name = 'OpenAI';

  private readonly apiUrl = 'https://api.openai.com/v1/chat/completions';

  getCapabilities(model: string): ModelCapabilities {
    if (model.includes('gpt-4')) {
      return {
        streaming: true,
        toolCalling: true,
        vision: model.includes('vision'),
        reasoning: model.includes('o1'),
        contextWindow: 128000,
        maxOutputTokens: 4096,
        supportedFormats: ['text', 'json']
      };
    }

    return {
      streaming: true,
      toolCalling: true,
      vision: false,
      reasoning: false,
      contextWindow: 16000,
      maxOutputTokens: 4096,
      supportedFormats: ['text', 'json']
    };
  }

  async generate(request: GenerateRequest, config: ModelConfig): Promise<GenerateResponse> {
    const apiKey = config.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OpenAI API key not found');

    const body: any = {
      model: config.model,
      messages: request.messages,
      temperature: request.temperature ?? config.temperature ?? 1.0,
      max_tokens: request.maxTokens || config.maxTokens
    };

    if (request.tools) {
      body.tools = request.tools.map(t => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters
        }
      }));
    }

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const choice = data.choices[0];

    return {
      content: choice.message.content || '',
      toolCalls: choice.message.tool_calls?.map((tc: any) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: tc.function.arguments
      })),
      finishReason: choice.finish_reason === 'tool_calls' ? 'tool_calls' : 'stop',
      usage: {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens
      }
    };
  }

  async *generateStream(request: GenerateRequest, config: ModelConfig): AsyncGenerator<StreamChunk> {
    const apiKey = config.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OpenAI API key not found');

    const body: any = {
      model: config.model,
      messages: request.messages,
      temperature: request.temperature ?? config.temperature ?? 1.0,
      stream: true
    };

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) throw new Error(`OpenAI API error: ${response.status}`);

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
          const delta = parsed.choices[0]?.delta?.content || '';
          yield { delta, done: false };
        } catch {}
      }
    }
  }

  async isAvailable(): Promise<boolean> {
    return !!(process.env.OPENAI_API_KEY);
  }

  async listModels(): Promise<string[]> {
    return ['gpt-4o', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'];
  }
}
