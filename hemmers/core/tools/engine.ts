/**
 * Tool System
 * Universal tool abstraction with strict security and permission enforcement
 */

import { Tool, ToolContext } from '../types/index.js';
import { SecurityEngine, ApprovalToken } from '../security/engine.js';
import { PermissionManager } from '../permissions/manager.js';

export interface RegisteredTool {
  tool: Tool;
  registeredAt: number;
  agent?: string;
}

export interface ToolExecutionResult {
  success: boolean;
  result?: unknown;
  error?: string;
  duration: number;
  requiresApproval?: boolean;
  approvalRequestId?: string;
}

export interface ToolExecutionOptions {
  approvalToken?: ApprovalToken;
  workspaceRoot?: string;
}

export class ToolEngine {
  private tools: Map<string, RegisteredTool> = new Map();
  private securityEngine: SecurityEngine;
  private permissionManager?: PermissionManager;

  constructor(options?: {
    securityEngine?: SecurityEngine;
    permissionManager?: PermissionManager;
  }) {
    this.securityEngine = options?.securityEngine || new SecurityEngine();
    this.permissionManager = options?.permissionManager;
  }

  /**
   * Set security engine
   */
  setSecurityEngine(securityEngine: SecurityEngine): void {
    this.securityEngine = securityEngine;
  }

  /**
   * Set permission manager
   */
  setPermissionManager(permissionManager: PermissionManager): void {
    this.permissionManager = permissionManager;
  }

  /**
   * Get security engine
   */
  getSecurityEngine(): SecurityEngine {
    return this.securityEngine;
  }

  /**
   * Register a tool
   */
  register(tool: Tool, agent?: string): void {
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
   * Execute a tool with mandatory security policy evaluation
   */
  async execute(
    name: string,
    params: unknown,
    context: ToolContext,
    options?: ToolExecutionOptions
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    const registered = this.tools.get(name);

    if (!registered) {
      return {
        success: false,
        error: `Tool "${name}" not found`,
        duration: 0
      };
    }

    const tool = registered.tool;
    const resource = tool.permissions?.[0]?.resource || `tool.${name}`;
    const agentId = context.agent || 'unknown';

    // 1. Check PermissionManager if configured (legacy compatibility)
    if (this.permissionManager) {
      const permDecision = this.permissionManager.check({
        resource,
        requester: agentId,
        scope: tool.permissions?.[0]?.scope
      });

      if (!permDecision.allowed) {
        return {
          success: false,
          error: `Permission denied: ${permDecision.reason}`,
          duration: Date.now() - startTime
        };
      }
    }

    // 2. Check SecurityEngine policy and approval tokens (fail-closed)
    const securityDecision = await this.securityEngine.checkSecurity({
      agentId,
      action: 'tool.execute',
      resource,
      params,
      context: {
        sessionId: context.sessionId,
        agent: context.agent,
        workspaceRoot: options?.workspaceRoot || process.cwd()
      },
      approvalToken: options?.approvalToken
    });

    if (!securityDecision.allowed) {
      return {
        success: false,
        error: `Security violation: ${securityDecision.reason}`,
        requiresApproval: securityDecision.requiresApproval,
        approvalRequestId: securityDecision.approvalRequestId,
        duration: Date.now() - startTime
      };
    }

    // 3. Execute tool safely
    try {
      const result = await tool.execute(params, context);
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
    return Array.from(this.tools.values()).filter(t => t.agent === agent || !t.agent);
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
      const agent = reg.agent || 'global';
      byAgent[agent] = (byAgent[agent] || 0) + 1;
    }

    return {
      total: this.tools.size,
      byAgent
    };
  }
}
