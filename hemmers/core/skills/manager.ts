/**
 * Skill Manager
 * Enhanced from original MIJ skill-manager with versioning and validation
 */

import { Skill } from '../types/index.js';
import { writeFileSync, readFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';

export interface SkillValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export class SkillManager {
  private skillsDir: string;
  private skills: Map<string, Skill> = new Map();

  constructor(skillsDir: string) {
    this.skillsDir = skillsDir;
    this.ensureSkillsDir();
    this.loadSkills();
  }

  private ensureSkillsDir(): void {
    if (!existsSync(this.skillsDir)) {
      mkdirSync(this.skillsDir, { recursive: true });
    }
  }

  /**
   * Load all skills from disk
   */
  loadSkills(): void {
    if (!existsSync(this.skillsDir)) return;

    const files = readdirSync(this.skillsDir).filter(f => f.endsWith('.json'));

    for (const file of files) {
      try {
        const content = readFileSync(join(this.skillsDir, file), 'utf-8');
        const skill = JSON.parse(content) as Skill;

        // Validate before loading
        const validation = this.validate(skill);
        if (!validation.valid) {
          console.warn(`Skipping invalid skill ${file}:`, validation.errors);
          continue;
        }

        this.skills.set(skill.name, skill);
      } catch (error) {
        console.error(`Failed to load skill ${file}:`, error);
      }
    }
  }

  /**
   * Save skill to disk
   */
  saveSkill(skill: Skill): void {
    // Validate before saving
    const validation = this.validate(skill);
    if (!validation.valid) {
      throw new Error(`Invalid skill: ${validation.errors.join(', ')}`);
    }

    const filename = `${skill.name}.json`;
    const filepath = join(this.skillsDir, filename);

    writeFileSync(filepath, JSON.stringify(skill, null, 2), 'utf-8');
    this.skills.set(skill.name, skill);
  }

  /**
   * Get skill by name
   */
  getSkill(name: string): Skill | undefined {
    return this.skills.get(name);
  }

  /**
   * Get all skills
   */
  getAllSkills(): Skill[] {
    return Array.from(this.skills.values());
  }

  /**
   * Update skill
   */
  updateSkill(name: string, updates: Partial<Skill>): void {
    const skill = this.skills.get(name);
    if (!skill) {
      throw new Error(`Skill ${name} not found`);
    }

    const updated = { ...skill, ...updates };

    // Update timestamp
    updated.metadata.updatedAt = Date.now();

    this.saveSkill(updated);
  }

  /**
   * Delete skill
   */
  deleteSkill(name: string): void {
    const filepath = join(this.skillsDir, `${name}.json`);

    if (existsSync(filepath)) {
      const { unlinkSync } = require('fs');
      unlinkSync(filepath);
      this.skills.delete(name);
    }
  }

  /**
   * Validate skill structure and requirements
   */
  validate(skill: Skill): SkillValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields
    if (!skill.name || skill.name.trim() === '') {
      errors.push('Skill name is required');
    }

    if (!skill.version || !this.isValidVersion(skill.version)) {
      errors.push('Valid semantic version is required (e.g., 1.0.0)');
    }

    if (!skill.description || skill.description.trim() === '') {
      errors.push('Skill description is required');
    }

    if (!skill.instructions || skill.instructions.trim() === '') {
      errors.push('Skill instructions are required');
    }

    if (!skill.compatibility || skill.compatibility.length === 0) {
      errors.push('At least one compatible agent must be specified');
    }

    if (!Array.isArray(skill.permissions)) {
      errors.push('Permissions must be an array');
    }

    // Warnings
    if (skill.instructions.length < 50) {
      warnings.push('Instructions are very short - consider adding more detail');
    }

    if (!skill.metadata.author) {
      warnings.push('Author not specified');
    }

    if (!skill.metadata.license) {
      warnings.push('License not specified');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Check if version is valid semver
   */
  private isValidVersion(version: string): boolean {
    const semverRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?$/;
    return semverRegex.test(version);
  }

  /**
   * Check version compatibility
   */
  isVersionCompatible(required: string, installed: string): boolean {
    // Simple version check - would use semver library in production
    const reqParts = required.split('.').map(Number);
    const instParts = installed.split('.').map(Number);

    // Major version must match
    if (reqParts[0] !== instParts[0]) {
      return false;
    }

    // Installed minor must be >= required minor
    if (instParts[1] < reqParts[1]) {
      return false;
    }

    return true;
  }

  /**
   * Find skills by tag
   */
  findByTag(tag: string): Skill[] {
    return this.getAllSkills().filter(skill =>
      skill.metadata.tags?.includes(tag)
    );
  }

  /**
   * Find skills compatible with agent
   */
  findCompatible(agentName: string): Skill[] {
    return this.getAllSkills().filter(skill =>
      skill.compatibility.includes(agentName) ||
      skill.compatibility.includes('*')
    );
  }

  /**
   * Check for dependency conflicts
   */
  checkDependencies(skill: Skill): { satisfied: boolean; missing: string[] } {
    const missing: string[] = [];

    for (const dep of skill.dependencies || []) {
      if (!this.skills.has(dep)) {
        missing.push(dep);
      }
    }

    return {
      satisfied: missing.length === 0,
      missing
    };
  }

  /**
   * Get skill statistics
   */
  getStats(): {
    total: number;
    byAgent: Record<string, number>;
    byTag: Record<string, number>;
  } {
    const skills = this.getAllSkills();

    const byAgent: Record<string, number> = {};
    const byTag: Record<string, number> = {};

    for (const skill of skills) {
      // Count by agent
      for (const agent of skill.compatibility) {
        byAgent[agent] = (byAgent[agent] || 0) + 1;
      }

      // Count by tag
      for (const tag of skill.metadata.tags || []) {
        byTag[tag] = (byTag[tag] || 0) + 1;
      }
    }

    return {
      total: skills.length,
      byAgent,
      byTag
    };
  }
}
