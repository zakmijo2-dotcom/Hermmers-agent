/**
 * Initialize Official Skills Registry
 * Populates the registry with official Hemmers skills
 */

import { SkillRegistry } from './registry.js';
import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';
import type { Skill } from '../types/index.js';

export function initializeRegistry(): void {
  const hemmersHome = join(homedir(), '.hemmers');
  const skillRegistry = new SkillRegistry(hemmersHome);

  const officialSkillsPath = fileURLToPath(new URL('../../skills/official', import.meta.url));

  console.log('📚 Initializing skills registry...\n');

  try {
    if (!existsSync(officialSkillsPath)) {
      console.warn(`⚠️ Official skills directory not found at: ${officialSkillsPath}`);
      return;
    }

    const skillFiles = readdirSync(officialSkillsPath).filter(f => f.endsWith('.json'));

    for (const file of skillFiles) {
      const skillPath = join(officialSkillsPath, file);
      const content = readFileSync(skillPath, 'utf-8');
      const skill: Skill = JSON.parse(content);

      // Register in index
      skillRegistry.register({
        name: skill.name,
        version: skill.version,
        description: skill.description,
        author: skill.metadata?.author || 'Hemmers',
        tags: skill.metadata?.tags || [],
        compatibility: skill.compatibility || [],
        dependencies: skill.dependencies || []
      });

      console.log(`✅ Registered: ${skill.name}`);
    }

    console.log(`\n✨ Registered ${skillFiles.length} official skills\n`);

  } catch (error) {
    console.error('❌ Failed to initialize registry:', error);
    throw error;
  }
}
