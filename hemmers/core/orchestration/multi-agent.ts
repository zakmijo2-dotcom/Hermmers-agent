/**
 * Multi-Agent System
 * Agent orchestration and handoff
 */

import { IAgent, AgentRequest, AgentResponse } from '../../protocol/agent.js';
import { randomUUID } from 'crypto';

export interface AgentTask {
  id: string;
  description: string;
  assignedTo?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  result?: any;
  error?: string;
}

export interface Orchestration {
  id: string;
  agents: Map<string, IAgent>;
  tasks: AgentTask[];
  currentAgent?: string;
}

export class MultiAgentOrchestrator {
  private orchestrations: Map<string, Orchestration> = new Map();

  /**
   * Create new orchestration
   */
  createOrchestration(agents: IAgent[]): string {
    const id = randomUUID();

    const agentMap = new Map<string, IAgent>();
    for (const agent of agents) {
      const metadata = agent.getMetadata();
      agentMap.set(metadata.id, agent);
    }

    this.orchestrations.set(id, {
      id,
      agents: agentMap,
      tasks: []
    });

    return id;
  }

  /**
   * Add task to orchestration
   */
  addTask(orchestrationId: string, description: string): string {
    const orch = this.orchestrations.get(orchestrationId);
    if (!orch) throw new Error('Orchestration not found');

    const task: AgentTask = {
      id: randomUUID(),
      description,
      status: 'pending'
    };

    orch.tasks.push(task);
    return task.id;
  }

  /**
   * Assign task to agent
   */
  async assignTask(
    orchestrationId: string,
    taskId: string,
    agentId: string
  ): Promise<void> {
    const orch = this.orchestrations.get(orchestrationId);
    if (!orch) throw new Error('Orchestration not found');

    const task = orch.tasks.find(t => t.id === taskId);
    if (!task) throw new Error('Task not found');

    const agent = orch.agents.get(agentId);
    if (!agent) throw new Error('Agent not found in orchestration');

    task.assignedTo = agentId;
    task.status = 'in_progress';
    orch.currentAgent = agentId;

    try {
      const session = await agent.createSession();

      const response = await agent.request({
        sessionId: session.id,
        messages: [{
          role: 'user',
          content: task.description
        }]
      });

      task.result = response.content;
      task.status = 'completed';
    } catch (error) {
      task.error = (error as Error).message;
      task.status = 'failed';
    }
  }

  /**
   * Handoff to another agent
   */
  async handoff(
    orchestrationId: string,
    fromAgentId: string,
    toAgentId: string,
    context: string
  ): Promise<AgentResponse> {
    const orch = this.orchestrations.get(orchestrationId);
    if (!orch) throw new Error('Orchestration not found');

    const toAgent = orch.agents.get(toAgentId);
    if (!toAgent) throw new Error('Target agent not found');

    orch.currentAgent = toAgentId;

    const session = await toAgent.createSession();

    return await toAgent.request({
      sessionId: session.id,
      messages: [{
        role: 'user',
        content: `Handoff from ${fromAgentId}: ${context}`
      }]
    });
  }

  /**
   * Get orchestration status
   */
  getStatus(orchestrationId: string): {
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    failed: number;
  } {
    const orch = this.orchestrations.get(orchestrationId);
    if (!orch) throw new Error('Orchestration not found');

    return {
      total: orch.tasks.length,
      pending: orch.tasks.filter(t => t.status === 'pending').length,
      inProgress: orch.tasks.filter(t => t.status === 'in_progress').length,
      completed: orch.tasks.filter(t => t.status === 'completed').length,
      failed: orch.tasks.filter(t => t.status === 'failed').length
    };
  }

  /**
   * Get task results
   */
  getResults(orchestrationId: string): Array<{
    task: string;
    status: string;
    result?: any;
    error?: string;
  }> {
    const orch = this.orchestrations.get(orchestrationId);
    if (!orch) throw new Error('Orchestration not found');

    return orch.tasks.map(task => ({
      task: task.description,
      status: task.status,
      result: task.result,
      error: task.error
    }));
  }
}
