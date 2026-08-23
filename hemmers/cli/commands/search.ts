/**
 * hemmers search command
 * Search for skills in the registry
 */

import { SkillRegistry } from '../../core/skills/registry';
import { homedir } from 'os';
import { join } from 'path';

export async function searchCommand(query: string) {
  console.log(`🔍 Searching for "${query}"...\n`);

  const hemmersHome = join(homedir(), '.hemmers');
  const skillRegistry = new SkillRegistry(hemmersHome);

  const results = skillRegistry.search(query);

  if (results.length === 0) {
    console.log('❌ No skills found\n');
    return;
  }

  console.log(`Found ${results.length} skill(s):\n`);

  for (const skill of results) {
    const installed = skillRegistry.isInstalled(skill.name);

    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`\n📦 ${skill.name} ${installed ? '✅ INSTALLED' : ''}`);
    console.log(`   Version: ${skill.version}`);
    console.log(`   Description: ${skill.description}`);
    console.log(`   Author: ${skill.author}`);
    console.log(`   Compatible: ${skill.compatibility.join(', ')}`);

    if (skill.tags.length > 0) {
      console.log(`   Tags: ${skill.tags.join(', ')}`);
    }

    if (skill.dependencies.length > 0) {
      console.log(`   Dependencies: ${skill.dependencies.join(', ')}`);
    }

    if (!installed) {
      console.log(`\n   Install: hemmers add ${skill.name}`);
    }

    console.log();
  }

  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
}
