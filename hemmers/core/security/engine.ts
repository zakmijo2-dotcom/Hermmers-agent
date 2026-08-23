/**
 * Security Engine
 * Comprehensive security layer for tool execution and agent actions
 */

export interface SecurityPolicy {
  id: string;
  name: string;
  rules: SecurityRule[];
  enabled: boolean;
}

export interface SecurityRule {
  resource: string;
  action: 'allow' | 'deny' | 'approve';
  conditions?: SecurityCondition[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface SecurityCondition {
  type: 'path' | 'network' | 'time' | 'user' | 'context';
  operator: 'equals' | 'contains' | 'matches' | 'in_range';
  value: any;
}

export interface SecurityAuditLog {
  id: string;
  timestamp: number;
  agentId: string;
  action: string;
  resource: string;
  decision: 'allowed' | 'denied' | 'approved';
  riskLevel: string;
  context?: Record<string, any>;
}

export class SecurityEngine {
  private policies: Map<string, SecurityPolicy> = new Map();
  private auditLogs: SecurityAuditLog[] = [];
  private approvalQueue: Array<{
    id: string;
    request: any;
    timestamp: number;
  }> = [];

  /**
   * Add security policy
   */
  addPolicy(policy: SecurityPolicy): void {
    this.policies.set(policy.id, policy);
  }

  /**
   * Check security for action
   */
  async checkSecurity(request: {
    agentId: string;
    action: string;
    resource: string;
    context?: Record<string, any>;
  }): Promise<{
    allowed: boolean;
    requiresApproval: boolean;
    riskLevel: string;
    reason: string;
  }> {
    // Check all policies
    for (const policy of this.policies.values()) {
      if (!policy.enabled) continue;

      for (const rule of policy.rules) {
        if (this.matchesRule(request, rule)) {
          // Log audit
          this.logAudit({
            id: this.generateId(),
            timestamp: Date.now(),
            agentId: request.agentId,
            action: request.action,
            resource: request.resource,
            decision: rule.action === 'allow' ? 'allowed' : 'denied',
            riskLevel: rule.riskLevel,
            context: request.context
          });

          if (rule.action === 'approve') {
            // Add to approval queue
            this.approvalQueue.push({
              id: this.generateId(),
              request,
              timestamp: Date.now()
            });

            return {
              allowed: false,
              requiresApproval: true,
              riskLevel: rule.riskLevel,
              reason: 'Requires manual approval'
            };
          }

          return {
            allowed: rule.action === 'allow',
            requiresApproval: false,
            riskLevel: rule.riskLevel,
            reason: rule.action === 'allow' ? 'Matched allow rule' : 'Matched deny rule'
          };
        }
      }
    }

    // Default: deny high-risk actions
    return {
      allowed: false,
      requiresApproval: false,
      riskLevel: 'high',
      reason: 'No matching policy (default deny)'
    };
  }

  /**
   * Check if request matches rule
   */
  private matchesRule(request: any, rule: SecurityRule): boolean {
    // Simple resource matching
    if (rule.resource !== '*' && !request.resource.startsWith(rule.resource)) {
      return false;
    }

    // Check conditions
    if (rule.conditions) {
      for (const condition of rule.conditions) {
        if (!this.evaluateCondition(request, condition)) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Evaluate security condition
   */
  private evaluateCondition(request: any, condition: SecurityCondition): boolean {
    const contextValue = request.context?.[condition.type];

    switch (condition.operator) {
      case 'equals':
        return contextValue === condition.value;
      case 'contains':
        return String(contextValue).includes(condition.value);
      case 'matches':
        return new RegExp(condition.value).test(String(contextValue));
      default:
        return false;
    }
  }

  /**
   * Log security audit
   */
  private logAudit(log: SecurityAuditLog): void {
    this.auditLogs.push(log);

    // Trim old logs (keep last 10000)
    if (this.auditLogs.length > 10000) {
      this.auditLogs = this.auditLogs.slice(-10000);
    }
  }

  /**
   * Get audit logs
   */
  getAuditLogs(filter?: {
    agentId?: string;
    startTime?: number;
    endTime?: number;
    riskLevel?: string;
  }): SecurityAuditLog[] {
    let logs = this.auditLogs;

    if (filter) {
      if (filter.agentId) {
        logs = logs.filter(l => l.agentId === filter.agentId);
      }
      if (filter.startTime) {
        logs = logs.filter(l => l.timestamp >= filter.startTime!);
      }
      if (filter.endTime) {
        logs = logs.filter(l => l.timestamp <= filter.endTime!);
      }
      if (filter.riskLevel) {
        logs = logs.filter(l => l.riskLevel === filter.riskLevel);
      }
    }

    return logs;
  }

  /**
   * Get approval queue
   */
  getApprovalQueue(): Array<{
    id: string;
    request: any;
    timestamp: number;
  }> {
    return this.approvalQueue;
  }

  /**
   * Approve request
   */
  approveRequest(requestId: string): boolean {
    const index = this.approvalQueue.findIndex(r => r.id === requestId);
    if (index >= 0) {
      this.approvalQueue.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Deny request
   */
  denyRequest(requestId: string): boolean {
    const index = this.approvalQueue.findIndex(r => r.id === requestId);
    if (index >= 0) {
      this.approvalQueue.splice(index, 1);
      return true;
    }
    return false;
  }

  private generateId(): string {
    return `sec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create standard policies
   */
  static createStandardPolicies(): SecurityPolicy[] {
    return [
      {
        id: 'filesystem-safe',
        name: 'Safe Filesystem Access',
        enabled: true,
        rules: [
          {
            resource: 'filesystem.read',
            action: 'allow',
            riskLevel: 'low',
            conditions: [{
              type: 'path',
              operator: 'contains',
              value: '/project/'
            }]
          },
          {
            resource: 'filesystem.write',
            action: 'approve',
            riskLevel: 'medium'
          },
          {
            resource: 'filesystem.delete',
            action: 'approve',
            riskLevel: 'high'
          }
        ]
      },
      {
        id: 'shell-restricted',
        name: 'Restricted Shell Access',
        enabled: true,
        rules: [
          {
            resource: 'shell.execute',
            action: 'approve',
            riskLevel: 'high'
          },
          {
            resource: 'shell.execute',
            action: 'deny',
            riskLevel: 'critical',
            conditions: [{
              type: 'context',
              operator: 'contains',
              value: 'rm -rf'
            }]
          }
        ]
      },
      {
        id: 'network-controlled',
        name: 'Network Access Control',
        enabled: true,
        rules: [
          {
            resource: 'network.http',
            action: 'approve',
            riskLevel: 'medium'
          },
          {
            resource: 'network.*',
            action: 'deny',
            riskLevel: 'high'
          }
        ]
      }
    ];
  }
}
