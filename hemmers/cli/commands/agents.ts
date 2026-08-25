/**
 * hemmers agents command
 * Lists detected agents and their capabilities
 */

import { registry } from '../../adapters/registry.js';
import { ClaudeCodeAdapter } from '../../adapters/claude-code/adapter.js';
import { OpenCodeAdapter } from '../../adapters/opencode/adapter.js';
import { PiAdapter } from '../../adapters/pi/adapter.js';
import { CapabilityScorer } from '../../adapters/capabilities.js';

export async function agentsCommand() {
  console.log('🔍 Detecting agents...\n');

  // Register adapters
  registry.register(new ClaudeCodeAdapter());
  registry.register(new OpenCodeAdapter());
  registry.register(new PiAdapter());

  // Get detected agents
  const detected = await registry.getDetectedAgents();

  if (detected.length === 0) {
    console.log('❌ No agents detected.');
    console.log('\nRun "hemmers init" to set up Hemmers.\n');
    return;
  }

  console.log(`Found ${detected.length} agent(s):\n`);

  for (const { id, adapter, detection } of detected) {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`\n📦 ${detection.name}`);

    if (detection.version) {
      console.log(`   Version: ${detection.version}`);
    }
    console.log(`   Path: ${detection.path}`);

    // Get capabilities
    const capabilities = await adapter.capabilities();
    const score = CapabilityScorer.score(capabilities);

    console.log(`\n   Capability Score: ${(score * 100).toFixed(0)}%`);
    console.log(`\n   Capabilities:`);

    const capabilityIcons = {
      skills: capabilities.skills ? '✅' : '❌',
      hooks: capabilities.hooks ? '✅' : '❌',
      tools: capabilities.tools ? '✅' : '❌',
      mcp: capabilities.mcp ? '✅' : '❌',
      commands: capabilities.commands ? '✅' : '❌',
      agents: capabilities.agents ? '✅' : '❌',
      config: capabilities.config ? '✅' : '❌',
      plugins: capabilities.plugins ? '✅' : '❌'
    };

    for (const [cap, icon] of Object.entries(capabilityIcons)) {
      console.log(`     ${icon} ${cap}`);
    }

    // Check health
    const health = await adapter.healthCheck();

    console.log(`\n   Health: ${health.healthy ? '✅ Healthy' : '⚠️  Issues detected'}`);

    if (health.issues && health.issues.length > 0) {
      console.log(`\n   Issues:`);
      for (const issue of health.issues) {
        console.log(`     • ${issue}`);
      }
    }

    if (health.warnings && health.warnings.length > 0) {
      console.log(`\n   Warnings:`);
      for (const warning of health.warnings) {
        console.log(`     • ${warning}`);
      }
    }

    console.log();
  }

  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  // Rank agents by capability
  const rankings = detected.map(({ detection, adapter }) => ({
    name: detection.name,
    capabilities: {} as any
  }));

  for (let i = 0; i < rankings.length; i++) {
    rankings[i].capabilities = await detected[i].adapter.capabilities();
  }

  const ranked = CapabilityScorer.rank(rankings);

  console.log('📊 Capability Ranking:\n');
  ranked.forEach((r, i) => {
    console.log(`   ${i + 1}. ${r.name} (${(r.score * 100).toFixed(0)}%)`);
  });

  console.log('\n💡 Tip: Agents with higher scores support more Hemmers features natively.');
  console.log('    Lower-score agents use compatibility layers.\n');
}
