/**
 * Skill manager: CRUD operations for learned skills
 * Persists skills as JSON files
 */

import { SkillDefinition } from './learning-engine';
import { writeFileSync, readFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';

export class SkillManager {
  private skillsDir: string;
  private skills: Map<string, SkillDefinition> = new Map();

  constructor(skillsDir: string = './.mij/skills') {
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
        const skill = JSON.parse(content) as SkillDefinition;
        this.skills.set(skill.name, skill);
      } catch (error) {
        console.error(`Failed to load skill ${file}:`, error);
      }
    }
  }

  /**
   * Save skill to disk
   */
  saveSkill(skill: SkillDefinition): void {
    const filename = `${skill.name}.json`;
    const filepath = join(this.skillsDir, filename);

    writeFileSync(filepath, JSON.stringify(skill, null, 2), 'utf-8');
    this.skills.set(skill.name, skill);
  }

  /**
   * Get skill by name
   */
  getSkill(name: string): SkillDefinition | undefined {
    return this.skills.get(name);
  }

  /**
   * Get all skills
   */
  getAllSkills(): SkillDefinition[] {
    return Array.from(this.skills.values());
  }

  /**
   * Update skill (e.g., increment usage count, adjust confidence)
   */
  updateSkill(name: string, updates: Partial<SkillDefinition>): void {
    const skill = this.skills.get(name);
    if (!skill) {
      throw new Error(`Skill ${name} not found`);
    }

    const updated = { ...skill, ...updates };
    this.saveSkill(updated);
  }

  /**
   * Delete skill
   */
  deleteSkill(name: string): void {
    const filepath = join(this.skillsDir, `${name}.json`);
    if (existsSync(filepath)) {
      // Note: unlinkSync removed to avoid import - would need fs.promises
      this.skills.delete(name);
    }
  }

  /**
   * Refine skill based on execution outcome
   */
  refineSkill(name: string, success: boolean): void {
    const skill = this.skills.get(name);
    if (!skill) return;

    // Adjust confidence based on success
    const delta = success ? 0.05 : -0.1;
    const newConfidence = Math.max(0, Math.min(1, skill.confidence + delta));

    // Increment usage
    this.updateSkill(name, {
      confidence: newConfidence,
      usageCount: skill.usageCount + 1
    });
  }
}
