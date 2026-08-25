import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, Server } from 'http';
import { AgentRuntime } from '../../hemmers/core/runtime/agent.js';
import { SecurityEngine } from '../../hemmers/core/security/engine.js';

describe('Integration: Agent Runtime Loop & Execution', () => {
  let server: Server;
  let port: number;
  let baseUrl: string;
  let callCount = 0;

  before(async () => {
    const { promise, resolve } = Promise.withResolvers<void>();
    server = createServer((req, res) => {
      let body = '';
      req.on('data', chunk => {
        body += chunk;
      });

      req.on('end', () => {
        callCount++;
        const parsed = JSON.parse(body);

        // Turn 1: request tool call 'getCurrentDirectory'
        if (callCount === 1) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              id: 'msg_1',
              content: [
                { type: 'text', text: 'Checking current directory...' },
                { type: 'tool_use', id: 'call_101', name: 'listDirectory', input: { path: '.' } }
              ],
              stop_reason: 'tool_use',
              usage: { input_tokens: 20, output_tokens: 15 }
            })
          );
        } else {
          // Turn 2: complete final response based on tool results
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              id: 'msg_2',
              content: [{ type: 'text', text: 'Files have been listed successfully.' }],
              stop_reason: 'end_turn',
              usage: { input_tokens: 30, output_tokens: 20 }
            })
          );
        }
      });
    });

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      port = typeof addr === 'object' && addr ? addr.port : 8001;
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

  it('completes multi-turn agent loop with tool execution and memory persistence', async () => {
    callCount = 0;

    const runtime = new AgentRuntime({
      provider: 'anthropic',
      model: 'claude-3-5-sonnet',
      apiKey: 'test-key',
      baseUrl,
      enableTools: true,
      systemPrompt: 'You are an automated coding assistant.'
    });

    const turn = await runtime.executeTurn('Please list the current directory files.');

    assert.equal(turn.userMessage, 'Please list the current directory files.');
    assert.equal(turn.assistantMessage, 'Files have been listed successfully.');
    assert.ok(turn.toolCalls && turn.toolCalls.length > 0);
    assert.equal(turn.toolCalls[0].name, 'listDirectory');
    assert.ok(turn.toolResults);
    assert.ok(turn.tokensUsed > 0);

    // Verify turn was persisted to SQLite memory
    const memories = runtime.getMemoryStore().getMemories(runtime.getSessionId());
    assert.ok(memories.length >= 4);

    runtime.close();
  });
});
