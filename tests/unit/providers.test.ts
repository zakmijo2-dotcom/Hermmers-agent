import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, Server } from 'http';
import { AnthropicProvider } from '../../hemmers/core/providers/anthropic.js';
import { OpenAIProvider } from '../../hemmers/core/providers/openai.js';
import { GoogleProvider } from '../../hemmers/core/providers/google.js';
import { OllamaProvider } from '../../hemmers/core/providers/ollama.js';

describe('Providers: Multi-Provider Canonical Handling with Mock Server', () => {
  let server: Server;
  let port: number;
  let baseUrl: string;

  before(async () => {
    const { promise, resolve } = Promise.withResolvers<void>();
    server = createServer((req, res) => {
      let body = '';
      req.on('data', chunk => {
        body += chunk;
      });

      req.on('end', () => {
        const url = req.url || '';

        // 1. Anthropic mock
        if (url.includes('/anthropic') || url.includes('/v1/messages')) {
          const parsed = JSON.parse(body);
          // Verify system was extracted properly
          assert.ok(parsed.system, 'Anthropic system message must be passed in top-level system field');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              id: 'msg_123',
              content: [
                { type: 'text', text: 'Anthropic response' },
                { type: 'tool_use', id: 'call_1', name: 'readFile', input: { path: 'test.ts' } }
              ],
              stop_reason: 'tool_use',
              usage: { input_tokens: 15, output_tokens: 25 }
            })
          );
          return;
        }

        // 2. OpenAI mock
        if (url.includes('/openai') || url.includes('/v1/chat/completions')) {
          const parsed = JSON.parse(body);
          assert.ok(parsed.messages.some((m: { role: string }) => m.role === 'system'));
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              id: 'chatcmpl_123',
              choices: [
                {
                  message: {
                    role: 'assistant',
                    content: 'OpenAI response',
                    tool_calls: [
                      {
                        id: 'call_2',
                        type: 'function',
                        function: { name: 'listDirectory', arguments: '{"path":"."}' }
                      }
                    ]
                  },
                  finish_reason: 'tool_calls'
                }
              ],
              usage: { prompt_tokens: 20, completion_tokens: 30 }
            })
          );
          return;
        }

        // 3. Google mock
        if (url.includes('generateContent')) {
          const parsed = JSON.parse(body);
          assert.ok(parsed.systemInstruction, 'Google system instruction must be preserved');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              candidates: [
                {
                  content: {
                    parts: [{ text: 'Google response' }]
                  }
                }
              ],
              usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 15 }
            })
          );
          return;
        }

        // 4. Ollama mock
        if (url.includes('/api/chat')) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              message: { role: 'assistant', content: 'Ollama response' },
              prompt_eval_count: 5,
              eval_count: 10
            })
          );
          return;
        }

        res.writeHead(404);
        res.end();
      });
    });

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      port = typeof addr === 'object' && addr ? addr.port : 8000;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });

    return promise;
  });

  after(async () => {
    const { promise, resolve } = Promise.withResolvers<void>();
    server.close(() => resolve());
    return promise;
  });

  it('AnthropicProvider preserves system prompt and parses tool calls', async () => {
    const provider = new AnthropicProvider();
    const res = await provider.generate(
      {
        system: 'You are an expert TypeScript assistant.',
        messages: [{ role: 'user', content: 'Inspect the codebase' }],
        tools: [{ name: 'readFile', description: 'read file', parameters: {} }]
      },
      {
        provider: 'anthropic',
        model: 'claude-3-5-sonnet',
        apiKey: 'test-key',
        baseUrl: `${baseUrl}/anthropic`
      }
    );

    assert.equal(res.content, 'Anthropic response');
    assert.ok(res.toolCalls && res.toolCalls.length > 0);
    assert.equal(res.toolCalls[0].name, 'readFile');
    assert.equal(res.usage.totalTokens, 40);
  });

  it('OpenAIProvider preserves system messages and parses tool calls', async () => {
    const provider = new OpenAIProvider();
    const res = await provider.generate(
      {
        messages: [
          { role: 'system', content: 'System instruction' },
          { role: 'user', content: 'List files' }
        ]
      },
      {
        provider: 'openai',
        model: 'gpt-4o',
        apiKey: 'test-key',
        baseUrl: `${baseUrl}/openai`
      }
    );

    assert.equal(res.content, 'OpenAI response');
    assert.ok(res.toolCalls && res.toolCalls.length > 0);
    assert.equal(res.toolCalls[0].name, 'listDirectory');
  });

  it('GoogleProvider passes systemInstruction and returns content', async () => {
    const provider = new GoogleProvider();
    const res = await provider.generate(
      {
        messages: [
          { role: 'system', content: 'Gemini system prompt' },
          { role: 'user', content: 'Hello Gemini' }
        ]
      },
      {
        provider: 'google',
        model: 'gemini-1.5-pro',
        apiKey: 'test-key',
        baseUrl
      }
    );

    assert.equal(res.content, 'Google response');
    assert.equal(res.usage.totalTokens, 25);
  });

  it('OllamaProvider connects and formats responses', async () => {
    const provider = new OllamaProvider(baseUrl);
    const res = await provider.generate(
      {
        messages: [{ role: 'user', content: 'Hello Ollama' }]
      },
      {
        provider: 'ollama',
        model: 'llama3.2',
        baseUrl
      }
    );

    assert.equal(res.content, 'Ollama response');
    assert.equal(res.usage.totalTokens, 15);
  });
});
