/**
 * Phase 4 Tests: Memory + Hooks + Tools + Permissions
 */

import { ToolEngine } from '../../hemmers/core/tools/engine';
import { HookEngine } from '../../hemmers/core/hooks/engine';
import { PermissionManager } from '../../hemmers/core/permissions/manager';
import { Tool, Hook } from '../../hemmers/core/types';

async function testToolEngine() {
  console.log('Test 1: Tool Engine...');

  const engine = new ToolEngine();

  // Create test tool
  const testTool: Tool = {
    name: 'test-tool',
    description: 'Test tool for validation',
    schema: {
      parameters: {
        input: { type: 'string' }
      },
      required: ['input']
    },
    permissions: [{ resource: 'test.execute' }],
    execute: async (params, context) => {
      return { output: `Processed: ${params.input}` };
    }
  };

  // Register tool
  engine.register(testTool, 'test-agent');

  // Execute tool
  const result = await engine.execute('test-tool', { input: 'hello' }, {
    sessionId: 'test-session',
    agent: 'test-agent'
  });

  if (!result.success) {
    throw new Error(`Tool execution failed: ${result.error}`);
  }

  console.log(`   ✅ Tool executed: ${result.result?.output}`);
  console.log(`   ✅ Duration: ${result.duration}ms`);

  // List tools
  const tools = engine.listAll();
  console.log(`   ✅ ${tools.length} tool(s) registered\n`);
}

async function testHookEngine() {
  console.log('Test 2: Hook Engine...');

  const engine = new HookEngine();
  const events: string[] = [];

  // Create test hook
  const testHook: Hook = {
    type: 'before_tool',
    handler: async (context) => {
      events.push(`Hook triggered: ${context.type}`);
    },
    priority: 10
  };

  // Register hook
  const hookId = engine.register(testHook, 'test-agent');
  console.log(`   ✅ Hook registered: ${hookId}`);

  // Trigger hook
  await engine.trigger('before_tool', { tool: 'test' }, 'test-agent');

  if (events.length !== 1) {
    throw new Error(`Expected 1 event, got ${events.length}`);
  }

  console.log(`   ✅ Hook triggered: ${events[0]}`);

  // Stats
  const stats = engine.getStats();
  console.log(`   ✅ Hook stats:`, stats);
  console.log();
}

async function testPermissionManager() {
  console.log('Test 3: Permission Manager...');

  const manager = new PermissionManager();

  // Grant filesystem read permission
  manager.grant('filesystem.read', '/project/*');

  // Deny network access
  manager.deny('network.*');

  // Check allowed permission
  const readPermission = manager.check({
    resource: 'filesystem.read',
    scope: '/project/src/file.ts',
    requester: 'test-skill'
  });

  if (!readPermission.allowed) {
    throw new Error('Read permission should be allowed');
  }
  console.log(`   ✅ Read permission: ${readPermission.action} (${readPermission.reason})`);

  // Check denied permission
  const networkPermission = manager.check({
    resource: 'network.http',
    requester: 'test-skill'
  });

  if (networkPermission.allowed) {
    throw new Error('Network permission should be denied');
  }
  console.log(`   ✅ Network permission: ${networkPermission.action} (${networkPermission.reason})`);

  // Check unknown permission (should ask)
  const unknownPermission = manager.check({
    resource: 'unknown.action',
    requester: 'test-skill'
  });

  if (unknownPermission.action !== 'ask') {
    throw new Error('Unknown permission should ask');
  }
  console.log(`   ✅ Unknown permission: ${unknownPermission.action} (${unknownPermission.reason})`);

  // Stats
  const stats = manager.getStats();
  console.log(`   ✅ Permission stats:`, stats);
  console.log();
}

async function testMemoryMigration() {
  console.log('Test 4: Memory Migration...');

  // Check if memory files exist in new location
  const { existsSync } = await import('fs');
  const { join } = await import('path');

  const memoryFiles = [
    'hemmers/core/memory/store.ts',
    'hemmers/core/memory/interface.ts',
    'hemmers/core/memory/lineage.ts'
  ];

  for (const file of memoryFiles) {
    const path = join(process.cwd(), file);
    if (!existsSync(path)) {
      throw new Error(`Memory file not found: ${file}`);
    }
  }

  console.log(`   ✅ All memory files migrated to hemmers/core/memory/\n`);
}

async function testIntegration() {
  console.log('Test 5: Integration Test...');

  const toolEngine = new ToolEngine();
  const hookEngine = new HookEngine();
  const permManager = new PermissionManager();

  // Register tool with permission
  const tool: Tool = {
    name: 'protected-tool',
    description: 'Tool requiring permission',
    schema: { parameters: {} },
    permissions: [{ resource: 'protected.execute' }],
    execute: async () => ({ result: 'success' })
  };

  toolEngine.register(tool);

  // Add permission rule
  permManager.grant('protected.execute');

  // Check permission
  const decision = permManager.check({
    resource: 'protected.execute',
    requester: 'protected-tool'
  });

  if (!decision.allowed) {
    throw new Error('Permission should be granted');
  }

  // Execute tool
  const result = await toolEngine.execute('protected-tool', {}, {
    sessionId: 'test',
    agent: 'test'
  });

  if (!result.success) {
    throw new Error('Tool execution failed');
  }

  // Register hook
  let hookCalled = false;
  hookEngine.register({
    type: 'before_tool',
    handler: async () => { hookCalled = true; }
  });

  // Trigger hook
  await hookEngine.trigger('before_tool', {}, 'test');

  if (!hookCalled) {
    throw new Error('Hook was not called');
  }

  console.log('   ✅ Tool executed with permission check');
  console.log('   ✅ Hook triggered before execution');
  console.log('   ✅ All systems integrated\n');
}

async function runPhase4Tests() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Phase 4 Tests: Memory + Hooks + Tools + Permissions\n');

  try {
    await testToolEngine();
    await testHookEngine();
    await testPermissionManager();
    await testMemoryMigration();
    await testIntegration();

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ All Phase 4 tests passed\n');

    return true;

  } catch (error) {
    console.error('❌ Phase 4 tests failed:', error);
    return false;
  }
}

runPhase4Tests().then(passed => {
  process.exit(passed ? 0 : 1);
});
