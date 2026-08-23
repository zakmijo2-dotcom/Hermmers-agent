/**
 * Permission System
 * Manages resource access control for skills, tools, and extensions
 */

import { Permission, PermissionRule, PermissionAction } from '../types';

export interface PermissionRequest {
  resource: string;
  scope?: string;
  requester: string; // skill/tool name
}

export interface PermissionDecision {
  allowed: boolean;
  action: PermissionAction;
  reason: string;
  rule?: PermissionRule;
}

export class PermissionManager {
  private rules: PermissionRule[] = [];
  private deniedCache: Set<string> = new Set();

  /**
   * Add permission rule
   */
  addRule(rule: PermissionRule): void {
    this.rules.push(rule);
  }

  /**
   * Remove permission rule
   */
  removeRule(index: number): void {
    if (index >= 0 && index < this.rules.length) {
      this.rules.splice(index, 1);
    }
  }

  /**
   * Check if permission is allowed
   */
  check(request: PermissionRequest): PermissionDecision {
    // Check cache first
    const cacheKey = `${request.requester}:${request.resource}:${request.scope || '*'}`;
    if (this.deniedCache.has(cacheKey)) {
      return {
        allowed: false,
        action: 'deny',
        reason: 'Previously denied (cached)'
      };
    }

    // Find matching rule
    for (const rule of this.rules) {
      if (this.matchesRule(request, rule)) {
        const allowed = rule.action === 'allow';

        // Cache denials
        if (!allowed) {
          this.deniedCache.add(cacheKey);
        }

        return {
          allowed,
          action: rule.action,
          reason: allowed ? 'Matched allow rule' : 'Matched deny rule',
          rule
        };
      }
    }

    // Default: ask
    return {
      allowed: false,
      action: 'ask',
      reason: 'No matching rule (default: ask)'
    };
  }

  /**
   * Check if request matches rule
   */
  private matchesRule(request: PermissionRequest, rule: PermissionRule): boolean {
    // Check resource match
    if (rule.permission.resource !== request.resource) {
      // Check wildcard match
      if (!this.matchesWildcard(rule.permission.resource, request.resource)) {
        return false;
      }
    }

    // Check scope match (if specified)
    if (rule.permission.scope && request.scope) {
      if (!this.matchesScope(rule.permission.scope, request.scope)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check wildcard resource match
   */
  private matchesWildcard(pattern: string, resource: string): boolean {
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*');

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(resource);
  }

  /**
   * Check scope match
   */
  private matchesScope(ruleScope: string, requestScope: string): boolean {
    // Exact match
    if (ruleScope === requestScope) return true;

    // Wildcard match
    if (ruleScope.endsWith('/*')) {
      const prefix = ruleScope.slice(0, -2);
      return requestScope.startsWith(prefix);
    }

    return false;
  }

  /**
   * Grant permission
   */
  grant(resource: string, scope?: string): void {
    this.addRule({
      permission: { resource, scope },
      action: 'allow'
    });
  }

  /**
   * Deny permission
   */
  deny(resource: string, scope?: string): void {
    this.addRule({
      permission: { resource, scope },
      action: 'deny'
    });
  }

  /**
   * Clear all rules
   */
  clearRules(): void {
    this.rules = [];
    this.deniedCache.clear();
  }

  /**
   * Get all rules
   */
  getRules(): PermissionRule[] {
    return [...this.rules];
  }

  /**
   * Clear denied cache
   */
  clearCache(): void {
    this.deniedCache.clear();
  }

  /**
   * Export rules as JSON
   */
  export(): string {
    return JSON.stringify(this.rules, null, 2);
  }

  /**
   * Import rules from JSON
   */
  import(json: string): void {
    const rules = JSON.parse(json) as PermissionRule[];
    this.rules = rules;
  }

  /**
   * Get permission statistics
   */
  getStats(): {
    totalRules: number;
    allowRules: number;
    denyRules: number;
    askRules: number;
    cachedDenials: number;
  } {
    const allow = this.rules.filter(r => r.action === 'allow').length;
    const deny = this.rules.filter(r => r.action === 'deny').length;
    const ask = this.rules.filter(r => r.action === 'ask').length;

    return {
      totalRules: this.rules.length,
      allowRules: allow,
      denyRules: deny,
      askRules: ask,
      cachedDenials: this.deniedCache.size
    };
  }
}
