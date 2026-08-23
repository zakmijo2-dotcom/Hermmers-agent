/**
 * Observable execution: callback-driven progress updates
 * Real-time tool execution state surfacing for UX transparency
 */

export type ExecutionEventType =
  | 'turn_start'
  | 'turn_end'
  | 'tool_call_start'
  | 'tool_call_progress'
  | 'tool_call_end'
  | 'tool_call_error'
  | 'learning_start'
  | 'learning_end'
  | 'skill_applied'
  | 'context_update'
  | 'provider_selected'
  | 'provider_fallback';

export interface ExecutionEvent {
  type: ExecutionEventType;
  timestamp: number;
  data: Record<string, any>;
}

export type ExecutionCallback = (event: ExecutionEvent) => void | Promise<void>;

export class ExecutionObserver {
  private callbacks: Map<ExecutionEventType, Set<ExecutionCallback>> = new Map();
  private allCallbacks: Set<ExecutionCallback> = new Set();

  /**
   * Subscribe to specific event type
   */
  on(eventType: ExecutionEventType, callback: ExecutionCallback): () => void {
    if (!this.callbacks.has(eventType)) {
      this.callbacks.set(eventType, new Set());
    }
    this.callbacks.get(eventType)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.callbacks.get(eventType)?.delete(callback);
    };
  }

  /**
   * Subscribe to all events
   */
  onAll(callback: ExecutionCallback): () => void {
    this.allCallbacks.add(callback);

    return () => {
      this.allCallbacks.delete(callback);
    };
  }

  /**
   * Emit event to subscribers
   */
  async emit(type: ExecutionEventType, data: Record<string, any> = {}): Promise<void> {
    const event: ExecutionEvent = {
      type,
      timestamp: Date.now(),
      data
    };

    // Call specific type callbacks
    const typeCallbacks = this.callbacks.get(type);
    if (typeCallbacks) {
      for (const callback of typeCallbacks) {
        try {
          await callback(event);
        } catch (error) {
          console.error(`Error in callback for ${type}:`, error);
        }
      }
    }

    // Call all-event callbacks
    for (const callback of this.allCallbacks) {
      try {
        await callback(event);
      } catch (error) {
        console.error(`Error in all-event callback:`, error);
      }
    }
  }

  /**
   * Clear all subscriptions
   */
  clear(): void {
    this.callbacks.clear();
    this.allCallbacks.clear();
  }

  /**
   * Get event statistics
   */
  getStats(): { type: ExecutionEventType; count: number }[] {
    // Would need to track event counts - simplified for now
    return [];
  }
}

/**
 * Progress tracker for multi-step operations
 */
export class ProgressTracker {
  private steps: Map<string, { total: number; current: number; label: string }> = new Map();

  constructor(private observer: ExecutionObserver) {}

  /**
   * Start tracking a multi-step operation
   */
  startOperation(operationId: string, totalSteps: number, label: string): void {
    this.steps.set(operationId, {
      total: totalSteps,
      current: 0,
      label
    });

    this.observer.emit('tool_call_start', {
      operationId,
      totalSteps,
      label
    });
  }

  /**
   * Update progress
   */
  updateProgress(operationId: string, currentStep: number, stepLabel?: string): void {
    const op = this.steps.get(operationId);
    if (!op) return;

    op.current = currentStep;

    this.observer.emit('tool_call_progress', {
      operationId,
      current: currentStep,
      total: op.total,
      label: op.label,
      stepLabel,
      percentage: Math.round((currentStep / op.total) * 100)
    });
  }

  /**
   * Complete operation
   */
  completeOperation(operationId: string, result?: any): void {
    const op = this.steps.get(operationId);
    if (!op) return;

    this.observer.emit('tool_call_end', {
      operationId,
      label: op.label,
      result
    });

    this.steps.delete(operationId);
  }

  /**
   * Fail operation
   */
  failOperation(operationId: string, error: Error): void {
    const op = this.steps.get(operationId);

    this.observer.emit('tool_call_error', {
      operationId,
      label: op?.label,
      error: error.message
    });

    this.steps.delete(operationId);
  }
}

/**
 * CLI-friendly event formatter
 */
export class ConsoleObserver {
  private startTimes: Map<string, number> = new Map();

  constructor(private verbose: boolean = false) {}

  /**
   * Get callback for console logging
   */
  getCallback(): ExecutionCallback {
    return (event: ExecutionEvent) => {
      switch (event.type) {
        case 'turn_start':
          console.log(`\n🔄 Turn ${event.data.turnId}: ${event.data.input}`);
          this.startTimes.set(event.data.turnId, event.timestamp);
          break;

        case 'turn_end':
          const duration = this.startTimes.get(event.data.turnId);
          const elapsed = duration ? `(${event.timestamp - duration}ms)` : '';
          console.log(`✓ Turn completed ${elapsed}\n`);
          break;

        case 'tool_call_start':
          console.log(`  🔧 ${event.data.label || event.data.operationId}`);
          this.startTimes.set(event.data.operationId, event.timestamp);
          break;

        case 'tool_call_progress':
          if (this.verbose) {
            console.log(`    ⏳ ${event.data.percentage}% - ${event.data.stepLabel || 'Processing...'}`);
          }
          break;

        case 'tool_call_end':
          const toolDuration = this.startTimes.get(event.data.operationId);
          const toolElapsed = toolDuration ? `${event.timestamp - toolDuration}ms` : '';
          console.log(`  ✓ ${event.data.label || event.data.operationId} (${toolElapsed})`);
          this.startTimes.delete(event.data.operationId);
          break;

        case 'tool_call_error':
          console.log(`  ✗ ${event.data.label || event.data.operationId}: ${event.data.error}`);
          break;

        case 'skill_applied':
          console.log(`  💡 Applied skill: ${event.data.skillName}`);
          break;

        case 'learning_start':
          console.log(`  🧠 Learning cycle started...`);
          break;

        case 'learning_end':
          console.log(`  🧠 Learned ${event.data.skillCount} new skill(s)`);
          break;

        case 'provider_selected':
          if (this.verbose) {
            console.log(`  🌐 Selected provider: ${event.data.providerName}`);
          }
          break;

        case 'provider_fallback':
          console.log(`  ⚠️  Fallback to ${event.data.providerName} after ${event.data.attempts} attempt(s)`);
          break;

        case 'context_update':
          if (this.verbose) {
            console.log(`  📝 Context updated (${event.data.type})`);
          }
          break;
      }
    };
  }
}
