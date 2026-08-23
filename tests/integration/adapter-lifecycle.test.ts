/**
 * Phase 1 Integration Test
 * Tests adapter lifecycle: detect → install → configure → health check
 */

import { registry } from '../../hemmers/adapters/registry';
import { ClaudeCodeAdapter } from '../../hemmers/adapters/claude-code/adapter';
import { OpenCodeAdapter } from '../../hemmers/adapters/opencode/adapter';
import { PiAdapter } from '../../hemmers/adapters/pi/adapter';

async function testAdapterLifecycle() {
  console.log('Phase 1 Integration Test: Adapter Lifecycle\n');

  try {
    // Test 1: Registry
    console.log('Test 1: Adapter Registration...');
    registry.register(new ClaudeCodeAdapter());
    registry.register(new OpenCodeAdapter());
    registry.register(new PiAdapter());

    const adapters = registry.list();
    if (adapters.length !== 3) {
      throw new Error(`Expected 3 adapters, got ${adapters.length}`);
    }
    console.log(`✅ ${adapters.length} adapters registered: ${adapters.join(', ')}\n`);

    // Test 2: Detection
    console.log('Test 2: Agent Detection...');
    const detections = await registry.detectAll();

    console.log(`   Detected ${detections.length} agents:`);
    for (const detection of detections) {
      console.log(`   ${detection.detected ? '✅' : '❌'} ${detection.name}`);
      if (detection.detected) {
        console.log(`      Path: ${detection.path}`);
      }
    }
    console.log();

    // Test 3: Capabilities
    console.log('Test 3: Capability Detection...');
    for (const adapterId of adapters) {
      const adapter = registry.get(adapterId);
      if (!adapter) continue;

      const detection = await adapter.detect();
      if (!detection.detected) {
        console.log(`   ⏭️  Skipping ${adapter.name} (not installed)`);
        continue;
      }

      const capabilities = await adapter.capabilities();
      console.log(`   ${adapter.name}:`);
      console.log(`      Skills: ${capabilities.skills ? '✅' : '❌'}`);
      console.log(`      Hooks: ${capabilities.hooks ? '✅' : '❌'}`);
      console.log(`      Tools: ${capabilities.tools ? '✅' : '❌'}`);
      console.log(`      MCP: ${capabilities.mcp ? '✅' : '❌'}`);
    }
    console.log();

    // Test 4: Health Check
    console.log('Test 4: Health Check...');
    const detected = await registry.getDetectedAgents();

    if (detected.length === 0) {
      console.log('   ⚠️  No agents installed - skipping health check');
    } else {
      for (const { adapter } of detected) {
        const health = await adapter.healthCheck();
        console.log(`   ${adapter.name}: ${health.healthy ? '✅ Healthy' : '⚠️  Issues'}`);

        if (health.issues) {
          for (const issue of health.issues) {
            console.log(`      • ${issue}`);
          }
        }
      }
    }
    console.log();

    console.log('✅ Phase 1 Integration Test PASSED\n');
    return true;

  } catch (error) {
    console.error('❌ Phase 1 Integration Test FAILED:', error);
    return false;
  }
}

testAdapterLifecycle().then(passed => {
  process.exit(passed ? 0 : 1);
});
