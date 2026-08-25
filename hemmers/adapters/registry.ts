/**
 * Adapter Registry
 * Central registry for all agent adapters
 */

import { AgentAdapter } from './adapter-api.js';
import { AgentDetection } from '../core/types/index.js';

export class AdapterRegistry {
  private adapters: Map<string, AgentAdapter> = new Map();
  private detectionCache: Map<string, AgentDetection> = new Map();

  /**
   * Register an adapter
   */
  register(adapter: AgentAdapter): void {
    if (this.adapters.has(adapter.id)) {
      throw new Error(`Adapter ${adapter.id} is already registered`);
    }
    this.adapters.set(adapter.id, adapter);
  }

  /**
   * Get adapter by ID
   */
  get(id: string): AgentAdapter | undefined {
    return this.adapters.get(id);
  }

  /**
   * List all registered adapter IDs
   */
  list(): string[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * Detect all installed agents
   */
  async detectAll(): Promise<AgentDetection[]> {
    const detections: AgentDetection[] = [];

    for (const [id, adapter] of this.adapters) {
      try {
        const detection = await adapter.detect();
        this.detectionCache.set(id, detection);
        detections.push(detection);
      } catch (error) {
        console.error(`Failed to detect ${id}:`, error);
        detections.push({
          name: adapter.name,
          path: '',
          detected: false
        });
      }
    }

    return detections;
  }

  /**
   * Get cached detection result
   */
  getDetection(id: string): AgentDetection | undefined {
    return this.detectionCache.get(id);
  }

  /**
   * Clear detection cache
   */
  clearCache(): void {
    this.detectionCache.clear();
  }

  /**
   * Get all detected (installed) agents
   */
  async getDetectedAgents(): Promise<Array<{ id: string; adapter: AgentAdapter; detection: AgentDetection }>> {
    const detections = await this.detectAll();
    const detected: Array<{ id: string; adapter: AgentAdapter; detection: AgentDetection }> = [];

    for (const detection of detections) {
      if (detection.detected) {
        const adapter = Array.from(this.adapters.values()).find(a => a.name === detection.name);
        if (adapter) {
          detected.push({
            id: adapter.id,
            adapter,
            detection
          });
        }
      }
    }

    return detected;
  }
}

// Global registry instance
export const registry = new AdapterRegistry();
