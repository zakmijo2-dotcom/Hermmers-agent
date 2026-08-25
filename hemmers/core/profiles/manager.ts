/**
 * Profile System
 * Pre-configured combinations of skills, tools, and settings
 */

import { Skill } from '../types/index.js';

export interface Profile {
  id: string;
  name: string;
  description: string;
  skills: string[];           // Skill names to activate
  tools: string[];            // Tool names to enable
  hooks: string[];            // Hook IDs to register
  config: ProfileConfig;
  metadata: {
    author?: string;
    version: string;
    tags: string[];
    icon?: string;
  };
}

export interface ProfileConfig {
  provider?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  contextWindow?: number;
  enableLearning?: boolean;
  securityLevel?: 'strict' | 'moderate' | 'permissive';
}

export class ProfileManager {
  private profiles: Map<string, Profile> = new Map();
  private activeProfile: string | null = null;

  /**
   * Register profile
   */
  register(profile: Profile): void {
    this.profiles.set(profile.id, profile);
  }

  /**
   * Activate profile
   */
  async activate(profileId: string): Promise<void> {
    const profile = this.profiles.get(profileId);
    if (!profile) {
      throw new Error(`Profile ${profileId} not found`);
    }

    this.activeProfile = profileId;

    // Profile activation would:
    // 1. Load specified skills
    // 2. Enable specified tools
    // 3. Register hooks
    // 4. Apply configuration
  }

  /**
   * Get active profile
   */
  getActive(): Profile | null {
    if (!this.activeProfile) return null;
    return this.profiles.get(this.activeProfile) || null;
  }

  /**
   * List all profiles
   */
  list(): Profile[] {
    return Array.from(this.profiles.values());
  }

  /**
   * Search profiles by tag
   */
  searchByTag(tag: string): Profile[] {
    return this.list().filter(p => p.metadata.tags.includes(tag));
  }
}

/**
 * Built-in Profiles
 */

export const codingProfile: Profile = {
  id: 'coding',
  name: 'General Coding',
  description: 'General-purpose coding with best practices',
  skills: ['senior-coder'],
  tools: [
    'readFile',
    'writeFile',
    'listDirectory',
    'gitStatus',
    'gitCommit',
    'gitDiff'
  ],
  hooks: [],
  config: {
    provider: 'anthropic',
    model: 'claude-opus-5',
    temperature: 0.7,
    systemPrompt: 'You are an expert software engineer.',
    enableLearning: true,
    securityLevel: 'moderate'
  },
  metadata: {
    author: 'Hemmers',
    version: '1.0.0',
    tags: ['coding', 'general', 'best-practices']
  }
};

export const frontendProfile: Profile = {
  id: 'frontend',
  name: 'Frontend Development',
  description: 'React, TypeScript, and modern web development',
  skills: ['ui-ux-pro-max', 'senior-coder'],
  tools: [
    'readFile',
    'writeFile',
    'listDirectory',
    'npmInstall',
    'httpRequest'
  ],
  hooks: [],
  config: {
    provider: 'anthropic',
    model: 'claude-sonnet-5',
    temperature: 0.8,
    systemPrompt: 'You are an expert frontend developer specializing in React, TypeScript, and modern web technologies. You follow accessibility best practices.',
    enableLearning: true,
    securityLevel: 'moderate'
  },
  metadata: {
    author: 'Hemmers',
    version: '1.0.0',
    tags: ['frontend', 'react', 'typescript', 'ui', 'accessibility']
  }
};

export const termuxProfile: Profile = {
  id: 'termux',
  name: 'Termux/Android',
  description: 'Optimized for Termux on Android devices',
  skills: ['caveman'],
  tools: [
    'readFile',
    'writeFile',
    'shell',
    'getCurrentDirectory'
  ],
  hooks: [],
  config: {
    provider: 'ollama',
    model: 'llama3',
    temperature: 0.7,
    maxTokens: 2048,
    systemPrompt: 'You are a helpful coding assistant optimized for mobile development.',
    enableLearning: false,
    securityLevel: 'strict'
  },
  metadata: {
    author: 'Hemmers',
    version: '1.0.0',
    tags: ['termux', 'android', 'mobile', 'lightweight']
  }
};

export const securityProfile: Profile = {
  id: 'security',
  name: 'Security Audit',
  description: 'Security-focused code review and vulnerability detection',
  skills: ['senior-coder'],
  tools: [
    'readFile',
    'searchFiles',
    'gitDiff'
  ],
  hooks: [],
  config: {
    provider: 'anthropic',
    model: 'claude-opus-5',
    temperature: 0.3,
    systemPrompt: 'You are a security expert focused on finding vulnerabilities, security issues, and suggesting fixes.',
    enableLearning: true,
    securityLevel: 'strict'
  },
  metadata: {
    author: 'Hemmers',
    version: '1.0.0',
    tags: ['security', 'audit', 'vulnerability', 'review']
  }
};

export const dataAnalysisProfile: Profile = {
  id: 'data-analysis',
  name: 'Data Analysis',
  description: 'Data processing, analysis, and visualization',
  skills: ['senior-coder'],
  tools: [
    'readFile',
    'writeFile',
    'httpRequest',
    'shell'
  ],
  hooks: [],
  config: {
    provider: 'openai',
    model: 'gpt-4o',
    temperature: 0.5,
    systemPrompt: 'You are a data scientist expert in Python, pandas, and data analysis.',
    enableLearning: true,
    securityLevel: 'moderate'
  },
  metadata: {
    author: 'Hemmers',
    version: '1.0.0',
    tags: ['data', 'analysis', 'python', 'pandas']
  }
};

/**
 * Standard profiles collection
 */
export const standardProfiles: Profile[] = [
  codingProfile,
  frontendProfile,
  termuxProfile,
  securityProfile,
  dataAnalysisProfile
];
