/**
 * Phase 7 validation: Observable execution with callback-driven progress
 */

import { AgentRuntime } from '../packages/agent/src/runtime';
import { ExecutionObserver, ConsoleObserver, ProgressTracker } from '../packages/agent/src/execution-observer';
import { randomUUID } from 'crypto';
import { existsSync, unlinkSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const testDbPath = join(tmpdir(), `mij-test-${randomUUID()}.db`);
const testSkillsDir = join(tmpdir(), `mij-skills-${randomUUID()}`);

async function validatePhase7(): Promise<boolean> {
  console.log('Phase 7 Validation: Observable Execution Enhancement\n');

  try {
    // Test 1: Event subscription and emission
    console.log('Test 1: Testing event subscription...');
    const observer = new ExecutionObserver();
    const events: any[] = [];

    const unsubTurnStart = observer.on('turn_start', (event) => {
      events.push(event);
    });

    await observer.emit('turn_start', { turnId: 'test-123', input: 'test input' });

    if (events.length !== 1) {
      throw new Error(`Expected 1 event, got ${events.length}`);
    }
    if (events[0].type !== 'turn_start') {
      throw new Error(`Expected turn_start event, got ${events[0].type}`);
    }

    console.log(`✓ Event emitted and received: ${events[0].type}\n`);

    // Test 2: Unsubscribe
    console.log('Test 2: Testing unsubscribe...');
    unsubTurnStart();
    await observer.emit('turn_start', { turnId: 'test-456' });

    if (events.length !== 1) {
      throw new Error('Unsubscribe did not work');
    }

    console.log(`✓ Unsubscribe prevented event (still ${events.length} event)\n`);

    // Test 3: All-event subscription
    console.log('Test 3: Testing all-event subscription...');
    const allEvents: any[] = [];

    observer.onAll((event) => {
      allEvents.push(event);
    });

    await observer.emit('turn_start', {});
    await observer.emit('turn_end', {});
    await observer.emit('skill_applied', {});

    if (allEvents.length !== 3) {
      throw new Error(`Expected 3 events, got ${allEvents.length}`);
    }

    console.log(`✓ All-event subscriber received ${allEvents.length} events\n`);

    // Test 4: Runtime integration
    console.log('Test 4: Testing runtime event emission...');
    const runtimeObserver = new ExecutionObserver();
    const runtimeEvents: any[] = [];

    runtimeObserver.onAll((event) => {
      runtimeEvents.push(event);
    });

    const runtime = new AgentRuntime({
      memoryPath: testDbPath,
      skillsDir: testSkillsDir,
      observer: runtimeObserver,
      enableLearning: false
    });

    await runtime.executeTurn('Test input');

    // Should have turn_start, context_update, turn_end at minimum
    const hasTurnStart = runtimeEvents.some(e => e.type === 'turn_start');
    const hasTurnEnd = runtimeEvents.some(e => e.type === 'turn_end');

    if (!hasTurnStart || !hasTurnEnd) {
      throw new Error(`Missing expected events. Got: ${runtimeEvents.map(e => e.type).join(', ')}`);
    }

    console.log(`✓ Runtime emitted ${runtimeEvents.length} events during turn\n`);

    // Test 5: Progress tracker
    console.log('Test 5: Testing progress tracker...');
    const trackerObserver = new ExecutionObserver();
    const tracker = new ProgressTracker(trackerObserver);
    const progressEvents: any[] = [];

    trackerObserver.on('tool_call_progress', (event) => {
      progressEvents.push(event);
    });

    tracker.startOperation('op-123', 5, 'Test operation');
    tracker.updateProgress('op-123', 1, 'Step 1');
    tracker.updateProgress('op-123', 3, 'Step 3');
    tracker.updateProgress('op-123', 5, 'Step 5');
    tracker.completeOperation('op-123', { success: true });

    if (progressEvents.length !== 3) {
      throw new Error(`Expected 3 progress events, got ${progressEvents.length}`);
    }

    const lastProgress = progressEvents[2];
    if (lastProgress.data.percentage !== 100) {
      throw new Error(`Expected 100% progress, got ${lastProgress.data.percentage}%`);
    }

    console.log(`✓ Progress tracker: ${progressEvents.length} updates, final ${lastProgress.data.percentage}%\n`);

    // Test 6: Console observer formatting
    console.log('Test 6: Testing console observer...');
    const consoleObs = new ConsoleObserver(false);
    const callback = consoleObs.getCallback();

    // Should not throw
    await callback({ type: 'turn_start', timestamp: Date.now(), data: { turnId: 'test', input: 'hi' } });
    await callback({ type: 'tool_call_start', timestamp: Date.now(), data: { operationId: 'op', label: 'Test' } });
    await callback({ type: 'tool_call_end', timestamp: Date.now(), data: { operationId: 'op', label: 'Test' } });
    await callback({ type: 'turn_end', timestamp: Date.now(), data: { turnId: 'test' } });

    console.log(`✓ Console observer formatted events without errors\n`);

    // Test 7: Event filtering by type
    console.log('Test 7: Testing event type filtering...');
    const filterObserver = new ExecutionObserver();
    let toolCallCount = 0;
    let learningCount = 0;

    filterObserver.on('tool_call_start', () => { toolCallCount++; });
    filterObserver.on('learning_start', () => { learningCount++; });

    await filterObserver.emit('tool_call_start', {});
    await filterObserver.emit('tool_call_start', {});
    await filterObserver.emit('learning_start', {});
    await filterObserver.emit('turn_start', {});

    if (toolCallCount !== 2 || learningCount !== 1) {
      throw new Error(`Event filtering failed: tool_call=${toolCallCount}, learning=${learningCount}`);
    }

    console.log(`✓ Event filtering: tool_call=${toolCallCount}, learning=${learningCount}\n`);

    runtime.close();

    // Cleanup
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
    if (existsSync(testSkillsDir)) {
      rmSync(testSkillsDir, { recursive: true, force: true });
    }

    console.log('✅ Phase 7 validation PASSED\n');
    return true;

  } catch (error) {
    console.error('❌ Phase 7 validation FAILED:', error);

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
validatePhase7().then(passed => {
  process.exit(passed ? 0 : 1);
});
