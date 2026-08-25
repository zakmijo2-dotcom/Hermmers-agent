/**
 * hemmers init command
 * Detects installed agents and sets up Hemmers
 */

import { registry } from '../../adapters/registry.js';
import { ClaudeCodeAdapter } from '../../adapters/claude-code/adapter.js';
import { OpenCodeAdapter } from '../../adapters/opencode/adapter.js';
import { PiAdapter } from '../../adapters/pi/adapter.js';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export async function initCommand() {
  console.log('🚀 Initializing Hemmers...\n');

  // Register all available adapters
  registry.register(new ClaudeCodeAdapter());
  registry.register(new OpenCodeAdapter());
  registry.register(new PiAdapter());

  console.log('🔍 Detecting installed agents...\n');

  // Detect all agents
  const detections = await registry.detectAll();

  // Display results
  let detectedCount = 0;
  for (const detection of detections) {
    if (detection.detected) {
      console.log(`✅ ${detection.name}`);
      if (detection.version) {
        console.log(`   Version: ${detection.version}`);
      }
      console.log(`   Path: ${detection.path}`);
      detectedCount++;
    } else {
      console.log(`❌ ${detection.name} - Not detected`);
    }
    console.log();
  }

  if (detectedCount === 0) {
    console.log('⚠️  No agents detected.');
    console.log('\nHemmers supports:');
    console.log('  - Claude Code');
    console.log('  - OpenCode');
    console.log('  - Pi');
    console.log('  - Codex');
    console.log('  - Cline');
    console.log('  - Hermes');
    console.log('  - Antigravity\n');
    console.log('Please install at least one supported agent before using Hemmers.');
    return;
  }

  // Create Hemmers home directory
  const hemmersHome = join(homedir(), '.hemmers');
  if (!existsSync(hemmersHome)) {
    mkdirSync(hemmersHome, { recursive: true });
  }

  // Create subdirectories
  const dirs = ['skills', 'profiles', 'tools', 'memory', 'logs'];
  for (const dir of dirs) {
    const dirPath = join(hemmersHome, dir);
    if (!existsSync(dirPath)) {
      mkdirSync(dirPath, { recursive: true });
    }
  }

  // Create initial config
  const config: {
    version: string;
    initialized: string;
    agents: Record<string, { enabled: boolean; adapter: string; config: Record<string, unknown> }>;
    memory: { path: string };
    learning: { enabled: boolean; threshold: number; autoApply: boolean };
    permissions: unknown[];
  } = {
    version: '0.1.0',
    initialized: new Date().toISOString(),
    agents: {},
    memory: {
      path: join(hemmersHome, 'memory', 'hemmers.db')
    },
    learning: {
      enabled: true,
      threshold: 3,
      autoApply: false
    },
    permissions: []
  };

  // Add detected agents to config
  for (const detection of detections) {
    if (detection.detected) {
      const adapterName = detection.name.toLowerCase().replace(/\s+/g, '-');
      config.agents[adapterName] = {
        enabled: true,
        adapter: adapterName,
        config: {}
      };
    }
  }

  const configPath = join(hemmersHome, 'config.json');
  writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');

  // Initialize skills registry with official skills
  try {
    const { initializeRegistry } = await import('../../core/skills/init-registry.js');
    initializeRegistry();
  } catch (error) {
    console.warn('⚠️  Could not initialize skills registry:', (error as Error).message);
  }

  console.log(`\n✅ Hemmers initialized!`);
  console.log(`\n📁 Home: ${hemmersHome}`);
  console.log(`📄 Config: ${configPath}`);
  console.log(`\n✨ Detected ${detectedCount} agent(s)`);
  console.log('\nNext steps:');
  console.log('  • Run "hemmers agents" to see agent capabilities');
  console.log('  • Run "hemmers doctor" to check health');
  console.log('  • Run "hemmers search <query>" to find skills');
  console.log('  • Run "hemmers add <skill>" to install skills\n');
}
