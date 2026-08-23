/**
 * Basic agent runtime with memory integration
 * Simplified from OpenCode's event-driven async generator
 */

import { MemoryStore } from './memory-store';
import { MemoryInterface } from './memory-interface';
import { LearningEngine } from './learning-engine';
import { SkillManager } from './skill-manager';
import { StableContextManager } from './context-stable';
import { LineageTracker } from './lineage';
import { ExecutionObserver } from './execution-observer';
import { randomUUID } from 'crypto';

export interface AgentConfig {
  memoryPath?: string;
  sessionId?: string;
  parentSessionId?: string;
  skillsDir?: string;
  enableLearning?: boolean;
  systemInstructions?: string;
  observer?: ExecutionObserver;
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
  private contextManager: StableContextManager;
  private lineageTracker: LineageTracker;
  private observer: ExecutionObserver;
  private sessionId: string;
  private enableLearning: boolean;
  private turnCount: number = 0;
  private lastSkillCount: number = 0;
  private systemInstructions: string;
  private cacheBreakCount: number = 0;
  private currentTurnId: string | null = null;

  constructor(config: AgentConfig = {}) {
    this.memoryStore = new MemoryStore(config.memoryPath || ':memory:');
    this.memoryInterface = new MemoryInterface(this.memoryStore);
    this.learningEngine = new LearningEngine(this.memoryInterface);
    this.skillManager = new SkillManager(config.skillsDir);
    this.contextManager = new StableContextManager();
    this.lineageTracker = new LineageTracker();
    this.observer = config.observer || new ExecutionObserver();
    this.enableLearning = config.enableLearning ?? true;
    this.systemInstructions = config.systemInstructions || 'You are a helpful AI assistant.';

    if (config.sessionId) {
      // Resume existing session
      this.sessionId = config.sessionId;
      const session = this.memoryStore.getSession(config.sessionId);
      if (!session) {
        throw new Error(`Session ${config.sessionId} not found`);
      }
      // Track existing session lineage with memory store for reconstruction
      this.lineageTracker.trackSessionCreation(
        this.sessionId,
        session.parentSessionId || undefined,
        this.memoryStore
      );
    } else {
      // Create new session
      const session = this.memoryStore.createSession(config.parentSessionId);
      this.sessionId = session.id;

      // Track session lineage with memory store for reconstruction
      this.lineageTracker.trackSessionCreation(
        this.sessionId,
        config.parentSessionId,
        this.memoryStore
      );
    }
  }

  async executeTurn(input: string): Promise<AgentTurn> {
    this.turnCount++;
    this.currentTurnId = randomUUID();

    // Emit turn start event
    await this.observer.emit('turn_start', {
      turnId: this.currentTurnId,
      input,
      sessionId: this.sessionId
    });

    // Track turn in lineage
    this.lineageTracker.trackTurn(this.currentTurnId, this.sessionId, input);

    // Load relevant context from memory
    const context = await this.memoryInterface.loadContext(this.sessionId, input);

    await this.observer.emit('context_update', {
      type: 'memory_loaded',
      memoryCount: context.relevantMemories.length
    });

    // Get current skills
    const skills = this.skillManager.getAllSkills();

    // Build stable baseline (only rebuilds if skills changed)
    let baselineChanged = false;
    if (this.contextManager.shouldRebuildBaseline(skills.length, this.lastSkillCount)) {
      const baseline = this.contextManager.buildBaseline({
        systemInstructions: this.systemInstructions,
        skills,
        sessionMetadata: { sessionId: this.sessionId }
      });

      const updates = this.contextManager.buildUpdates(context);
      const result = this.contextManager.assemblePrompt(baseline, updates);
      baselineChanged = result.baselineChanged;

      if (baselineChanged) {
        this.cacheBreakCount++;
      }

      this.lastSkillCount = skills.length;
    } else {
      // Baseline stable, only build updates
      const baseline = this.contextManager.buildBaseline({
        systemInstructions: this.systemInstructions,
        skills,
        sessionMetadata: { sessionId: this.sessionId }
      });
      const updates = this.contextManager.buildUpdates(context);
      this.contextManager.assemblePrompt(baseline, updates);
    }

    // Check for applicable learned skills
    const applicableSkill = skills.find(s => input.toLowerCase().includes(s.trigger.split(':')[1]?.trim() || ''));

    // Placeholder agent logic - real implementation would call LLM here
    let response = `Echo: ${input} (session: ${this.sessionId}, relevant memories: ${context.relevantMemories.length})`;

    if (applicableSkill) {
      response += ` [Applied skill: ${applicableSkill.name}]`;
      this.skillManager.updateSkill(applicableSkill.name, {
        usageCount: applicableSkill.usageCount + 1
      });

      await this.observer.emit('skill_applied', {
        skillName: applicableSkill.name,
        confidence: applicableSkill.confidence
      });
    }

    // Record turn in memory
    this.memoryInterface.recordTurn(this.sessionId, input, response);

    // Run learning cycle every 5 turns
    if (this.enableLearning && this.turnCount % 5 === 0) {
      await this.runLearningCycle();
    }

    // Emit turn end event
    await this.observer.emit('turn_end', {
      turnId: this.currentTurnId,
      response,
      sessionId: this.sessionId
    });

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
    await this.observer.emit('learning_start', {});

    const newSkills = await this.learningEngine.runLearningCycle(this.sessionId);

    for (const skill of newSkills) {
      // Save new skill to disk
      this.skillManager.saveSkill(skill);
    }

    await this.observer.emit('learning_end', {
      skillCount: newSkills.length,
      skills: newSkills.map(s => s.name)
    });

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

  getCacheMetrics(): { breaks: number; stable: boolean } {
    const metrics = this.contextManager.getCacheMetrics();
    return {
      breaks: this.cacheBreakCount,
      stable: metrics.baselineStable
    };
  }

  getLineageTracker(): LineageTracker {
    return this.lineageTracker;
  }

  getObserver(): ExecutionObserver {
    return this.observer;
  }

  close(): void {
    this.memoryStore.close();
  }
}
