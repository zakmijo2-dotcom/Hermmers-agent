import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AdapterRegistry } from '../../hemmers/adapters/registry.js';
import { ClaudeCodeAdapter } from '../../hemmers/adapters/claude-code/adapter.js';
import { OpenCodeAdapter } from '../../hemmers/adapters/opencode/adapter.js';
import { PiAdapter } from '../../hemmers/adapters/pi/adapter.js';
import { CapabilityScorer } from '../../hemmers/adapters/capabilities.js';

describe('Integration: Adapter Lifecycle & Capabilities', () => {
  it('registers and detects adapters', async () => {
    const registry = new AdapterRegistry();
    registry.register(new ClaudeCodeAdapter());
    registry.register(new OpenCodeAdapter());
    registry.register(new PiAdapter());

    assert.equal(registry.list().length, 3);
    assert.ok(registry.get('claude-code'));
    assert.ok(registry.get('opencode'));
    assert.ok(registry.get('pi'));

    const detections = await registry.detectAll();
    assert.equal(detections.length, 3);
  });

  it('evaluates capability scores correctly', async () => {
    const claudeAdapter = new ClaudeCodeAdapter();
    const caps = await claudeAdapter.capabilities();
    const score = CapabilityScorer.score(caps);

    assert.ok(score >= 0.0 && score <= 1.0);
  });
});
