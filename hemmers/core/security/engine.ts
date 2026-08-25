/**
 * Security Engine
 * Comprehensive security layer for tool execution and agent actions
 */

import { randomUUID } from 'crypto';
import {
  computeRequestHash,
  redactSecrets,
  resolveSafePath,
  isPrivateOrLoopbackHost,
  isSensitiveEnvKey
} from './safety.js';

export interface SecurityPolicy {
  id: string;
  name: string;
  rules: SecurityRule[];
  enabled: boolean;
}

export interface SecurityRule {
  resource: string;
  action: 'allow' | 'deny' | 'approve' | 'ask';
  conditions?: SecurityCondition[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  description?: string;
}

export interface SecurityCondition {
  type: 'path' | 'network' | 'time' | 'user' | 'context' | 'command';
  operator: 'equals' | 'contains' | 'matches' | 'in_range' | 'inside_workspace' | 'not_matches';
  value: unknown;
}

export interface SecurityAuditLog {
  id: string;
  timestamp: number;
  agentId: string;
  action: string;
  resource: string;
  decision: 'allowed' | 'denied' | 'approved' | 'approval_required';
  riskLevel: string;
  reason: string;
  context?: Record<string, unknown>;
}

export interface ApprovalRequest {
  id: string;
  agentId: string;
  action: string;
  resource: string;
  requestHash: string;
  params?: unknown;
  context?: Record<string, unknown>;
  riskLevel: string;
  reason: string;
  timestamp: number;
  expiresAt: number;
}

export interface ApprovalToken {
  id: string;
  requestId: string;
  requestHash: string;
  action: string;
  resource: string;
  expiresAt: number;
  createdAt: number;
  approvedBy?: string;
}

export interface SecurityCheckRequest {
  agentId: string;
  action: string;
  resource: string;
  params?: unknown;
  context?: Record<string, unknown>;
  approvalToken?: ApprovalToken;
}

export interface SecurityCheckDecision {
  allowed: boolean;
  requiresApproval: boolean;
  approvalRequestId?: string;
  riskLevel: string;
  reason: string;
}

export class SecurityEngine {
  private policies: Map<string, SecurityPolicy> = new Map();
  private auditLogs: SecurityAuditLog[] = [];
  private approvalQueue: Map<string, ApprovalRequest> = new Map();
  private activeTokens: Map<string, ApprovalToken> = new Map();
  private readonly defaultTtlMs = 5 * 60 * 1000; // 5 minutes

  constructor(initialPolicies?: SecurityPolicy[]) {
    if (initialPolicies && initialPolicies.length > 0) {
      for (const policy of initialPolicies) {
        this.addPolicy(policy);
      }
    } else {
      for (const policy of SecurityEngine.createStandardPolicies()) {
        this.addPolicy(policy);
      }
    }
  }

  /**
   * Add security policy
   */
  addPolicy(policy: SecurityPolicy): void {
    this.policies.set(policy.id, policy);
  }

  /**
   * Remove security policy
   */
  removePolicy(id: string): boolean {
    return this.policies.delete(id);
  }

  /**
   * Check security for action with strict policy evaluation and token validation
   */
  async checkSecurity(request: SecurityCheckRequest): Promise<SecurityCheckDecision> {
    const { agentId, action, resource, params, context, approvalToken } = request;
    const requestHash = computeRequestHash(action, resource, params);

    // 1. If approval token is provided, validate it first
    if (approvalToken) {
      const storedToken = this.activeTokens.get(approvalToken.id);
      if (storedToken) {
        const isExpired = Date.now() > storedToken.expiresAt;
        const hashMatches = storedToken.requestHash === requestHash;
        const targetMatches = storedToken.action === action && storedToken.resource === resource;

        if (!isExpired && hashMatches && targetMatches) {
          this.logAudit({
            id: `sec_${randomUUID()}`,
            timestamp: Date.now(),
            agentId,
            action,
            resource,
            decision: 'allowed',
            riskLevel: 'low',
            reason: `Allowed via valid approval token (id: ${storedToken.id})`,
            context: redactSecrets(context)
          });

          return {
            allowed: true,
            requiresApproval: false,
            riskLevel: 'low',
            reason: 'Allowed via valid approval token'
          };
        } else {
          this.logAudit({
            id: `sec_${randomUUID()}`,
            timestamp: Date.now(),
            agentId,
            action,
            resource,
            decision: 'denied',
            riskLevel: 'high',
            reason: isExpired ? 'Approval token expired' : 'Approval token hash or target mismatch (tampered)',
            context: redactSecrets(context)
          });

          return {
            allowed: false,
            requiresApproval: false,
            riskLevel: 'high',
            reason: isExpired ? 'Approval token expired' : 'Invalid or tampered approval token'
          };
        }
      }
    }

    // 2. Evaluate all active policies
    // CRITICAL: Deny rules ALWAYS override allow rules
    let hasMatchingDeny: { rule: SecurityRule; reason: string } | null = null;
    let hasMatchingApprove: { rule: SecurityRule; reason: string } | null = null;
    let hasMatchingAllow: { rule: SecurityRule; reason: string } | null = null;

    for (const policy of this.policies.values()) {
      if (!policy.enabled) continue;

      for (const rule of policy.rules) {
        if (this.matchesRule(request, rule)) {
          if (rule.action === 'deny') {
            hasMatchingDeny = { rule, reason: rule.description || 'Matched explicit deny rule' };
            break; // Deny is terminal for this policy
          } else if (rule.action === 'approve' || rule.action === 'ask') {
            if (!hasMatchingApprove) {
              hasMatchingApprove = { rule, reason: rule.description || 'Action requires approval' };
            }
          } else if (rule.action === 'allow') {
            if (!hasMatchingAllow) {
              hasMatchingAllow = { rule, reason: rule.description || 'Matched allow rule' };
            }
          }
        }
      }

      if (hasMatchingDeny) break;
    }

    // A. Explicit Deny
    if (hasMatchingDeny) {
      this.logAudit({
        id: `sec_${randomUUID()}`,
        timestamp: Date.now(),
        agentId,
        action,
        resource,
        decision: 'denied',
        riskLevel: hasMatchingDeny.rule.riskLevel,
        reason: hasMatchingDeny.reason,
        context: redactSecrets(context)
      });

      return {
        allowed: false,
        requiresApproval: false,
        riskLevel: hasMatchingDeny.rule.riskLevel,
        reason: hasMatchingDeny.reason
      };
    }

    // B. Explicit Approval Required
    if (hasMatchingApprove) {
      const approvalId = `appr_${Date.now()}_${randomUUID().slice(0, 8)}`;
      const approvalRequest: ApprovalRequest = {
        id: approvalId,
        agentId,
        action,
        resource,
        requestHash,
        params,
        context,
        riskLevel: hasMatchingApprove.rule.riskLevel,
        reason: hasMatchingApprove.reason,
        timestamp: Date.now(),
        expiresAt: Date.now() + this.defaultTtlMs
      };

      this.approvalQueue.set(approvalId, approvalRequest);

      this.logAudit({
        id: `sec_${randomUUID()}`,
        timestamp: Date.now(),
        agentId,
        action,
        resource,
        decision: 'approval_required',
        riskLevel: hasMatchingApprove.rule.riskLevel,
        reason: hasMatchingApprove.reason,
        context: redactSecrets(context)
      });

      return {
        allowed: false,
        requiresApproval: true,
        approvalRequestId: approvalId,
        riskLevel: hasMatchingApprove.rule.riskLevel,
        reason: hasMatchingApprove.reason
      };
    }

    // C. Explicit Allow
    if (hasMatchingAllow) {
      this.logAudit({
        id: `sec_${randomUUID()}`,
        timestamp: Date.now(),
        agentId,
        action,
        resource,
        decision: 'allowed',
        riskLevel: hasMatchingAllow.rule.riskLevel,
        reason: hasMatchingAllow.reason,
        context: redactSecrets(context)
      });

      return {
        allowed: true,
        requiresApproval: false,
        riskLevel: hasMatchingAllow.rule.riskLevel,
        reason: hasMatchingAllow.reason
      };
    }

    // D. Default fail-closed: Ask for approval on unknown resources
    const defaultApprovalId = `appr_${Date.now()}_${randomUUID().slice(0, 8)}`;
    const defaultApprovalRequest: ApprovalRequest = {
      id: defaultApprovalId,
      agentId,
      action,
      resource,
      requestHash,
      params,
      context,
      riskLevel: 'medium',
      reason: 'No explicit matching policy (default: requires approval)',
      timestamp: Date.now(),
      expiresAt: Date.now() + this.defaultTtlMs
    };

    this.approvalQueue.set(defaultApprovalId, defaultApprovalRequest);

    this.logAudit({
      id: `sec_${randomUUID()}`,
      timestamp: Date.now(),
      agentId,
      action,
      resource,
      decision: 'approval_required',
      riskLevel: 'medium',
      reason: 'No explicit matching policy (default: requires approval)',
      context: redactSecrets(context)
    });

    return {
      allowed: false,
      requiresApproval: true,
      approvalRequestId: defaultApprovalId,
      riskLevel: 'medium',
      reason: 'No matching policy rule (default: approval required)'
    };
  }

  /**
   * Approve a pending request and generate an ApprovalToken
   */
  approveRequest(requestId: string, approvedBy: string = 'user'): ApprovalToken | null {
    const pending = this.approvalQueue.get(requestId);
    if (!pending) return null;

    // Check expiration
    if (Date.now() > pending.expiresAt) {
      this.approvalQueue.delete(requestId);
      return null;
    }

    this.approvalQueue.delete(requestId);

    const token: ApprovalToken = {
      id: `tok_${randomUUID()}`,
      requestId: pending.id,
      requestHash: pending.requestHash,
      action: pending.action,
      resource: pending.resource,
      expiresAt: Date.now() + this.defaultTtlMs,
      createdAt: Date.now(),
      approvedBy
    };

    this.activeTokens.set(token.id, token);

    this.logAudit({
      id: `sec_${randomUUID()}`,
      timestamp: Date.now(),
      agentId: pending.agentId,
      action: pending.action,
      resource: pending.resource,
      decision: 'approved',
      riskLevel: pending.riskLevel,
      reason: `Request approved by ${approvedBy}`,
      context: redactSecrets(pending.context)
    });

    return token;
  }

  /**
   * Deny a pending approval request
   */
  denyRequest(requestId: string, reason: string = 'Denied by user'): boolean {
    const pending = this.approvalQueue.get(requestId);
    if (!pending) return false;

    this.approvalQueue.delete(requestId);

    this.logAudit({
      id: `sec_${randomUUID()}`,
      timestamp: Date.now(),
      agentId: pending.agentId,
      action: pending.action,
      resource: pending.resource,
      decision: 'denied',
      riskLevel: pending.riskLevel,
      reason,
      context: redactSecrets(pending.context)
    });

    return true;
  }

  /**
   * Get all pending approval requests
   */
  getApprovalQueue(): ApprovalRequest[] {
    const now = Date.now();
    const result: ApprovalRequest[] = [];

    for (const [id, req] of this.approvalQueue.entries()) {
      if (now > req.expiresAt) {
        this.approvalQueue.delete(id);
      } else {
        result.push(req);
      }
    }

    return result;
  }

  /**
   * Match request against security rule
   */
  private matchesRule(request: SecurityCheckRequest, rule: SecurityRule): boolean {
    // Resource match
    if (rule.resource !== '*' && rule.resource !== request.resource) {
      if (rule.resource.endsWith('.*')) {
        const prefix = rule.resource.slice(0, -2);
        if (!request.resource.startsWith(prefix)) {
          return false;
        }
      } else {
        return false;
      }
    }

    // Conditions check
    if (rule.conditions && rule.conditions.length > 0) {
      for (const condition of rule.conditions) {
        if (!this.evaluateCondition(request, condition)) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Evaluate condition
   */
  private evaluateCondition(request: SecurityCheckRequest, condition: SecurityCondition): boolean {
    let targetValue: unknown;

    if (condition.type === 'path') {
      const paramsObj = request.params as Record<string, unknown> | undefined;
      targetValue = paramsObj?.path || paramsObj?.source || paramsObj?.destination || request.context?.path;
    } else if (condition.type === 'command') {
      const paramsObj = request.params as Record<string, unknown> | undefined;
      targetValue = paramsObj?.command || paramsObj?.package || request.context?.command;
    } else {
      targetValue = request.context?.[condition.type];
    }

    switch (condition.operator) {
      case 'equals':
        return targetValue === condition.value;
      case 'contains':
        return typeof targetValue === 'string' && targetValue.includes(String(condition.value));
      case 'matches':
        return typeof targetValue === 'string' && new RegExp(String(condition.value)).test(targetValue);
      case 'not_matches':
        return typeof targetValue === 'string' && !new RegExp(String(condition.value)).test(targetValue);
      case 'inside_workspace': {
        if (typeof targetValue !== 'string') return false;
        const workspace = (request.context?.workspaceRoot as string) || process.cwd();
        try {
          resolveSafePath(targetValue, workspace, false);
          return true;
        } catch {
          return false;
        }
      }
      default:
        return false;
    }
  }

  /**
   * Log audit entry with redaction
   */
  private logAudit(log: SecurityAuditLog): void {
    this.auditLogs.push(log);
    if (this.auditLogs.length > 10000) {
      this.auditLogs = this.auditLogs.slice(-10000);
    }
  }

  /**
   * Get filtered audit logs
   */
  getAuditLogs(filter?: {
    agentId?: string;
    decision?: string;
    riskLevel?: string;
    startTime?: number;
    endTime?: number;
  }): SecurityAuditLog[] {
    let logs = this.auditLogs;

    if (filter) {
      if (filter.agentId) {
        logs = logs.filter(l => l.agentId === filter.agentId);
      }
      if (filter.decision) {
        logs = logs.filter(l => l.decision === filter.decision);
      }
      if (filter.riskLevel) {
        logs = logs.filter(l => l.riskLevel === filter.riskLevel);
      }
      if (filter.startTime) {
        logs = logs.filter(l => l.timestamp >= filter.startTime!);
      }
      if (filter.endTime) {
        logs = logs.filter(l => l.timestamp <= filter.endTime!);
      }
    }

    return [...logs];
  }

  /**
   * Standard production-grade security policies
   */
  static createStandardPolicies(): SecurityPolicy[] {
    return [
      {
        id: 'filesystem-policy',
        name: 'Workspace Filesystem Isolation',
        enabled: true,
        rules: [
          {
            resource: 'filesystem.read',
            action: 'allow',
            riskLevel: 'low',
            description: 'Allow reading inside workspace'
          },
          {
            resource: 'filesystem.write',
            action: 'allow',
            riskLevel: 'medium',
            description: 'Allow writing inside workspace'
          },
          {
            resource: 'filesystem.delete',
            action: 'approve',
            riskLevel: 'high',
            description: 'File deletion requires approval'
          }
        ]
      },
      {
        id: 'shell-policy',
        name: 'Safe Shell Execution',
        enabled: true,
        rules: [
          {
            resource: 'shell.execute',
            action: 'deny',
            riskLevel: 'critical',
            description: 'Deny dangerous destructive commands',
            conditions: [
              {
                type: 'command',
                operator: 'matches',
                value: 'rm\\s+(-[rfRF]+\\s+)?[\\/\\\\]|mkfs|dd\\s+if='
              }
            ]
          },
          {
            resource: 'shell.execute',
            action: 'approve',
            riskLevel: 'high',
            description: 'Shell execution requires approval by default'
          }
        ]
      },
      {
        id: 'git-policy',
        name: 'Git Version Control',
        enabled: true,
        rules: [
          {
            resource: 'git.read',
            action: 'allow',
            riskLevel: 'low',
            description: 'Allow git inspection'
          },
          {
            resource: 'git.write',
            action: 'allow',
            riskLevel: 'medium',
            description: 'Allow git commit/branch/switch'
          }
        ]
      },
      {
        id: 'network-policy',
        name: 'Network Access & SSRF Protection',
        enabled: true,
        rules: [
          {
            resource: 'network.http',
            action: 'allow',
            riskLevel: 'medium',
            description: 'Allow outbound HTTP requests to public endpoints'
          },
          {
            resource: 'network.*',
            action: 'deny',
            riskLevel: 'high',
            description: 'Deny non-HTTP network operations'
          }
        ]
      },
      {
        id: 'system-policy',
        name: 'System and Environment Protection',
        enabled: true,
        rules: [
          {
            resource: 'system.read',
            action: 'allow',
            riskLevel: 'low',
            description: 'Allow non-sensitive environment and system inspection'
          }
        ]
      }
    ];
  }
}
