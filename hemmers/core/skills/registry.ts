/**
 * Skill Registry
 * Package management for Hemmers skills
 */

import { Skill } from '../types/index.js';
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';

export interface SkillPackage {
  skill: Skill;
  installed: boolean;
  installedAt?: number;
  source: 'official' | 'community' | 'local';
}

export interface RegistryIndex {
  version: string;
  skills: Record<string, SkillPackageMetadata>;
}

export interface SkillPackageMetadata {
  name: string;
  version: string;
  description: string;
  author: string;
  tags: string[];
  compatibility: string[];
  dependencies: string[];
  downloadUrl?: string;
}

export class SkillRegistry {
  private registryPath: string;
  private skillsPath: string;
  private indexCache: RegistryIndex | null = null;

  constructor(basePath: string) {
    this.registryPath = join(basePath, 'registry');
    this.skillsPath = join(basePath, 'skills');

    this.ensureDirectories();
  }

  private ensureDirectories(): void {
    mkdirSync(this.registryPath, { recursive: true });
    mkdirSync(this.skillsPath, { recursive: true });
  }

  /**
   * Load registry index
   */
  private loadIndex(): RegistryIndex {
    if (this.indexCache) {
      return this.indexCache;
    }

    const indexPath = join(this.registryPath, 'index.json');

    if (!existsSync(indexPath)) {
      // Create default index
      const defaultIndex: RegistryIndex = {
        version: '1.0',
        skills: {}
      };
      this.saveIndex(defaultIndex);
      return defaultIndex;
    }

    const content = readFileSync(indexPath, 'utf-8');
    this.indexCache = JSON.parse(content);
    return this.indexCache!;
  }

  /**
   * Save registry index
   */
  private saveIndex(index: RegistryIndex): void {
    const indexPath = join(this.registryPath, 'index.json');
    writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf-8');
    this.indexCache = index;
  }

  /**
   * Register a skill in the registry
   */
  register(metadata: SkillPackageMetadata): void {
    const index = this.loadIndex();

    index.skills[metadata.name] = metadata;
    this.saveIndex(index);
  }
  /**
   * Unregister a skill from index
   */
  unregister(name: string): boolean {
    const index = this.loadIndex();
    if (index.skills[name]) {
      delete index.skills[name];
      this.saveIndex(index);
      return true;
    }
    return false;
  }

  /**
   * Search for skills
   */
  search(query: string): SkillPackageMetadata[] {
    const index = this.loadIndex();
    const lowerQuery = query.toLowerCase();

    return Object.values(index.skills).filter(skill => {
      return (
        skill.name.toLowerCase().includes(lowerQuery) ||
        skill.description.toLowerCase().includes(lowerQuery) ||
        skill.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
      );
    });
  }

  /**
   * Get skill metadata by name
   */
  getMetadata(name: string): SkillPackageMetadata | null {
    const index = this.loadIndex();
    return index.skills[name] || null;
  }

  /**
   * List all available skills
   */
  listAvailable(): SkillPackageMetadata[] {
    const index = this.loadIndex();
    return Object.values(index.skills);
  }

  /**
   * Install a skill
   */
  async install(name: string): Promise<Skill> {
    const metadata = this.getMetadata(name);

    if (!metadata) {
      throw new Error(`Skill "${name}" not found in registry`);
    }

    // Check if already installed
    if (this.isInstalled(name)) {
      throw new Error(`Skill "${name}" is already installed`);
    }

    // Check dependencies
    for (const dep of metadata.dependencies) {
      if (!this.isInstalled(dep)) {
        throw new Error(`Missing dependency: ${dep}. Install it first with: hemmers add ${dep}`);
      }
    }

    // Load skill definition
    const skill = await this.loadSkillDefinition(name);

    // Install to skills directory
    const skillPath = join(this.skillsPath, `${name}.json`);
    writeFileSync(
      skillPath,
      JSON.stringify(skill, null, 2),
      'utf-8'
    );

    console.log(`✅ Skill "${name}" installed successfully`);

    return skill;
  }

  /**
   * Uninstall a skill
   */
  uninstall(name: string): void {
    if (!this.isInstalled(name)) {
      throw new Error(`Skill "${name}" is not installed`);
    }

    const skillPath = join(this.skillsPath, `${name}.json`);
    const { unlinkSync } = require('fs');
    unlinkSync(skillPath);

    console.log(`✅ Skill "${name}" uninstalled`);
  }

  /**
   * Check if skill is installed
   */
  isInstalled(name: string): boolean {
    const skillPath = join(this.skillsPath, `${name}.json`);
    return existsSync(skillPath);
  }

  /**
   * List installed skills
   */
  listInstalled(): SkillPackage[] {
    if (!existsSync(this.skillsPath)) {
      return [];
    }

    const files = readdirSync(this.skillsPath).filter(f => f.endsWith('.json'));
    const packages: SkillPackage[] = [];

    for (const file of files) {
      try {
        const content = readFileSync(join(this.skillsPath, file), 'utf-8');
        const skill = JSON.parse(content) as Skill;

        packages.push({
          skill,
          installed: true,
          installedAt: Date.now(), // Would track from file metadata
          source: 'official'
        });
      } catch (error) {
        console.error(`Failed to load skill ${file}:`, error);
      }
    }

    return packages;
  }

  /**
   * Get installed skill by name
   */
  getInstalled(name: string): Skill | null {
    const skillPath = join(this.skillsPath, `${name}.json`);

    if (!existsSync(skillPath)) {
      return null;
    }

    const content = readFileSync(skillPath, 'utf-8');
    return JSON.parse(content);
  }

  /**
   * Validate skill compatibility with agent
   */
  validateCompatibility(skill: Skill, agentName: string): boolean {
    return skill.compatibility.includes(agentName) || skill.compatibility.includes('*');
  }

  /**
   * Load skill definition from registry
   * In production, this would fetch from remote or local package
   */
  private async loadSkillDefinition(name: string): Promise<Skill> {
    const metadata = this.getMetadata(name);

    if (!metadata) {
      throw new Error(`Skill "${name}" not found`);
    }

    // For now, create a basic skill from metadata
    // In production, this would load the full skill package
    return {
      name: metadata.name,
      version: metadata.version,
      description: metadata.description,
      instructions: `# ${metadata.name}\n\n${metadata.description}`,
      triggers: [],
      compatibility: metadata.compatibility,
      dependencies: metadata.dependencies,
      permissions: [],
      metadata: {
        author: metadata.author,
        tags: metadata.tags,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.indexCache = null;
  }
}
