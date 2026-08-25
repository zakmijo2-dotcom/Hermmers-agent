/**
 * Workflow Engine
 * Define and execute multi-step workflows
 */

import { IAgent, AgentRequest } from '../../protocol/agent.js';

export interface WorkflowStep {
  id: string;
  name: string;
  type: 'agent' | 'tool' | 'condition' | 'parallel' | 'loop';
  config: Record<string, any>;
  nextStep?: string;
  onError?: string;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  variables: Record<string, any>;
}

export interface WorkflowContext {
  workflowId: string;
  variables: Record<string, any>;
  stepResults: Map<string, any>;
  currentStep: string;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: number;
  completedAt?: number;
  error?: string;
  results: Record<string, any>;
}

export class WorkflowEngine {
  private workflows: Map<string, Workflow> = new Map();
  private executions: Map<string, WorkflowExecution> = new Map();
  private agents: Map<string, IAgent> = new Map();

  /**
   * Register workflow
   */
  registerWorkflow(workflow: Workflow): void {
    this.workflows.set(workflow.id, workflow);
  }

  /**
   * Register agent for workflow execution
   */
  registerAgent(agentId: string, agent: IAgent): void {
    this.agents.set(agentId, agent);
  }

  /**
   * Execute workflow
   */
  async execute(workflowId: string, input?: Record<string, any>): Promise<WorkflowExecution> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    const executionId = this.generateId();
    const execution: WorkflowExecution = {
      id: executionId,
      workflowId,
      status: 'running',
      startedAt: Date.now(),
      results: {}
    };

    this.executions.set(executionId, execution);

    try {
      const context: WorkflowContext = {
        workflowId,
        variables: { ...workflow.variables, ...input },
        stepResults: new Map(),
        currentStep: workflow.steps[0].id
      };

      await this.executeSteps(workflow, context);

      execution.status = 'completed';
      execution.completedAt = Date.now();
      execution.results = Object.fromEntries(context.stepResults);

    } catch (error) {
      execution.status = 'failed';
      execution.completedAt = Date.now();
      execution.error = (error as Error).message;
    }

    return execution;
  }

  /**
   * Execute workflow steps
   */
  private async executeSteps(workflow: Workflow, context: WorkflowContext): Promise<void> {
    let currentStepId = context.currentStep;

    while (currentStepId) {
      const step = workflow.steps.find(s => s.id === currentStepId);
      if (!step) break;

      context.currentStep = currentStepId;

      try {
        const result = await this.executeStep(step, context);
        context.stepResults.set(step.id, result);

        // Determine next step
        currentStepId = step.nextStep || '';

      } catch (error) {
        if (step.onError) {
          currentStepId = step.onError;
        } else {
          throw error;
        }
      }
    }
  }

  /**
   * Execute single step
   */
  private async executeStep(step: WorkflowStep, context: WorkflowContext): Promise<any> {
    switch (step.type) {
      case 'agent':
        return await this.executeAgentStep(step, context);

      case 'tool':
        return await this.executeToolStep(step, context);

      case 'condition':
        return await this.executeConditionStep(step, context);

      case 'parallel':
        return await this.executeParallelStep(step, context);

      case 'loop':
        return await this.executeLoopStep(step, context);

      default:
        throw new Error(`Unknown step type: ${step.type}`);
    }
  }

  /**
   * Execute agent step
   */
  private async executeAgentStep(step: WorkflowStep, context: WorkflowContext): Promise<any> {
    const agentId = step.config.agentId;
    const agent = this.agents.get(agentId);

    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    const session = await agent.createSession();

    // Resolve prompt variables
    const prompt = this.resolveVariables(step.config.prompt, context);

    const response = await agent.request({
      sessionId: session.id,
      messages: [{ role: 'user', content: prompt }]
    });

    return response.content;
  }

  /**
   * Execute tool step
   */
  private async executeToolStep(step: WorkflowStep, context: WorkflowContext): Promise<any> {
    // Tool execution would integrate with ToolEngine
    return { success: true };
  }

  /**
   * Execute condition step
   */
  private async executeConditionStep(step: WorkflowStep, context: WorkflowContext): Promise<any> {
    const condition = step.config.condition;
    const value = this.resolveVariables(condition, context);

    // Simple boolean evaluation
    return { result: !!value };
  }

  /**
   * Execute parallel steps
   */
  private async executeParallelStep(step: WorkflowStep, context: WorkflowContext): Promise<any> {
    const stepIds = step.config.steps as string[];
    const workflow = this.workflows.get(context.workflowId)!;

    const steps = stepIds.map(id => workflow.steps.find(s => s.id === id)!);

    const results = await Promise.all(
      steps.map(s => this.executeStep(s, context))
    );

    return { results };
  }

  /**
   * Execute loop step
   */
  private async executeLoopStep(step: WorkflowStep, context: WorkflowContext): Promise<{ results: unknown[] }> {
    let items: unknown[] = [];
    if (Array.isArray(step.config.items)) {
      items = step.config.items;
    } else if (typeof step.config.items === 'string') {
      const resolved = this.resolveVariables(step.config.items, context);
      try {
        const parsed: unknown = JSON.parse(resolved);
        items = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        items = resolved.split(',').map(s => s.trim()).filter(Boolean);
      }
    }

    const results: unknown[] = [];

    for (const item of items) {
      context.variables[step.config.itemVar || 'item'] = item;

      const stepId = step.config.loopStep;
      const workflow = this.workflows.get(context.workflowId);
      const loopStep = workflow?.steps.find(s => s.id === stepId);
      if (loopStep) {
        const result = await this.executeStep(loopStep, context);
        results.push(result);
      }
    }

    return { results };
  }

  /**
   * Resolve variables in string
   */
  private resolveVariables(template: string, context: WorkflowContext): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, varName) => {
      if (context.variables[varName] !== undefined) {
        return String(context.variables[varName]);
      }
      return `{{${varName}}}`;
    });
  }

  /**
   * Get execution status
   */
  getExecution(executionId: string): WorkflowExecution | undefined {
    return this.executions.get(executionId);
  }

  /**
   * List all workflows
   */
  listWorkflows(): Workflow[] {
    return Array.from(this.workflows.values());
  }

  private generateId(): string {
    return `wf_exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Workflow Builder
 * Fluent API for building workflows
 */
export class WorkflowBuilder {
  private workflow: Workflow;

  constructor(name: string, description: string) {
    this.workflow = {
      id: `wf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      description,
      steps: [],
      variables: {}
    };
  }

  /**
   * Add agent step
   */
  agent(name: string, agentId: string, prompt: string): this {
    this.workflow.steps.push({
      id: `step_${this.workflow.steps.length + 1}`,
      name,
      type: 'agent',
      config: { agentId, prompt }
    });
    return this;
  }

  /**
   * Add tool step
   */
  tool(name: string, toolName: string, args: Record<string, any>): this {
    this.workflow.steps.push({
      id: `step_${this.workflow.steps.length + 1}`,
      name,
      type: 'tool',
      config: { toolName, args }
    });
    return this;
  }

  /**
   * Add parallel steps
   */
  parallel(name: string, stepIds: string[]): this {
    this.workflow.steps.push({
      id: `step_${this.workflow.steps.length + 1}`,
      name,
      type: 'parallel',
      config: { steps: stepIds }
    });
    return this;
  }

  /**
   * Build workflow
   */
  build(): Workflow {
    return this.workflow;
  }
}
