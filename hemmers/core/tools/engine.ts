/**
 * Tool System
 * Universal tool abstraction with permission management
 */

import { Tool, Permission, ToolContext } from '../types';

export interface RegisteredTool {
  tool: Tool;
  registeredAt: number;
  agent?: string;
}

export interface ToolExecutionResult {
  success: boolean;
  result?: any;
  error?: string;
  duration: number;
}

export class ToolEngine {
  private tools: Map<string, RegisteredTool> = new Map();

  /**
   * Register a tool
   */
  register(tool: Tool, agent?: string): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool ${tool.name} is already registered`);
    }

    this.tools.set(tool.name, {
      tool,
      registeredAt: Date.now(),
      agent
    });
  }

  /**
   * Unregister a tool
   */
  unregister(name: string): boolean {
    return this.tools.delete(name);
  }

  /**
   * Execute a tool
   */
  async execute(
    name: string,
    params: any,
    context: ToolContext
  ): Promise<ToolExecutionResult> {
    const registered = this.tools.get(name);

    if (!registered) {
      return {
        success: false,
        error: `Tool ${name} not found`,
        duration: 0
      };
    }

    const startTime = Date.now();

    try {
      // Validate permissions (would integrate with permission system)
      // For now, just execute

      const result = await registered.tool.execute(params, context);

      return {
        success: true,
        result,
        duration: Date.now() - startTime
      };

    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Get tool by name
   */
  get(name: string): Tool | undefined {
    return this.tools.get(name)?.tool;
  }

  /**
   * List all tools
   */
  listAll(): RegisteredTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * List tools for specific agent
   */
  listAgentTools(agent: string): RegisteredTool[] {
    return Array.from(this.tools.values())
      .filter(r => r.agent === agent);
  }

  /**
   * Check if tool exists
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Get tool statistics
   */
  getStats(): {
    total: number;
    byAgent: Record<string, number>;
  } {
    const byAgent: Record<string, number> = {};

    for (const reg of this.tools.values()) {
      if (reg.agent) {
        byAgent[reg.agent] = (byAgent[reg.agent] || 0) + 1;
      }
    }

    return {
      total: this.tools.size,
      byAgent
    };
  }
}
