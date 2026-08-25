/**
 * hemmers profile command
 * Activate, list, or inspect agent profiles
 */

import { homedir } from 'os';
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { ProfileManager, Profile } from '../../core/profiles/manager.js';

export async function profileCommand(
  profileName?: string,
  options?: { json?: boolean; list?: boolean }
): Promise<void> {
  const isJson = Boolean(options?.json);
  const hemmersHome = join(homedir(), '.hemmers');
  const profileManager = new ProfileManager();

  // If list option or no name specified, list profiles
  if (options?.list || !profileName) {
    const profiles: Profile[] = profileManager.list();
    const active: Profile | null = profileManager.getActive();

    if (isJson) {
      console.log(
        JSON.stringify(
          {
            active: active?.name || null,
            profiles: profiles.map((p: Profile) => ({
              id: p.id,
              name: p.name,
              description: p.description,
              skills: p.skills,
              tools: p.tools
            }))
          },
          null,
          2
        )
      );
    } else {
      console.log('📋 Available Agent Profiles:\n');
      for (const p of profiles) {
        const isActive = active?.id === p.id;
        console.log(`${isActive ? '👉 [ACTIVE]' : '  '} ${p.name} - ${p.description}`);
        console.log(`     Skills: ${p.skills.join(', ') || 'none'}`);
        console.log(`     Tools: ${p.tools.join(', ') || 'none'}\n`);
      }
      console.log('Switch profile with: hemmers profile <profile-name>\n');
    }
    return;
  }

  // Activate specified profile
  try {
    await profileManager.activate(profileName);
    const activated = profileManager.getActive();

    // Save active profile in config if exists
    const configPath = join(hemmersHome, 'config.json');
    if (existsSync(configPath)) {
      try {
        const config = JSON.parse(readFileSync(configPath, 'utf-8'));
        config.activeProfile = profileName;
        writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
      } catch {
        // ignore
      }
    }

    if (isJson) {
      console.log(JSON.stringify({ success: true, activeProfile: activated?.name || profileName }));
    } else {
      console.log(`✅ Profile "${activated?.name || profileName}" activated!`);
      if (activated) {
        console.log(`   Description: ${activated.description}`);
        console.log(`   Enabled Skills: ${activated.skills.join(', ') || 'none'}`);
        console.log(`   Enabled Tools: ${activated.tools.join(', ') || 'none'}\n`);
      }
    }
  } catch (err) {
    if (isJson) {
      console.log(JSON.stringify({ success: false, error: (err as Error).message }));
    } else {
      console.error(`❌ ${(err as Error).message}`);
      console.log('Run "hemmers profile --list" to view available profiles.');
    }
    process.exitCode = 1;
  }
}
