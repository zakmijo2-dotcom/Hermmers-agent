/**
 * hemmers remove command
 * Remove an installed skill, tool, or profile
 */

import { homedir } from 'os';
import { join } from 'path';
import { existsSync, unlinkSync } from 'fs';
import { SkillRegistry } from '../../core/skills/registry.js';

export async function removeCommand(packageName: string, options?: { json?: boolean }): Promise<void> {
  const isJson = Boolean(options?.json);
  const hemmersHome = join(homedir(), '.hemmers');
  const skillRegistry = new SkillRegistry(hemmersHome);

  const skillFile = join(hemmersHome, 'skills', `${packageName}.json`);

  if (!existsSync(skillFile)) {
    if (isJson) {
      console.log(JSON.stringify({ success: false, error: `Package "${packageName}" is not installed` }));
    } else {
      console.error(`❌ Package "${packageName}" not found in installed skills.`);
    }
    process.exitCode = 1;
    return;
  }

  try {
    unlinkSync(skillFile);
    skillRegistry.unregister(packageName);

    if (isJson) {
      console.log(JSON.stringify({ success: true, package: packageName, removed: true }));
    } else {
      console.log(`✅ Successfully removed "${packageName}" from Hemmers.`);
    }
  } catch (err) {
    if (isJson) {
      console.log(JSON.stringify({ success: false, error: (err as Error).message }));
    } else {
      console.error(`❌ Failed to remove "${packageName}": ${(err as Error).message}`);
    }
    process.exitCode = 1;
  }
}
