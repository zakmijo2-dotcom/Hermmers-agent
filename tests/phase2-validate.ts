/**
 * Phase 2 validation: Memory persists across runs with FTS
 */

import { AgentRuntime } from '../packages/agent/src/runtime';
import { randomUUID } from 'crypto';
import { existsSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const testDbPath = join(tmpdir(), `mij-test-${randomUUID()}.db`);

async function validatePhase2(): Promise<boolean> {
  console.log('Phase 2 Validation: Persistent Memory System\n');

  try {
    // Test 1: Create session and add memories
    console.log('Test 1: Creating first session...');
    const runtime1 = new AgentRuntime({ memoryPath: testDbPath });
    const session1Id = runtime1.getSessionId();

    await runtime1.executeTurn('What is the capital of France?');
    await runtime1.executeTurn('Tell me about the Eiffel Tower');
    await runtime1.executeTurn('What are some French foods?');

    runtime1.close();
    console.log(`✓ Session ${session1Id} created with 3 turns\n`);

    // Test 2: Load from disk and verify persistence
    console.log('Test 2: Loading session from disk...');
    const runtime2 = new AgentRuntime({
      memoryPath: testDbPath,
      sessionId: session1Id
    });

    const memories = runtime2.getMemoryInterface()['store'].getMemories(session1Id);
    if (memories.length !== 6) { // 3 inputs + 3 responses
      throw new Error(`Expected 6 memories, got ${memories.length}`);
    }
    console.log(`✓ Loaded ${memories.length} memories from disk\n`);

    // Test 3: FTS search across sessions
    console.log('Test 3: Testing FTS search...');
    const searchResults = runtime2.getMemoryInterface()['store'].searchMemories('Eiffel Tower');
    if (searchResults.length === 0) {
      throw new Error('FTS search returned no results');
    }
    console.log(`✓ FTS found ${searchResults.length} results for "Eiffel Tower"\n`);

    // Test 4: Session genealogy
    console.log('Test 4: Testing session genealogy...');
    const runtime3 = new AgentRuntime({
      memoryPath: testDbPath,
      parentSessionId: session1Id
    });
    const session3Id = runtime3.getSessionId();

    await runtime3.executeTurn('Continue our conversation about France');

    const ancestry = runtime3.getMemoryInterface()['store'].getSessionAncestry(session3Id);
    if (ancestry.length !== 2) {
      throw new Error(`Expected 2 sessions in ancestry, got ${ancestry.length}`);
    }
    if (ancestry[1].id !== session1Id) {
      throw new Error('Session genealogy incorrect');
    }
    console.log(`✓ Session genealogy: ${session3Id} → ${session1Id}\n`);

    runtime2.close();
    runtime3.close();

    // Cleanup
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }

    console.log('✅ Phase 2 validation PASSED\n');
    return true;

  } catch (error) {
    console.error('❌ Phase 2 validation FAILED:', error);

    // Cleanup on failure
    try {
      if (existsSync(testDbPath)) {
        unlinkSync(testDbPath);
      }
    } catch {}

    return false;
  }
}

// Run validation
validatePhase2().then(passed => {
  process.exit(passed ? 0 : 1);
});
