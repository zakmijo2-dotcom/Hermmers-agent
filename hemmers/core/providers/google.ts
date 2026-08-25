/**
 * Google AI Provider (Gemini)
 * Implementation for Google Gemini models with canonical message handling
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

export class GoogleProvider extends ModelProvider {
  readonly id = 'google';
  readonly name = 'Google AI';

  private readonly defaultApiUrl = 'https://generativelanguage.googleapis.com/v1beta';

  getCapabilities(model: string): ModelCapabilities {
    const baseCapabilities: ModelCapabilities = {
      streaming: true,
      toolCalling: true,
      vision: true,
      reasoning: false,
      contextWindow: 1000000,
      maxOutputTokens: 8192,
      supportedFormats: ['text', 'json']
    };

    if (model.includes('gemini-2.0') || model.includes('gemini-1.5-pro')) {
      return {
        ...baseCapabilities,
        contextWindow: 2000000,
        reasoning: model.includes('thinking')
      };
    }

    return baseCapabilities;
  }

  async generate(request: GenerateRequest, config: ModelConfig): Promise<GenerateResponse> {
    const apiKey = config.apiKey || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('Google API key not found. Set GOOGLE_API_KEY or GEMINI_API_KEY environment variable.');
    }

    const { systemInstruction, contents } = this.formatContents(request);
    const baseUrl = config.baseUrl || this.defaultApiUrl;
    const url = `${baseUrl}/models/${config.model}:generateContent?key=${apiKey}`;

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: config.temperature ?? request.temperature ?? 0.7,
        maxOutputTokens: config.maxTokens || request.maxTokens || 4096
      }
    };

    if (systemInstruction) {
      body.systemInstruction = systemInstruction;
    }

    if (request.tools && request.tools.length > 0) {
      body.tools = [
        {
          functionDeclarations: request.tools.map(t => ({
            name: t.name,
            description: t.description,
            parameters: t.parameters
          }))
        }
      ];
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
          throw new Error(`Google API error (${response.status}): ${errorText}`);
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
    const apiKey = config.apiKey || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('Google API key not found');
    }

    const { systemInstruction, contents } = this.formatContents(request);
    const baseUrl = config.baseUrl || this.defaultApiUrl;
    const url = `${baseUrl}/models/${config.model}:streamGenerateContent?alt=sse&key=${apiKey}`;

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: config.temperature ?? request.temperature ?? 0.7,
        maxOutputTokens: config.maxTokens || request.maxTokens || 4096
      }
    };

    if (systemInstruction) {
      body.systemInstruction = systemInstruction;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: config.signal || request.signal
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google API error (${response.status}): ${errorText}`);
    }

    if (!response.body) {
      throw new Error('No response body from Google API stream');
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
            if (!dataStr) continue;

            try {
              const parsed = JSON.parse(dataStr) as Record<string, unknown>;
              const candidates = (parsed.candidates as Array<Record<string, unknown>>) || [];
              const candidate = candidates[0];
              const contentObj = (candidate?.content as Record<string, unknown>) || {};
              const parts = (contentObj.parts as Array<Record<string, unknown>>) || [];

              for (const part of parts) {
                if (typeof part.text === 'string') {
                  yield { delta: part.text, done: false };
                }
              }
            } catch {
              // ignore partial json parsing error
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async isAvailable(): Promise<boolean> {
    return !!(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY);
  }

  async listModels(): Promise<string[]> {
    return ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'];
  }

  private formatContents(request: GenerateRequest): {
    systemInstruction?: { parts: Array<{ text: string }> };
    contents: Array<{ role: string; parts: Array<Record<string, unknown>> }>;
  } {
    const systemParts: string[] = [];
    if (request.system) {
      systemParts.push(request.system);
    }

    for (const m of request.messages) {
      if (m.role === 'system') {
        systemParts.push(m.content);
      }
    }

    const systemInstruction =
      systemParts.length > 0
        ? { parts: systemParts.map(text => ({ text })) }
        : undefined;

    const contents: Array<{ role: string; parts: Array<Record<string, unknown>> }> = [];

    for (const m of request.messages) {
      if (m.role === 'system') continue;

      if (m.role === 'tool') {
        // Function response in Gemini
        contents.push({
          role: 'user',
          parts: [
            {
              functionResponse: {
                name: m.name || 'tool',
                response: { content: m.content }
              }
            }
          ]
        });
      } else if (m.role === 'assistant') {
        const parts: Array<Record<string, unknown>> = [];
        if (m.content) {
          parts.push({ text: m.content });
        }
        if (m.toolCalls && m.toolCalls.length > 0) {
          for (const tc of m.toolCalls) {
            let argsObj: Record<string, unknown> = {};
            try {
              argsObj = JSON.parse(tc.arguments);
            } catch {
              argsObj = { raw: tc.arguments };
            }
            parts.push({
              functionCall: {
                name: tc.name,
                args: argsObj
              }
            });
          }
        }
        contents.push({
          role: 'model',
          parts
        });
      } else {
        contents.push({
          role: 'user',
          parts: [{ text: m.content }]
        });
      }
    }

    return { systemInstruction, contents };
  }

  private formatResponse(data: Record<string, unknown>): GenerateResponse {
    const candidates = (data.candidates as Array<Record<string, unknown>>) || [];
    const candidate = candidates[0] || {};
    const contentObj = (candidate.content as Record<string, unknown>) || {};
    const parts = (contentObj.parts as Array<Record<string, unknown>>) || [];

    const textContent = parts
      .filter(p => typeof p.text === 'string')
      .map(p => p.text as string)
      .join('');

    const toolCalls: ToolCall[] = parts
      .filter(p => p.functionCall && typeof p.functionCall === 'object')
      .map(p => {
        const fc = p.functionCall as Record<string, unknown>;
        return {
          id: `call_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          name: (fc.name as string) || '',
          arguments: JSON.stringify(fc.args || {})
        };
      });

    const usage = (data.usageMetadata as Record<string, number>) || {};
    const promptTokens = usage.promptTokenCount || 0;
    const completionTokens = usage.candidatesTokenCount || 0;

    return {
      content: textContent,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      finishReason: toolCalls.length > 0 ? 'tool_calls' : 'stop',
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens
      }
    };
  }
}
