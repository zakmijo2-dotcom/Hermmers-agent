/**
 * Permission System
 * Manages resource access control for skills, tools, and extensions
 */

import { Permission, PermissionRule, PermissionAction } from '../types/index.js';

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
   * Deny rules ALWAYS take precedence over allow rules when conflicting
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

    let matchingDeny: PermissionRule | null = null;
    let matchingAsk: PermissionRule | null = null;
    let matchingAllow: PermissionRule | null = null;

    // Find all matching rules
    for (const rule of this.rules) {
      if (this.matchesRule(request, rule)) {
        if (rule.action === 'deny') {
          matchingDeny = rule;
          break; // Deny is immediately terminal
        } else if (rule.action === 'ask') {
          if (!matchingAsk) matchingAsk = rule;
        } else if (rule.action === 'allow') {
          if (!matchingAllow) matchingAllow = rule;
        }
      }
    }

    // 1. Deny wins
    if (matchingDeny) {
      this.deniedCache.add(cacheKey);
      return {
        allowed: false,
        action: 'deny',
        reason: 'Matched deny rule (deny takes precedence)',
        rule: matchingDeny
      };
    }

    // 2. Ask wins over allow
    if (matchingAsk) {
      return {
        allowed: false,
        action: 'ask',
        reason: 'Matched ask rule (requires user confirmation)',
        rule: matchingAsk
      };
    }

    // 3. Allow
    if (matchingAllow) {
      return {
        allowed: true,
        action: 'allow',
        reason: 'Matched allow rule',
        rule: matchingAllow
      };
    }

    // 4. Default: ask
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

    // Wildcard match (e.g., '/project/*' matches '/project/src/index.ts')
    if (ruleScope.endsWith('/*')) {
      const prefix = ruleScope.slice(0, -2);
      return requestScope.startsWith(prefix);
    }

    return false;
  }

  /**
   * Clear denial cache
   */
  clearCache(): void {
    this.deniedCache.clear();
  }

  /**
   * Export all rules
   */
  getRules(): PermissionRule[] {
    return [...this.rules];
  }
}
