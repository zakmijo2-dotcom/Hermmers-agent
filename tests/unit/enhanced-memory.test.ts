import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  EnhancedMemoryStore,
  MemoryScope,
  MemoryType
} from '../../hemmers/core/memory/enhanced-store.js';

describe('Memory: EnhancedMemoryStore', () => {
  it('stores and retrieves memories by scope and importance', () => {
    const enhanced = new EnhancedMemoryStore(':memory:');
    const sessionId = 'test-session';

    enhanced.addMemory({
      sessionId,
      scope: MemoryScope.PROJECT,
      type: MemoryType.SEMANTIC,
      content: 'Project uses TypeScript and Node.js',
      importance: 0.9,
      confidence: 1.0
    });

    enhanced.addMemory({
      sessionId,
      scope: MemoryScope.SESSION,
      type: MemoryType.WORKING,
      content: 'Current task is fixing test suite',
      importance: 0.3,
      confidence: 0.8
    });

    const projectMemories = enhanced.getByScope(MemoryScope.PROJECT);
    assert.equal(projectMemories.length, 1);
    assert.equal(projectMemories[0].content, 'Project uses TypeScript and Node.js');

    const highImportance = enhanced.getByImportance(0.8);
    assert.equal(highImportance.length, 1);
    assert.equal(highImportance[0].importance, 0.9);
  });

  it('updates memory importance', () => {
    const enhanced = new EnhancedMemoryStore(':memory:');
    const m = enhanced.addMemory({
      sessionId: 's1',
      scope: MemoryScope.SESSION,
      type: MemoryType.USER,
      content: 'User prefers concise output',
      importance: 0.5,
      confidence: 1.0
    });

    enhanced.updateImportance(m.id, 0.2);
    const updated = enhanced.getByImportance(0.6);
    assert.equal(updated.length, 1);
    assert.equal(updated[0].importance, 0.7);
  });

  it('expires old memories based on timestamp', () => {
    const enhanced = new EnhancedMemoryStore(':memory:');
    const now = Date.now();

    enhanced.addMemory({
      sessionId: 's1',
      scope: MemoryScope.SESSION,
      type: MemoryType.WORKING,
      content: 'Expired temporary memo',
      importance: 0.2,
      confidence: 1.0,
      expiresAt: now - 1000 // already expired
    });

    enhanced.addMemory({
      sessionId: 's1',
      scope: MemoryScope.SESSION,
      type: MemoryType.WORKING,
      content: 'Active memo',
      importance: 0.5,
      confidence: 1.0,
      expiresAt: now + 10000 // valid
    });

    const expiredIds = enhanced.expireOldMemories();
    assert.equal(expiredIds.length, 1);

    const remaining = enhanced.getByScope(MemoryScope.SESSION);
    assert.equal(remaining.length, 1);
    assert.equal(remaining[0].content, 'Active memo');
  });

  it('deduplicates identical memory contents', () => {
    const enhanced = new EnhancedMemoryStore(':memory:');
    enhanced.addMemory({
      sessionId: 's1',
      scope: MemoryScope.SESSION,
      type: MemoryType.SEMANTIC,
      content: 'Always format with tabs',
      importance: 0.5,
      confidence: 1.0
    });

    enhanced.addMemory({
      sessionId: 's1',
      scope: MemoryScope.SESSION,
      type: MemoryType.SEMANTIC,
      content: 'Always format with tabs',
      importance: 0.5,
      confidence: 1.0
    });

    const deleted = enhanced.deduplicate('s1');
    assert.equal(deleted.length, 1);
    assert.equal(enhanced.getByScope(MemoryScope.SESSION).length, 1);
  });

  it('detects contradictory memories', () => {
    const enhanced = new EnhancedMemoryStore(':memory:');
    enhanced.addMemory({
      sessionId: 's1',
      scope: MemoryScope.SESSION,
      type: MemoryType.USER,
      content: 'Always prefer tabs for indentation in code',
      importance: 0.8,
      confidence: 1.0
    });

    enhanced.addMemory({
      sessionId: 's1',
      scope: MemoryScope.SESSION,
      type: MemoryType.USER,
      content: 'Never use tabs for indentation in code',
      importance: 0.8,
      confidence: 1.0
    });

    const contradictions = enhanced.detectContradictions('s1');
    assert.ok(contradictions.length > 0);
  });

  it('consolidates related memories', () => {
    const enhanced = new EnhancedMemoryStore(':memory:');
    const m1 = enhanced.addMemory({
      sessionId: 's1',
      scope: MemoryScope.SESSION,
      type: MemoryType.SEMANTIC,
      content: 'Server running on port 3000',
      importance: 0.6,
      confidence: 1.0
    });

    const m2 = enhanced.addMemory({
      sessionId: 's1',
      scope: MemoryScope.SESSION,
      type: MemoryType.SEMANTIC,
      content: 'Database running on port 5432',
      importance: 0.8,
      confidence: 1.0
    });

    const res = enhanced.consolidate([m1.id, m2.id]);
    assert.ok(res.consolidatedMemory.content.includes('Server running on port 3000'));
    assert.ok(res.consolidatedMemory.content.includes('Database running on port 5432'));
  });
});
