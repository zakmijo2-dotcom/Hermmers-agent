/**
 * Phase 2 Tests: Skills + Registry
 */

import { SkillManager } from '../../hemmers/core/skills/manager';
import { SkillRegistry } from '../../hemmers/core/skills/registry';
import { Skill } from '../../hemmers/core/types';
import { randomUUID } from 'crypto';
import { existsSync, rmSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const testDir = join(tmpdir(), `hemmers-test-${randomUUID()}`);

async function testSkillManager() {
  console.log('Test 1: Skill Manager...');

  const skillsDir = join(testDir, 'skills');
  mkdirSync(skillsDir, { recursive: true });

  const manager = new SkillManager(skillsDir);

  // Create test skill
  const testSkill: Skill = {
    name: 'test-skill',
    version: '1.0.0',
    description: 'Test skill for validation',
    instructions: 'Test instructions that are long enough to pass validation checks.',
    triggers: ['test'],
    compatibility: ['*'],
    dependencies: [],
    permissions: [],
    metadata: {
      author: 'Test',
      license: 'MIT',
      tags: ['test'],
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
  };

  // Test validation
  const validation = manager.validate(testSkill);
  if (!validation.valid) {
    throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
  }

  // Test save
  manager.saveSkill(testSkill);

  // Test load
  const loaded = manager.getSkill('test-skill');
  if (!loaded) {
    throw new Error('Skill not loaded');
  }

  // Test list
  const all = manager.getAllSkills();
  if (all.length !== 1) {
    throw new Error(`Expected 1 skill, got ${all.length}`);
  }

  console.log('✅ Skill Manager working\n');
}

async function testSkillRegistry() {
  console.log('Test 2: Skill Registry...');

  const registry = new SkillRegistry(testDir);

  // Register test skill
  registry.register({
    name: 'caveman',
    version: '1.0.0',
    description: 'Compressed communication',
    author: 'Hemmers',
    tags: ['communication', 'efficiency'],
    compatibility: ['*'],
    dependencies: []
  });

  // Test search
  const results = registry.search('caveman');
  if (results.length !== 1) {
    throw new Error(`Expected 1 result, got ${results.length}`);
  }

  // Test metadata
  const metadata = registry.getMetadata('caveman');
  if (!metadata) {
    throw new Error('Metadata not found');
  }

  console.log('✅ Skill Registry working\n');
}

async function testSkillInstallation() {
  console.log('Test 3: Skill Installation...');

  const installTestDir = join(tmpdir(), `hemmers-install-${randomUUID()}`);
  mkdirSync(installTestDir, { recursive: true });

  const registry = new SkillRegistry(installTestDir);

  // Register skill
  registry.register({
    name: 'install-test',
    version: '1.0.0',
    description: 'Installation test',
    author: 'Test',
    tags: ['test'],
    compatibility: ['*'],
    dependencies: []
  });

  // Install skill
  await registry.install('install-test');

  // Check if installed
  if (!registry.isInstalled('install-test')) {
    throw new Error('Skill not installed');
  }

  // List installed
  const installed = registry.listInstalled();
  if (installed.length !== 1) {
    throw new Error(`Expected 1 installed skill, got ${installed.length}`);
  }

  // Cleanup
  rmSync(installTestDir, { recursive: true, force: true });

  console.log('✅ Skill Installation working\n');
}

async function runPhase2Tests() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Phase 2 Tests: Skills + Registry\n');

  try {
    await testSkillManager();
    await testSkillRegistry();
    await testSkillInstallation();

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ All Phase 2 tests passed\n');

    return true;

  } catch (error) {
    console.error('❌ Phase 2 tests failed:', error);
    return false;

  } finally {
    // Cleanup
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  }
}

runPhase2Tests().then(passed => {
  process.exit(passed ? 0 : 1);
});
