import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { rmSync, existsSync } from 'fs';
import { MemoryStore } from '../../hemmers/core/memory/store.js';

describe('Memory: MemoryStore Persistence & Transactions', () => {
  const dbPath = join(tmpdir(), `hemmers-mem-test-${randomUUID()}.db`);

  it('creates sessions and records memory entries', () => {
    const store = new MemoryStore(dbPath);
    const session = store.createSession(undefined, { purpose: 'testing' });
    assert.ok(session.id);
    assert.equal(session.metadata?.purpose, 'testing');

    const m1 = store.addMemory({
      sessionId: session.id,
      type: 'user_input',
      content: 'What is TypeScript?'
    });

    const m2 = store.addMemory({
      sessionId: session.id,
      type: 'agent_response',
      content: 'TypeScript is a typed superset of JavaScript.',
      parentId: m1.id
    });

    assert.ok(m1.id);
    assert.ok(m2.id);
    assert.equal(m2.parentId, m1.id);

    const memories = store.getMemories(session.id);
    assert.equal(memories.length, 2);

    store.close();
  });

  it('persists data across database restarts and re-opens', () => {
    // Re-open existing database file
    const store = new MemoryStore(dbPath);
    const sessions = store.exportMemories();
    assert.equal(sessions.length, 2);

    const results = store.searchMemories('TypeScript');
    assert.ok(results.length > 0);
    assert.ok(results[0].content.includes('TypeScript'));

    store.close();
  });

  it('records turn transaction atomically', () => {
    const store = new MemoryStore(dbPath);
    const session = store.createSession();

    store.recordTurnTransaction(session.id, {
      userInput: 'Run git status',
      assistantResponse: 'Git status clean',
      toolExecutions: [
        {
          tool: 'gitStatus',
          args: {},
          result: { status: 'clean' },
          success: true,
          duration: 12
        }
      ]
    });

    const memories = store.getMemories(session.id);
    // user_input + tool_call + tool_result + agent_response = 4
    assert.equal(memories.length, 4);
    assert.equal(memories[0].type, 'user_input');
    assert.equal(memories[1].type, 'tool_call');
    assert.equal(memories[2].type, 'tool_result');
    assert.equal(memories[3].type, 'agent_response');

    store.close();
  });

  it('tracks session genealogy and ancestry correctly', () => {
    const store = new MemoryStore(dbPath);
    const parentSession = store.createSession(undefined, { level: 'root' });
    const childSession = store.createSession(parentSession.id, { level: 'child' });
    const grandChildSession = store.createSession(childSession.id, { level: 'grandchild' });

    const ancestry = store.getSessionAncestry(grandChildSession.id);
    assert.equal(ancestry.length, 3);
    assert.equal(ancestry[0].id, grandChildSession.id);
    assert.equal(ancestry[1].id, childSession.id);
    assert.equal(ancestry[2].id, parentSession.id);

    store.close();
  });

  it('enforces foreign key cascading deletion', () => {
    const store = new MemoryStore(dbPath);
    const session = store.createSession();
    store.addMemory({
      sessionId: session.id,
      type: 'user_input',
      content: 'temp memory'
    });

    assert.equal(store.getMemories(session.id).length, 1);
    store.deleteSession(session.id);
    assert.equal(store.getMemories(session.id).length, 0);

    store.close();
    rmSync(dbPath, { force: true });
  });
});
