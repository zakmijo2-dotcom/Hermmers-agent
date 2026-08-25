/**
 * hemmers add command
 * Install a skill, tool, or profile
 */

import { SkillRegistry } from '../../core/skills/registry.js';
import { registry as adapterRegistry } from '../../adapters/registry.js';
import { homedir } from 'os';
import { join } from 'path';

export async function addCommand(packageName: string) {
  console.log(`📦 Installing ${packageName}...\n`);

  const hemmersHome = join(homedir(), '.hemmers');
  const skillRegistry = new SkillRegistry(hemmersHome);

  try {
    // Check if it's a known skill
    const metadata = skillRegistry.getMetadata(packageName);

    if (!metadata) {
      console.error(`❌ Package "${packageName}" not found in registry`);
      console.log('\nTry: hemmers search <query>');
      process.exit(1);
    }

    // Display package info
    console.log(`📋 Package: ${metadata.name}`);
    console.log(`   Version: ${metadata.version}`);
    console.log(`   Description: ${metadata.description}`);
    console.log(`   Author: ${metadata.author}`);
    console.log(`   Compatible: ${metadata.compatibility.join(', ')}`);

    if (metadata.dependencies.length > 0) {
      console.log(`   Dependencies: ${metadata.dependencies.join(', ')}`);
    }

    console.log();

    // Check if already installed
    if (skillRegistry.isInstalled(packageName)) {
      console.log(`⚠️  ${packageName} is already installed`);
      process.exit(0);
    }

    // Install
    const skill = await skillRegistry.install(packageName);

    // Register with detected agents
    const detected = await adapterRegistry.getDetectedAgents();

    if (detected.length === 0) {
      console.log('\n⚠️  No agents detected. Skill installed but not registered.');
      console.log('   Run "hemmers init" to detect agents.');
      return;
    }

    console.log('\n📌 Registering with agents...\n');

    for (const { adapter } of detected) {
      // Check compatibility
      if (!skillRegistry.validateCompatibility(skill, adapter.name)) {
        console.log(`   ⏭️  Skipping ${adapter.name} (not compatible)`);
        continue;
      }

      try {
        await adapter.registerSkill(skill);
        console.log(`   ✅ Registered with ${adapter.name}`);
      } catch (error) {
        console.log(`   ⚠️  Failed to register with ${adapter.name}: ${(error as Error).message}`);
      }
    }

    console.log(`\n✨ ${packageName} installed successfully!\n`);

  } catch (error) {
    console.error(`\n❌ Installation failed: ${(error as Error).message}\n`);
    process.exit(1);
  }
}
