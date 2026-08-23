/**
 * Basic agent runtime with memory integration
 * Simplified from OpenCode's event-driven async generator
 */

import { MemoryStore } from './memory-store';
import { MemoryInterface } from './memory-interface';
import { LearningEngine } from './learning-engine';
import { SkillManager } from './skill-manager';

export interface AgentConfig {
  memoryPath?: string;
  sessionId?: string;
  parentSessionId?: string;
  skillsDir?: string;
  enableLearning?: boolean;
}

export interface AgentTurn {
  input: string;
  response: string;
  sessionId: string;
}

export class AgentRuntime {
  private memoryStore: MemoryStore;
  private memoryInterface: MemoryInterface;
  private learningEngine: LearningEngine;
  private skillManager: SkillManager;
  private sessionId: string;
  private enableLearning: boolean;
  private turnCount: number = 0;

  constructor(config: AgentConfig = {}) {
    this.memoryStore = new MemoryStore(config.memoryPath || ':memory:');
    this.memoryInterface = new MemoryInterface(this.memoryStore);
    this.learningEngine = new LearningEngine(this.memoryInterface);
    this.skillManager = new SkillManager(config.skillsDir);
    this.enableLearning = config.enableLearning ?? true;

    if (config.sessionId) {
      // Resume existing session
      this.sessionId = config.sessionId;
      const session = this.memoryStore.getSession(config.sessionId);
      if (!session) {
        throw new Error(`Session ${config.sessionId} not found`);
      }
    } else {
      // Create new session
      const session = this.memoryStore.createSession(config.parentSessionId);
      this.sessionId = session.id;
    }
  }

  async executeTurn(input: string): Promise<AgentTurn> {
    this.turnCount++;

    // Load relevant context from memory
    const context = await this.memoryInterface.loadContext(this.sessionId, input);

    // Check for applicable learned skills
    const skills = this.skillManager.getAllSkills();
    const applicableSkill = skills.find(s => input.toLowerCase().includes(s.trigger.split(':')[1]?.trim() || ''));

    // Placeholder agent logic - real implementation would call LLM here
    let response = `Echo: ${input} (session: ${this.sessionId}, relevant memories: ${context.relevantMemories.length})`;

    if (applicableSkill) {
      response += ` [Applied skill: ${applicableSkill.name}]`;
      this.skillManager.updateSkill(applicableSkill.name, {
        usageCount: applicableSkill.usageCount + 1
      });
    }

    // Record turn in memory
    this.memoryInterface.recordTurn(this.sessionId, input, response);

    // Run learning cycle every 5 turns
    if (this.enableLearning && this.turnCount % 5 === 0) {
      await this.runLearningCycle();
    }

    return {
      input,
      response,
      sessionId: this.sessionId
    };
  }

  /**
   * Execute learning cycle: detect patterns and create skills
   */
  private async runLearningCycle(): Promise<void> {
    const newSkills = await this.learningEngine.runLearningCycle(this.sessionId);

    for (const skill of newSkills) {
      // Save new skill to disk
      this.skillManager.saveSkill(skill);
    }

    if (newSkills.length > 0) {
      console.log(`[Learning] Generated ${newSkills.length} new skills`);
    }
  }

  getSessionId(): string {
    return this.sessionId;
  }

  getMemoryInterface(): MemoryInterface {
    return this.memoryInterface;
  }

  close(): void {
    this.memoryStore.close();
  }
}
