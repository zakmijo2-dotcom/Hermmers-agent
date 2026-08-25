/**
 * Hook Engine
 * Universal lifecycle hooks with adapter translation
 */

import { Hook, HookType, HookContext, HookHandler } from '../types/index.js';

export interface RegisteredHook {
  id: string;
  hook: Hook;
  registeredAt: number;
  agent?: string;
}

export class HookEngine {
  private hooks: Map<string, RegisteredHook> = new Map();
  private handlers: Map<HookType, Set<HookHandler>> = new Map();

  /**
   * Register a hook
   */
  register(hook: Hook, agent?: string): string {
    const id = this.generateId();

    const registered: RegisteredHook = {
      id,
      hook,
      registeredAt: Date.now(),
      agent
    };

    this.hooks.set(id, registered);

    // Add handler to type-specific set
    if (!this.handlers.has(hook.type)) {
      this.handlers.set(hook.type, new Set());
    }
    this.handlers.get(hook.type)!.add(hook.handler);

    return id;
  }

  /**
   * Unregister a hook
   */
  unregister(id: string): boolean {
    const registered = this.hooks.get(id);
    if (!registered) return false;

    // Remove handler
    const handlers = this.handlers.get(registered.hook.type);
    if (handlers) {
      handlers.delete(registered.hook.handler);
    }

    this.hooks.delete(id);
    return true;
  }

  /**
   * Trigger hooks of specific type
   */
  async trigger(type: HookType, data: Record<string, any>, agent: string): Promise<void> {
    const handlers = this.handlers.get(type);
    if (!handlers || handlers.size === 0) return;

    const context: HookContext = {
      type,
      data,
      agent
    };

    // Get all registered hooks of this type
    const registered = Array.from(this.hooks.values())
      .filter(r => r.hook.type === type);

    // Sort by priority (higher first)
    registered.sort((a, b) => (b.hook.priority || 0) - (a.hook.priority || 0));

    // Execute handlers in priority order
    for (const reg of registered) {
      try {
        await reg.hook.handler(context);
      } catch (error) {
        console.error(`Hook ${reg.id} (${type}) failed:`, error);
      }
    }
  }

  /**
   * List hooks by type
   */
  listByType(type: HookType): RegisteredHook[] {
    return Array.from(this.hooks.values())
      .filter(r => r.hook.type === type);
  }

  /**
   * List all registered hooks
   */
  listAll(): RegisteredHook[] {
    return Array.from(this.hooks.values());
  }

  /**
   * Get hook by ID
   */
  get(id: string): RegisteredHook | undefined {
    return this.hooks.get(id);
  }

  /**
   * Clear all hooks
   */
  clear(): void {
    this.hooks.clear();
    this.handlers.clear();
  }

  /**
   * Generate unique hook ID
   */
  private generateId(): string {
    return `hook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get hooks for specific agent
   */
  getAgentHooks(agent: string): RegisteredHook[] {
    return Array.from(this.hooks.values())
      .filter(r => r.agent === agent);
  }

  /**
   * Count hooks by type
   */
  getStats(): Record<HookType, number> {
    const stats: Partial<Record<HookType, number>> = {};

    for (const reg of this.hooks.values()) {
      stats[reg.hook.type] = (stats[reg.hook.type] || 0) + 1;
    }

    return stats as Record<HookType, number>;
  }
}
