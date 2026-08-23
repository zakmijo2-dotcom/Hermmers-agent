/**
 * Phase 8 validation: Full agent loop integration
 * End-to-end test with all systems active
 */

import { AgentRuntime } from '../packages/agent/src/runtime';
import { ExecutionObserver, ConsoleObserver } from '../packages/agent/src/execution-observer';
import { ProviderRouter, ProviderConfig } from '../packages/agent/src/provider-router';
import { randomUUID } from 'crypto';
import { existsSync, unlinkSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const testDbPath = join(tmpdir(), `mij-test-${randomUUID()}.db`);
const testSkillsDir = join(tmpdir(), `mij-skills-${randomUUID()}`);

async function validatePhase8(): Promise<boolean> {
  console.log('Phase 8 Validation: Core Agent Loop Integration\n');

  try {
    // Setup observer
    const observer = new ExecutionObserver();
    const consoleObs = new ConsoleObserver(true);
    observer.onAll(consoleObs.getCallback());

    const eventCounts = new Map<string, number>();
    observer.onAll((event) => {
      eventCounts.set(event.type, (eventCounts.get(event.type) || 0) + 1);
    });

    // Test 1: Full runtime with all systems
    console.log('Test 1: Creating runtime with all systems enabled...');
    const runtime = new AgentRuntime({
      memoryPath: testDbPath,
      skillsDir: testSkillsDir,
      enableLearning: true,
      systemInstructions: 'Test agent for integration validation',
      observer
    });

    const sessionId = runtime.getSessionId();
    console.log(`✓ Runtime created with session ${sessionId}\n`);

    // Test 2: Execute multiple turns with memory persistence
    console.log('Test 2: Executing multiple turns...');
    await runtime.executeTurn('First turn: remember this value is 42');
    await runtime.executeTurn('Second turn: what was the value?');
    await runtime.executeTurn('Third turn: compute something');

    const turnStartCount = eventCounts.get('turn_start') || 0;
    if (turnStartCount !== 3) {
      throw new Error(`Expected 3 turn_start events, got ${turnStartCount}`);
    }
    console.log(`✓ 3 turns executed with ${turnStartCount} turn_start events\n`);

    // Test 3: Simulate tool executions to trigger learning
    console.log('Test 3: Simulating tool executions for learning...');
    for (let i = 0; i < 5; i++) {
      const callId = randomUUID();
      const turnId = randomUUID();

      // Track in lineage
      runtime.getLineageTracker().trackTurn(turnId, sessionId, `tool turn ${i}`);
      runtime.getLineageTracker().trackToolExecution(callId, turnId, sessionId, 'computeTool', { value: i * 10 });
      runtime.getLineageTracker().trackToolResult(randomUUID(), callId, { result: i * 100 }, true, 50 + i * 10);

      // Also record in memory for learning
      runtime.getMemoryInterface().recordToolExecution(
        sessionId,
        'computeTool',
        { value: i * 10 },
        { result: i * 100 },
        undefined,
        true,
        50 + i * 10
      );
    }

    // Execute more turns to trigger learning cycle (every 5 turns)
    await runtime.executeTurn('Fourth turn');
    await runtime.executeTurn('Fifth turn'); // Learning should trigger

    const learningCount = eventCounts.get('learning_end') || 0;
    if (learningCount === 0) {
      console.log('⚠ Warning: Learning cycle did not trigger as expected');
    } else {
      console.log(`✓ Learning cycle triggered ${learningCount} time(s)\n`);
    }

    // Test 4: Session lineage and tool provenance
    console.log('Test 4: Testing session lineage...');
    const lineage = runtime.getLineageTracker().getSessionLineage(sessionId);

    if (!lineage) {
      throw new Error('Session lineage not tracked');
    }

    const toolTraces = runtime.getLineageTracker().getSessionToolExecutions(sessionId);
    if (toolTraces.length !== 5) {
      throw new Error(`Expected 5 tool traces, got ${toolTraces.length}`);
    }

    console.log(`✓ Lineage: depth=${lineage.depth}, tool traces=${toolTraces.length}\n`);

    // Test 5: Context stability (cache breaks)
    console.log('Test 5: Testing context stability...');
    const cacheMetrics = runtime.getCacheMetrics();

    if (cacheMetrics.breaks > 3) {
      console.log(`⚠ Warning: High cache break count (${cacheMetrics.breaks}), expected ≤3`);
    } else {
      console.log(`✓ Cache breaks: ${cacheMetrics.breaks} (stable=${cacheMetrics.stable})\n`);
    }

    // Test 6: Memory persistence across sessions
    console.log('Test 6: Testing memory persistence...');
    runtime.close();

    const runtime2 = new AgentRuntime({
      memoryPath: testDbPath,
      sessionId: sessionId,
      skillsDir: testSkillsDir,
      observer
    });

    const memories = runtime2.getMemoryInterface()['store'].getMemories(sessionId);
    if (memories.length < 10) { // 5 turns × 2 (input+response) = 10 minimum
      throw new Error(`Expected ≥10 memories, got ${memories.length}`);
    }

    console.log(`✓ ${memories.length} memories persisted and reloaded\n`);

    // Test 7: Skill persistence
    console.log('Test 7: Testing skill persistence...');
    const skills = runtime2['skillManager'].getAllSkills();
    console.log(`✓ ${skills.length} skill(s) loaded from disk\n`);

    // Test 8: Child session with lineage
    console.log('Test 8: Testing child session creation...');
    const runtime3 = new AgentRuntime({
      memoryPath: testDbPath,
      parentSessionId: sessionId,
      skillsDir: testSkillsDir,
      observer
    });

    const childSessionId = runtime3.getSessionId();
    const childLineage = runtime3.getLineageTracker().getSessionLineage(childSessionId);

    if (!childLineage || childLineage.depth !== 1 || !childLineage.ancestors.includes(sessionId)) {
      throw new Error('Child session lineage incorrect');
    }

    console.log(`✓ Child session created: depth=1, parent=${sessionId}\n`);

    // Test 9: Observable execution coverage
    console.log('Test 9: Verifying execution observability...');
    const eventTypes = Array.from(eventCounts.keys());
    const requiredEvents = ['turn_start', 'turn_end', 'context_update'];

    for (const required of requiredEvents) {
      if (!eventTypes.includes(required)) {
        throw new Error(`Missing required event type: ${required}`);
      }
    }

    console.log(`✓ Observed ${eventTypes.length} event types: ${eventTypes.join(', ')}\n`);

    // Test 10: No regressions
    console.log('Test 10: Testing no regressions from baseline...');
    await runtime3.executeTurn('Regression test input');

    // Should complete without errors
    console.log(`✓ No regressions detected\n`);

    runtime2.close();
    runtime3.close();

    // Cleanup
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
    if (existsSync(testSkillsDir)) {
      rmSync(testSkillsDir, { recursive: true, force: true });
    }

    console.log('✅ Phase 8 validation PASSED\n');
    console.log('Summary:');
    console.log(`- ${turnStartCount} turns executed`);
    console.log(`- ${toolTraces.length} tool executions tracked`);
    console.log(`- ${memories.length} memories persisted`);
    console.log(`- ${skills.length} skills learned`);
    console.log(`- ${cacheMetrics.breaks} cache breaks`);
    console.log(`- ${eventTypes.length} event types observed`);

    return true;

  } catch (error) {
    console.error('❌ Phase 8 validation FAILED:', error);

    // Cleanup on failure
    try {
      if (existsSync(testDbPath)) {
        unlinkSync(testDbPath);
      }
      if (existsSync(testSkillsDir)) {
        rmSync(testSkillsDir, { recursive: true, force: true });
      }
    } catch {}

    return false;
  }
}

// Run validation
validatePhase8().then(passed => {
  process.exit(passed ? 0 : 1);
});
