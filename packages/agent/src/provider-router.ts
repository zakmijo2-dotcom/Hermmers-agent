/**
 * Adaptive provider routing with fallback chains
 * Hermès-style resilience with provider health tracking
 */

export interface ProviderConfig {
  id: string;
  name: string;
  baseUrl?: string;
  apiKey?: string;
  models: string[];
  priority: number;
  maxRetries: number;
}

export interface ProviderHealth {
  providerId: string;
  successCount: number;
  failureCount: number;
  avgLatency: number;
  lastFailure?: number;
  lastSuccess?: number;
  healthScore: number; // 0-1
}

export interface RoutingDecision {
  provider: ProviderConfig;
  reason: string;
  fallbackChain: ProviderConfig[];
}

export class ProviderRouter {
  private providers: Map<string, ProviderConfig> = new Map();
  private healthMetrics: Map<string, ProviderHealth> = new Map();
  private readonly HEALTH_DECAY = 0.95; // Exponential decay for old metrics
  private readonly FAILURE_PENALTY = 0.3;
  private readonly SUCCESS_BOOST = 0.1;
  private readonly BACKOFF_BASE = 1000; // 1 second base backoff

  constructor(providers: ProviderConfig[]) {
    for (const provider of providers) {
      this.providers.set(provider.id, provider);
      this.healthMetrics.set(provider.id, {
        providerId: provider.id,
        successCount: 0,
        failureCount: 0,
        avgLatency: 0,
        healthScore: 1.0 // Start optimistic
      });
    }
  }

  /**
   * Select best provider for request with fallback chain
   */
  selectProvider(requirements?: {
    model?: string;
    excludeProviders?: string[];
  }): RoutingDecision | null {
    const candidates = this.getCandidates(requirements);

    if (candidates.length === 0) {
      return null;
    }

    // Sort by health score and priority
    const sorted = candidates.sort((a, b) => {
      const healthA = this.healthMetrics.get(a.id)!;
      const healthB = this.healthMetrics.get(b.id)!;

      // Check if provider is in backoff period
      const backoffA = this.isInBackoff(a.id);
      const backoffB = this.isInBackoff(b.id);

      if (backoffA && !backoffB) return 1;
      if (!backoffA && backoffB) return -1;

      // Weighted score: 70% health, 30% priority
      const scoreA = healthA.healthScore * 0.7 + (a.priority / 100) * 0.3;
      const scoreB = healthB.healthScore * 0.7 + (b.priority / 100) * 0.3;

      return scoreB - scoreA;
    });

    const primary = sorted[0];
    const fallbackChain = sorted.slice(1, 4); // Up to 3 fallbacks

    return {
      provider: primary,
      reason: `Selected ${primary.name} (health: ${this.healthMetrics.get(primary.id)!.healthScore.toFixed(2)}, priority: ${primary.priority})`,
      fallbackChain
    };
  }

  /**
   * Execute with automatic fallback on failure
   */
  async executeWithFallback<T>(
    fn: (provider: ProviderConfig) => Promise<T>,
    requirements?: {
      model?: string;
      excludeProviders?: string[];
    }
  ): Promise<{ result: T; provider: ProviderConfig; attempts: number }> {
    const decision = this.selectProvider(requirements);

    if (!decision) {
      throw new Error('No providers available');
    }

    const attemptOrder = [decision.provider, ...decision.fallbackChain];
    let lastError: Error | null = null;

    for (let i = 0; i < attemptOrder.length; i++) {
      const provider = attemptOrder[i];
      const startTime = Date.now();

      try {
        const result = await this.executeWithRetry(fn, provider);
        const latency = Date.now() - startTime;

        this.recordSuccess(provider.id, latency);

        return {
          result,
          provider,
          attempts: i + 1
        };

      } catch (error) {
        lastError = error as Error;
        const latency = Date.now() - startTime;

        this.recordFailure(provider.id, latency);

        // Continue to next provider in fallback chain
        if (i < attemptOrder.length - 1) {
          console.log(`[ProviderRouter] ${provider.name} failed, trying fallback...`);
        }
      }
    }

    throw new Error(`All providers failed. Last error: ${lastError?.message}`);
  }

  /**
   * Execute with retries on single provider
   */
  private async executeWithRetry<T>(
    fn: (provider: ProviderConfig) => Promise<T>,
    provider: ProviderConfig
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < provider.maxRetries; attempt++) {
      try {
        return await fn(provider);
      } catch (error) {
        lastError = error as Error;

        // Exponential backoff between retries
        if (attempt < provider.maxRetries - 1) {
          const backoff = this.BACKOFF_BASE * Math.pow(2, attempt);
          await this.sleep(backoff);
        }
      }
    }

    throw lastError;
  }

  /**
   * Record successful execution
   */
  recordSuccess(providerId: string, latency: number): void {
    const metrics = this.healthMetrics.get(providerId);
    if (!metrics) return;

    metrics.successCount++;
    metrics.lastSuccess = Date.now();

    // Update average latency with exponential moving average
    if (metrics.avgLatency === 0) {
      metrics.avgLatency = latency;
    } else {
      metrics.avgLatency = metrics.avgLatency * 0.9 + latency * 0.1;
    }

    // Boost health score
    metrics.healthScore = Math.min(1.0, metrics.healthScore + this.SUCCESS_BOOST);

    this.healthMetrics.set(providerId, metrics);
  }

  /**
   * Record failed execution
   */
  recordFailure(providerId: string, latency: number): void {
    const metrics = this.healthMetrics.get(providerId);
    if (!metrics) return;

    metrics.failureCount++;
    metrics.lastFailure = Date.now();

    // Penalize health score
    metrics.healthScore = Math.max(0.0, metrics.healthScore - this.FAILURE_PENALTY);

    this.healthMetrics.set(providerId, metrics);
  }

  /**
   * Check if provider is in exponential backoff period
   */
  private isInBackoff(providerId: string): boolean {
    const metrics = this.healthMetrics.get(providerId);
    if (!metrics || !metrics.lastFailure) return false;

    const timeSinceFailure = Date.now() - metrics.lastFailure;
    const backoffDuration = this.BACKOFF_BASE * Math.pow(2, Math.min(metrics.failureCount, 5));

    return timeSinceFailure < backoffDuration;
  }

  /**
   * Get candidate providers matching requirements
   */
  private getCandidates(requirements?: {
    model?: string;
    excludeProviders?: string[];
  }): ProviderConfig[] {
    const candidates: ProviderConfig[] = [];

    for (const provider of this.providers.values()) {
      // Skip excluded
      if (requirements?.excludeProviders?.includes(provider.id)) {
        continue;
      }

      // Check model support
      if (requirements?.model && !provider.models.includes(requirements.model)) {
        continue;
      }

      candidates.push(provider);
    }

    return candidates;
  }

  /**
   * Get health metrics for all providers
   */
  getHealthMetrics(): ProviderHealth[] {
    return Array.from(this.healthMetrics.values());
  }

  /**
   * Reset health metrics (for testing)
   */
  resetHealth(providerId?: string): void {
    if (providerId) {
      const metrics = this.healthMetrics.get(providerId);
      if (metrics) {
        metrics.successCount = 0;
        metrics.failureCount = 0;
        metrics.healthScore = 1.0;
        metrics.lastFailure = undefined;
        metrics.lastSuccess = undefined;
      }
    } else {
      for (const metrics of this.healthMetrics.values()) {
        metrics.successCount = 0;
        metrics.failureCount = 0;
        metrics.healthScore = 1.0;
        metrics.lastFailure = undefined;
        metrics.lastSuccess = undefined;
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
