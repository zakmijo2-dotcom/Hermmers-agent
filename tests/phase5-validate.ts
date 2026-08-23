/**
 * Phase 5 validation: Lineage tracking for tool provenance and session genealogy
 */

import { AgentRuntime } from '../packages/agent/src/runtime';
import { randomUUID } from 'crypto';
import { existsSync, unlinkSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const testDbPath = join(tmpdir(), `mij-test-${randomUUID()}.db`);
const testSkillsDir = join(tmpdir(), `mij-skills-${randomUUID()}`);

async function validatePhase5(): Promise<boolean> {
  console.log('Phase 5 Validation: Lineage Tracking\n');

  try {
    // Test 1: Session lineage tracking
    console.log('Test 1: Testing session genealogy...');
    const runtime1 = new AgentRuntime({
      memoryPath: testDbPath,
      skillsDir: testSkillsDir
    });
    const session1Id = runtime1.getSessionId();

    const runtime2 = new AgentRuntime({
      memoryPath: testDbPath,
      skillsDir: testSkillsDir,
      parentSessionId: session1Id
    });
    const session2Id = runtime2.getSessionId();

    const runtime3 = new AgentRuntime({
      memoryPath: testDbPath,
      skillsDir: testSkillsDir,
      parentSessionId: session2Id
    });
    const session3Id = runtime3.getSessionId();

    const lineage3 = runtime3.getLineageTracker().getSessionLineage(session3Id);
    if (!lineage3 || lineage3.depth !== 2) {
      throw new Error(`Expected depth 2, got ${lineage3?.depth}`);
    }
    if (lineage3.ancestors.length !== 2) {
      throw new Error(`Expected 2 ancestors, got ${lineage3.ancestors.length}`);
    }

    console.log(`✓ Session lineage: ${session1Id} → ${session2Id} → ${session3Id} (depth: ${lineage3.depth})\n`);

    // Test 2: Tool execution provenance
    console.log('Test 2: Testing tool execution provenance...');
    const callId = randomUUID();
    const turnId = randomUUID();

    runtime1.getLineageTracker().trackTurn(turnId, session1Id, 'test input');
    runtime1.getLineageTracker().trackToolExecution(
      callId,
      turnId,
      session1Id,
      'testTool',
      { arg1: 'value1' }
    );

    const resultId = randomUUID();
    runtime1.getLineageTracker().trackToolResult(
      resultId,
      callId,
      { output: 'test result' },
      true,
      150
    );

    const trace = runtime1.getLineageTracker().getToolExecutionTrace(callId);
    if (!trace) {
      throw new Error('Tool execution trace not found');
    }
    if (trace.toolName !== 'testTool' || trace.duration !== 150) {
      throw new Error('Tool trace data incorrect');
    }

    console.log(`✓ Tool trace: ${trace.toolName} (${trace.duration}ms, success=${trace.success})\n`);

    // Test 3: Session tool executions query
    console.log('Test 3: Testing session tool executions query...');

    // Add more tool executions
    for (let i = 0; i < 3; i++) {
      const cId = randomUUID();
      const tId = randomUUID();
      runtime1.getLineageTracker().trackTurn(tId, session1Id, `input ${i}`);
      runtime1.getLineageTracker().trackToolExecution(
        cId,
        tId,
        session1Id,
        `tool${i}`,
        { test: i }
      );
      runtime1.getLineageTracker().trackToolResult(
        randomUUID(),
        cId,
        { result: i },
        true,
        100 + i
      );
    }

    const allTraces = runtime1.getLineageTracker().getSessionToolExecutions(session1Id);
    if (allTraces.length !== 4) { // 1 from test 2 + 3 new
      throw new Error(`Expected 4 tool executions, got ${allTraces.length}`);
    }

    console.log(`✓ Found ${allTraces.length} tool executions in session\n`);

    // Test 4: Ancestry path
    console.log('Test 4: Testing ancestry path...');
    const path = runtime3.getLineageTracker().getAncestryPath(session3Id);

    if (path.length !== 3) {
      throw new Error(`Expected path length 3, got ${path.length}`);
    }
    if (path[0] !== session1Id || path[2] !== session3Id) {
      throw new Error('Ancestry path order incorrect');
    }

    console.log(`✓ Ancestry path: ${path.join(' → ')}\n`);

    // Test 5: Session descendants
    console.log('Test 5: Testing session descendants...');
    // Use runtime3's tracker which should have all sessions via memory store reconstruction
    const descendants = runtime3.getLineageTracker().getSessionDescendants(session1Id);

    if (!descendants.includes(session2Id) || !descendants.includes(session3Id)) {
      throw new Error(`Descendants not tracked correctly: got ${descendants.join(', ')}`);
    }

    console.log(`✓ Session ${session1Id} has ${descendants.length} descendants\n`);

    // Test 6: Lineage export/import
    console.log('Test 6: Testing lineage persistence...');
    const exported = runtime1.getLineageTracker().exportLineage();

    const runtime4 = new AgentRuntime({
      memoryPath: testDbPath,
      skillsDir: testSkillsDir
    });
    runtime4.getLineageTracker().importLineage(exported);

    const importedLineage = runtime4.getLineageTracker().getSessionLineage(session1Id);
    if (!importedLineage) {
      throw new Error('Lineage not imported correctly');
    }

    console.log(`✓ Lineage exported and imported successfully\n`);

    runtime1.close();
    runtime2.close();
    runtime3.close();
    runtime4.close();

    // Cleanup
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
    if (existsSync(testSkillsDir)) {
      rmSync(testSkillsDir, { recursive: true, force: true });
    }

    console.log('✅ Phase 5 validation PASSED\n');
    return true;

  } catch (error) {
    console.error('❌ Phase 5 validation FAILED:', error);

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
validatePhase5().then(passed => {
  process.exit(passed ? 0 : 1);
});
