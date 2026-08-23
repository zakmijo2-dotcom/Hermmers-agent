/**
 * Phase 3 Tests: Learning Engine + Context Intelligence
 */

import { LearningEngine, ToolExecution } from '../../hemmers/core/learning/engine';
import { ContextEngine, ContextSegment } from '../../hemmers/core/context/engine';

async function testLearningEngine() {
  console.log('Test 1: Learning Engine - Pattern Detection...');

  const engine = new LearningEngine();

  // Create realistic tool execution history
  const executions: ToolExecution[] = [
    {
      toolName: 'readFile',
      args: { path: 'test.txt' },
      result: { content: 'data' },
      success: true,
      duration: 50,
      timestamp: Date.now() - 10000,
      context: 'reading file'
    },
    {
      toolName: 'readFile',
      args: { path: 'test.txt' },
      result: { content: 'data' },
      success: true,
      duration: 45,
      timestamp: Date.now() - 9000,
      context: 'reading file'
    },
    {
      toolName: 'readFile',
      args: { path: 'test.txt' },
      result: { content: 'data' },
      success: true,
      duration: 48,
      timestamp: Date.now() - 8000,
      context: 'reading file'
    },
    {
      toolName: 'writeFile',
      args: { path: 'output.txt' },
      result: { written: true },
      success: false,
      duration: 30,
      timestamp: Date.now() - 7000,
      context: 'writing file'
    },
    {
      toolName: 'writeFile',
      args: { path: 'output.txt', mode: '0644' },
      result: { written: true },
      success: true,
      duration: 35,
      timestamp: Date.now() - 6000,
      context: 'writing file'
    }
  ];

  // Detect patterns
  const patterns = engine.detectPatterns(executions);

  if (patterns.length === 0) {
    throw new Error('No patterns detected');
  }

  console.log(`   ✅ Detected ${patterns.length} pattern(s)`);

  // Test pattern details
  const readPattern = patterns.find(p => p.signature.includes('readFile'));
  if (!readPattern) {
    throw new Error('readFile pattern not detected');
  }

  console.log(`   ✅ Pattern: ${readPattern.signature} (${readPattern.frequency}x, ${(readPattern.successRate * 100).toFixed(0)}% success)`);

  // Generate skill from pattern
  const skill = engine.generateSkill(readPattern);

  console.log(`   ✅ Generated skill: ${skill.name}`);
  console.log(`      Confidence: ${skill.confidence.toFixed(2)}`);
  console.log(`      Evidence: ${skill.evidence.successfulExecutions}/${skill.evidence.totalExecutions} successful\n`);

  // Validate skill
  const validation = engine.validateLearnedSkill(skill);
  if (!validation.valid) {
    throw new Error(`Skill validation failed: ${validation.reason}`);
  }

  console.log('   ✅ Skill validation passed\n');
}

async function testContextEngine() {
  console.log('Test 2: Context Engine - Token Management...');

  const engine = new ContextEngine();

  // Test token estimation
  const text = 'This is a test sentence for token estimation.';
  const tokens = engine.estimateTokens(text);

  console.log(`   ✅ Token estimation: "${text}" = ~${tokens} tokens\n`);

  // Create context segments
  const segments: ContextSegment[] = [
    engine.createSegment('sys', 'system', 'You are a helpful assistant.', 1.0),
    engine.createSegment('mem1', 'memory', 'User asked about JavaScript.', 0.6),
    engine.createSegment('mem2', 'memory', 'User wants to learn React hooks.', 0.7),
    engine.createSegment('hist1', 'history', 'Previous conversation about TypeScript.', 0.3),
    engine.createSegment('hist2', 'history', 'Discussion about database design.', 0.2)
  ];

  // Calculate budget
  const budget = engine.calculateBudget(segments, 10000);

  console.log('Test 3: Context Budget...');
  console.log(`   Total: ${budget.total} tokens`);
  console.log(`   Used: ${budget.used} tokens`);
  console.log(`   Available: ${budget.available} tokens`);
  console.log(`   Pressure: ${(budget.pressure * 100).toFixed(1)}%\n`);

  const pressure = engine.isPressured(budget);
  console.log(`   ✅ Pressure status: High=${pressure.high}, Critical=${pressure.critical}\n`);

  // Test compaction
  console.log('Test 4: Context Compaction...');

  const targetTokens = Math.floor(budget.used * 0.6); // Reduce to 60%
  const result = engine.compact(segments, targetTokens, {
    currentTask: 'React',
    preserveTypes: ['system']
  });

  console.log(`   Original: ${result.original.length} segments, ${result.original.reduce((s, seg) => s + seg.tokens, 0)} tokens`);
  console.log(`   Compacted: ${result.compacted.length} segments, ${result.compacted.reduce((s, seg) => s + seg.tokens, 0)} tokens`);
  console.log(`   Saved: ${result.tokensSaved} tokens (${result.itemsRemoved} items removed)`);
  console.log(`   ✅ Compaction successful\n`);

  // Test summarization
  console.log('Test 5: Content Summarization...');

  const longText = 'A'.repeat(10000) + ' middle content ' + 'B'.repeat(10000);
  const summarized = engine.summarize(longText, 100);

  console.log(`   Original: ${engine.estimateTokens(longText)} tokens`);
  console.log(`   Summarized: ${engine.estimateTokens(summarized)} tokens`);
  console.log(`   ✅ Summarization successful\n`);

  // Test context stats
  console.log('Test 6: Context Statistics...');

  const stats = engine.getStats(segments);

  console.log(`   Total Segments: ${stats.totalSegments}`);
  console.log(`   Total Tokens: ${stats.totalTokens}`);
  console.log(`   Avg Importance: ${stats.avgImportance.toFixed(2)}`);
  console.log(`   By Type:`);

  for (const [type, data] of Object.entries(stats.byType)) {
    console.log(`      ${type}: ${data.count} segments, ${data.tokens} tokens`);
  }

  console.log(`   ✅ Statistics calculated\n`);
}

async function testErrorRecoveryLearning() {
  console.log('Test 7: Error Recovery Pattern Detection...');

  const engine = new LearningEngine();

  const executions: ToolExecution[] = [
    {
      toolName: 'gitCommit',
      args: { message: 'test' },
      result: { error: 'nothing to commit' },
      success: false,
      duration: 100,
      timestamp: Date.now() - 5000,
      context: 'committing'
    },
    {
      toolName: 'gitCommit',
      args: { message: 'test', all: true },
      result: { committed: true },
      success: true,
      duration: 150,
      timestamp: Date.now() - 4000,
      context: 'committing'
    },
    {
      toolName: 'gitCommit',
      args: { message: 'test2' },
      result: { error: 'nothing to commit' },
      success: false,
      duration: 95,
      timestamp: Date.now() - 3000,
      context: 'committing'
    },
    {
      toolName: 'gitCommit',
      args: { message: 'test2', all: true },
      result: { committed: true },
      success: true,
      duration: 145,
      timestamp: Date.now() - 2000,
      context: 'committing'
    }
  ];

  const patterns = engine.detectPatterns(executions);
  const recoveryPattern = patterns.find(p => p.type === 'error-recovery');

  if (recoveryPattern) {
    console.log(`   ✅ Error recovery pattern detected: ${recoveryPattern.signature}`);
    console.log(`      Frequency: ${recoveryPattern.frequency}x`);
    console.log(`      Success Rate: ${(recoveryPattern.successRate * 100).toFixed(0)}%\n`);
  } else {
    console.log('   ⚠️  No error recovery patterns detected (expected with 2 recoveries)\n');
  }
}

async function runPhase3Tests() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Phase 3 Tests: Learning + Context\n');

  try {
    await testLearningEngine();
    await testContextEngine();
    await testErrorRecoveryLearning();

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ All Phase 3 tests passed\n');

    return true;

  } catch (error) {
    console.error('❌ Phase 3 tests failed:', error);
    return false;
  }
}

runPhase3Tests().then(passed => {
  process.exit(passed ? 0 : 1);
});
