/**
 * Google AI Provider (Gemini)
 */

import {
  ModelProvider,
  ModelCapabilities,
  ModelConfig,
  GenerateRequest,
  GenerateResponse,
  StreamChunk
} from './base';

export class GoogleProvider extends ModelProvider {
  readonly id = 'google';
  readonly name = 'Google AI';

  private readonly apiUrl = 'https://generativelanguage.googleapis.com/v1beta';

  getCapabilities(model: string): ModelCapabilities {
    if (model.includes('gemini-pro')) {
      return {
        streaming: true,
        toolCalling: true,
        vision: model.includes('vision'),
        reasoning: false,
        contextWindow: 1000000,
        maxOutputTokens: 8192,
        supportedFormats: ['text', 'json']
      };
    }

    return {
      streaming: true,
      toolCalling: true,
      vision: false,
      reasoning: false,
      contextWindow: 32000,
      maxOutputTokens: 2048,
      supportedFormats: ['text']
    };
  }

  async generate(request: GenerateRequest, config: ModelConfig): Promise<GenerateResponse> {
    const apiKey = config.apiKey || process.env.GOOGLE_API_KEY;
    if (!apiKey) throw new Error('Google API key not found');

    const url = `${this.apiUrl}/models/${config.model}:generateContent?key=${apiKey}`;

    const contents = request.messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));

    const body: any = {
      contents,
      generationConfig: {
        temperature: request.temperature ?? config.temperature ?? 1.0,
        maxOutputTokens: request.maxTokens || config.maxTokens
      }
    };

    if (request.tools) {
      body.tools = [{
        functionDeclarations: request.tools.map(t => ({
          name: t.name,
          description: t.description,
          parameters: t.parameters
        }))
      }];
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`Google API error: ${response.status}`);
    }

    const data = await response.json();
    const candidate = data.candidates[0];

    const content = candidate.content.parts
      .filter((p: any) => p.text)
      .map((p: any) => p.text)
      .join('');

    const toolCalls = candidate.content.parts
      .filter((p: any) => p.functionCall)
      .map((p: any) => ({
        id: `call_${Date.now()}`,
        name: p.functionCall.name,
        arguments: JSON.stringify(p.functionCall.args)
      }));

    return {
      content,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      finishReason: candidate.finishReason === 'STOP' ? 'stop' : 'tool_calls',
      usage: {
        promptTokens: data.usageMetadata?.promptTokenCount || 0,
        completionTokens: data.usageMetadata?.candidatesTokenCount || 0,
        totalTokens: data.usageMetadata?.totalTokenCount || 0
      }
    };
  }

  async *generateStream(request: GenerateRequest, config: ModelConfig): AsyncGenerator<StreamChunk> {
    const apiKey = config.apiKey || process.env.GOOGLE_API_KEY;
    if (!apiKey) throw new Error('Google API key not found');

    const url = `${this.apiUrl}/models/${config.model}:streamGenerateContent?key=${apiKey}`;

    const contents = request.messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents })
    });

    if (!response.ok) throw new Error(`Google API error: ${response.status}`);

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = decoder.decode(value);
      const lines = text.split('\n').filter(Boolean);

      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          const candidate = data.candidates?.[0];
          if (candidate?.content?.parts?.[0]?.text) {
            yield {
              delta: candidate.content.parts[0].text,
              done: false
            };
          }
        } catch {}
      }
    }

    yield { delta: '', done: true };
  }

  async isAvailable(): Promise<boolean> {
    return !!(process.env.GOOGLE_API_KEY);
  }

  async listModels(): Promise<string[]> {
    return [
      'gemini-pro',
      'gemini-pro-vision',
      'gemini-1.5-pro',
      'gemini-1.5-flash'
    ];
  }
}
