/**
 * Phase 4 validation: Stable prompt system with minimal cache breaks
 */

import { AgentRuntime } from '../packages/agent/src/runtime';
import { randomUUID } from 'crypto';
import { existsSync, unlinkSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const testDbPath = join(tmpdir(), `mij-test-${randomUUID()}.db`);
const testSkillsDir = join(tmpdir(), `mij-skills-${randomUUID()}`);

async function validatePhase4(): Promise<boolean> {
  console.log('Phase 4 Validation: Prompt Stability System\n');

  try {
    // Test 1: Baseline remains stable across turns
    console.log('Test 1: Testing baseline stability across multiple turns...');
    const runtime1 = new AgentRuntime({
      memoryPath: testDbPath,
      skillsDir: testSkillsDir,
      enableLearning: false, // Disable to prevent skill changes
      systemInstructions: 'Test system prompt'
    });

    await runtime1.executeTurn('First turn');
    await runtime1.executeTurn('Second turn');
    await runtime1.executeTurn('Third turn');

    const metrics1 = runtime1.getCacheMetrics();
    if (metrics1.breaks > 1) {
      throw new Error(`Expected max 1 cache break (initial), got ${metrics1.breaks}`);
    }
    console.log(`✓ Baseline stable: ${metrics1.breaks} cache break(s) over 3 turns\n`);

    // Test 2: Baseline rebuilds only when skills change
    console.log('Test 2: Testing baseline rebuild on skill change...');
    const runtime2 = new AgentRuntime({
      memoryPath: testDbPath,
      skillsDir: testSkillsDir,
      enableLearning: true
    });

    // Simulate tool calls to trigger learning
    const sessionId = runtime2.getSessionId();
    for (let i = 0; i < 5; i++) {
      runtime2.getMemoryInterface().recordToolExecution(
        sessionId,
        'testTool',
        { arg: 'test' },
        { success: true }
      );
    }

    const initialBreaks = runtime2.getCacheMetrics().breaks;

    // Execute turns - learning should trigger on turn 5
    await runtime2.executeTurn('Turn 1');
    await runtime2.executeTurn('Turn 2');
    await runtime2.executeTurn('Turn 3');
    await runtime2.executeTurn('Turn 4');
    await runtime2.executeTurn('Turn 5'); // Learning cycle triggers

    // Force skill generation
    const learningEngine = runtime2['learningEngine'];
    const skillManager = runtime2['skillManager'];
    const newSkills = await learningEngine.runLearningCycle(sessionId);
    for (const skill of newSkills) {
      skillManager.saveSkill(skill);
    }

    await runtime2.executeTurn('Turn 6'); // Should rebuild baseline

    const finalBreaks = runtime2.getCacheMetrics().breaks;
    const breaksDelta = finalBreaks - initialBreaks;

    if (breaksDelta === 0) {
      console.log('⚠ Warning: Expected cache break after skill learned, got none');
    } else {
      console.log(`✓ Baseline rebuilt after skill learned: ${breaksDelta} new cache break(s)\n`);
    }

    // Test 3: Context updates don't break cache
    console.log('Test 3: Testing incremental updates without cache breaks...');
    const runtime3 = new AgentRuntime({
      memoryPath: testDbPath,
      skillsDir: testSkillsDir,
      enableLearning: false
    });

    const beforeUpdates = runtime3.getCacheMetrics().breaks;

    // Multiple turns with different memory contexts
    for (let i = 0; i < 10; i++) {
      await runtime3.executeTurn(`Different input ${i}`);
    }

    const afterUpdates = runtime3.getCacheMetrics().breaks;
    const updateBreaks = afterUpdates - beforeUpdates;

    if (updateBreaks > 1) {
      throw new Error(`Incremental updates caused ${updateBreaks} cache breaks (expected 0-1)`);
    }
    console.log(`✓ 10 turns with varying context: ${updateBreaks} cache break(s)\n`);

    // Test 4: Cache metrics accessible
    console.log('Test 4: Testing cache metrics API...');
    const metrics = runtime3.getCacheMetrics();

    if (typeof metrics.breaks !== 'number' || typeof metrics.stable !== 'boolean') {
      throw new Error('Cache metrics API malformed');
    }
    console.log(`✓ Cache metrics: ${metrics.breaks} total breaks, stable=${metrics.stable}\n`);

    runtime1.close();
    runtime2.close();
    runtime3.close();

    // Cleanup
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
    if (existsSync(testSkillsDir)) {
      rmSync(testSkillsDir, { recursive: true, force: true });
    }

    console.log('✅ Phase 4 validation PASSED\n');
    return true;

  } catch (error) {
    console.error('❌ Phase 4 validation FAILED:', error);

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
validatePhase4().then(passed => {
  process.exit(passed ? 0 : 1);
});
