/**
 * hemmers list command
 * List installed skills, tools, and profiles
 */

import { SkillRegistry } from '../../core/skills/registry.js';
import { homedir } from 'os';
import { join } from 'path';

export async function listCommand() {
  const hemmersHome = join(homedir(), '.hemmers');
  const skillRegistry = new SkillRegistry(hemmersHome);

  const installed = skillRegistry.listInstalled();

  if (installed.length === 0) {
    console.log('📦 No skills installed\n');
    console.log('Install skills with: hemmers add <skill-name>');
    console.log('Search for skills: hemmers search <query>\n');
    return;
  }

  console.log(`📦 Installed Skills (${installed.length})\n`);

  for (const pkg of installed) {
    const { skill } = pkg;

    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`\n📋 ${skill.name}`);
    console.log(`   Version: ${skill.version}`);
    console.log(`   Description: ${skill.description}`);
    console.log(`   Compatible: ${skill.compatibility.join(', ')}`);

    if (skill.metadata.tags && skill.metadata.tags.length > 0) {
      console.log(`   Tags: ${skill.metadata.tags.join(', ')}`);
    }

    if (skill.dependencies && skill.dependencies.length > 0) {
      console.log(`   Dependencies: ${skill.dependencies.join(', ')}`);
    }

    console.log();
  }

  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
}
