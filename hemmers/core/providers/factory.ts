/**
 * Provider Factory
 * Centralized provider creation and management
 */

import { ModelProvider } from './base.js';
import { AnthropicProvider } from './anthropic.js';
import { OpenAIProvider } from './openai.js';
import { GoogleProvider } from './google.js';
import { OllamaProvider } from './ollama.js';

export type ProviderType = 'anthropic' | 'openai' | 'google' | 'ollama';

export class ProviderFactory {
  private static providers: Map<ProviderType, ModelProvider> = new Map();

  /**
   * Get or create provider instance
   */
  static getProvider(type: ProviderType, config?: { baseUrl?: string }): ModelProvider {
    // Check if already created
    if (this.providers.has(type)) {
      return this.providers.get(type)!;
    }

    // Create new provider
    let provider: ModelProvider;

    switch (type) {
      case 'anthropic':
        provider = new AnthropicProvider();
        break;
      case 'openai':
        provider = new OpenAIProvider();
        break;
      case 'google':
        provider = new GoogleProvider();
        break;
      case 'ollama':
        provider = new OllamaProvider(config?.baseUrl);
        break;
      default:
        throw new Error(`Unknown provider: ${type}`);
    }

    this.providers.set(type, provider);
    return provider;
  }

  /**
   * List all available providers
   */
  static async listAvailableProviders(): Promise<Array<{
    type: ProviderType;
    name: string;
    available: boolean;
    models?: string[];
  }>> {
    const types: ProviderType[] = ['anthropic', 'openai', 'google', 'ollama'];
    const results = [];

    for (const type of types) {
      const provider = this.getProvider(type);
      const available = await provider.isAvailable();

      results.push({
        type,
        name: provider.name,
        available,
        models: available ? await provider.listModels() : undefined
      });
    }

    return results;
  }

  /**
   * Get best available provider
   */
  static async getBestAvailableProvider(): Promise<ModelProvider | null> {
    const providers = await this.listAvailableProviders();

    // Priority: anthropic > openai > google > ollama
    const priority: ProviderType[] = ['anthropic', 'openai', 'google', 'ollama'];

    for (const type of priority) {
      const provider = providers.find(p => p.type === type);
      if (provider?.available) {
        return this.getProvider(type);
      }
    }

    return null;
  }

  /**
   * Auto-select provider and model
   */
  static async autoSelect(preferences?: {
    requireToolCalling?: boolean;
    requireVision?: boolean;
    maxCost?: 'low' | 'medium' | 'high';
  }): Promise<{
    provider: ModelProvider;
    model: string;
  } | null> {
    const providers = await this.listAvailableProviders();

    for (const providerInfo of providers) {
      if (!providerInfo.available || !providerInfo.models) continue;

      for (const model of providerInfo.models) {
        const provider = this.getProvider(providerInfo.type);
        const capabilities = provider.getCapabilities(model);

        // Check requirements
        if (preferences?.requireToolCalling && !capabilities.toolCalling) {
          continue;
        }

        if (preferences?.requireVision && !capabilities.vision) {
          continue;
        }

        // Found suitable model
        return { provider, model };
      }
    }

    return null;
  }

  /**
   * Clear provider cache
   */
  static clearCache(): void {
    this.providers.clear();
  }
}
