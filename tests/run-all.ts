/**
 * Test runner: executes all validation tests
 */

import { spawn } from 'child_process';

const tests = [
  { name: 'Phase 2: Memory', file: 'tests/phase2-validate.ts' },
  { name: 'Phase 3: Learning', file: 'tests/phase3-validate.ts' },
  { name: 'Phase 4: Context', file: 'tests/phase4-validate.ts' },
  { name: 'Phase 5: Lineage', file: 'tests/phase5-validate.ts' },
  { name: 'Phase 6: Routing', file: 'tests/phase6-validate.ts' },
  { name: 'Phase 7: Observable', file: 'tests/phase7-validate.ts' },
  { name: 'Phase 8: Integration', file: 'tests/phase8-validate.ts' }
];

async function runTest(name: string, file: string): Promise<boolean> {
  return new Promise((resolve) => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Running: ${name}`);
    console.log('='.repeat(60));

    const child = spawn('npx', ['tsx', file], {
      stdio: 'inherit',
      shell: true
    });

    child.on('close', (code) => {
      resolve(code === 0);
    });

    child.on('error', (err) => {
      console.error(`Failed to start test: ${err.message}`);
      resolve(false);
    });
  });
}

async function runAll() {
  console.log('MIJ Agent Harness - Full Test Suite\n');

  const results: Array<{ name: string; passed: boolean }> = [];
  let totalPassed = 0;
  let totalFailed = 0;

  for (const test of tests) {
    const passed = await runTest(test.name, test.file);
    results.push({ name: test.name, passed });

    if (passed) {
      totalPassed++;
    } else {
      totalFailed++;
    }
  }

  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));

  for (const result of results) {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} - ${result.name}`);
  }

  console.log(`\nTotal: ${totalPassed} passed, ${totalFailed} failed`);

  if (totalFailed > 0) {
    console.log('\n❌ Some tests failed');
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed');
    process.exit(0);
  }
}

runAll();
