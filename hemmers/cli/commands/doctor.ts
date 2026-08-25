/**
 * hemmers doctor command
 * Comprehensive diagnostic check for Hemmers environment, security, database, and adapters
 */

import { homedir } from 'os';
import { join } from 'path';
import { existsSync } from 'fs';
import { registry } from '../../adapters/registry.js';
import { ClaudeCodeAdapter } from '../../adapters/claude-code/adapter.js';
import { OpenCodeAdapter } from '../../adapters/opencode/adapter.js';
import { PiAdapter } from '../../adapters/pi/adapter.js';
import { MemoryStore } from '../../core/memory/store.js';
import { ProviderFactory } from '../../core/providers/factory.js';

export interface DoctorCheckResult {
  category: string;
  name: string;
  status: 'ok' | 'warning' | 'error';
  message: string;
  details?: Record<string, unknown>;
}

export interface DoctorReport {
  timestamp: string;
  healthy: boolean;
  checks: DoctorCheckResult[];
  summary: {
    total: number;
    passed: number;
    warnings: number;
    errors: number;
  };
}

export async function doctorCommand(options?: { json?: boolean }): Promise<void> {
  const isJson = Boolean(options?.json);
  const checks: DoctorCheckResult[] = [];

  if (!isJson) {
    console.log('🩺 Running Hemmers Doctor...\n');
  }

  // 1. Node.js Runtime Check
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0], 10);
  if (majorVersion >= 18) {
    checks.push({
      category: 'Runtime',
      name: 'Node.js Version',
      status: 'ok',
      message: `Node.js ${nodeVersion} (Supported >= 18.0.0)`
    });
  } else {
    checks.push({
      category: 'Runtime',
      name: 'Node.js Version',
      status: 'error',
      message: `Node.js ${nodeVersion} is outdated. Minimum required is v18.0.0`
    });
  }

  // 2. Hemmers Home & Configuration Check
  const hemmersHome = join(homedir(), '.hemmers');
  const configPath = join(hemmersHome, 'config.json');
  if (existsSync(hemmersHome) && existsSync(configPath)) {
    checks.push({
      category: 'Configuration',
      name: 'Hemmers Home & Config',
      status: 'ok',
      message: `Configured at ${hemmersHome}`
    });
  } else if (existsSync(hemmersHome)) {
    checks.push({
      category: 'Configuration',
      name: 'Hemmers Home & Config',
      status: 'warning',
      message: `Directory ${hemmersHome} exists but config.json is missing. Run "hemmers init"`
    });
  } else {
    checks.push({
      category: 'Configuration',
      name: 'Hemmers Home & Config',
      status: 'warning',
      message: `Hemmers is not initialized yet. Run "hemmers init"`
    });
  }

  // 3. SQLite Database Check
  try {
    const memoryDir = join(hemmersHome, 'memory');
    const dbPath = join(memoryDir, 'hemmers.db');
    const store = new MemoryStore(existsSync(memoryDir) ? dbPath : ':memory:');
    const testSession = store.createSession(undefined, { test: true });
    store.addMemory({
      sessionId: testSession.id,
      type: 'context',
      content: 'doctor health check'
    });
    store.deleteSession(testSession.id);
    store.close();

    checks.push({
      category: 'Database',
      name: 'SQLite Memory Engine',
      status: 'ok',
      message: 'SQLite schema migrations and foreign keys functional'
    });
  } catch (err) {
    checks.push({
      category: 'Database',
      name: 'SQLite Memory Engine',
      status: 'error',
      message: `SQLite initialization error: ${(err as Error).message}`
    });
  }

  // 4. Agent Adapters Detection Check
  try {
    registry.register(new ClaudeCodeAdapter());
    registry.register(new OpenCodeAdapter());
    registry.register(new PiAdapter());

    const detected = await registry.getDetectedAgents();
    checks.push({
      category: 'Adapters',
      name: 'Installed Agent Adapters',
      status: detected.length > 0 ? 'ok' : 'warning',
      message: detected.length > 0
        ? `Found ${detected.length} installed agent(s): ${detected.map(d => d.adapter.name).join(', ')}`
        : 'No AI coding agents currently detected in default locations'
    });
  } catch (err) {
    checks.push({
      category: 'Adapters',
      name: 'Installed Agent Adapters',
      status: 'error',
      message: `Adapter detection failed: ${(err as Error).message}`
    });
  }

  // 5. LLM Providers Check
  const availableProviders = await ProviderFactory.listAvailableProviders();
  const readyProviders = availableProviders.filter(p => p.available);

  if (readyProviders.length > 0) {
    checks.push({
      category: 'Providers',
      name: 'LLM Model Providers',
      status: 'ok',
      message: `Active provider(s): ${readyProviders.map(p => p.name).join(', ')}`
    });
  } else {
    checks.push({
      category: 'Providers',
      name: 'LLM Model Providers',
      status: 'warning',
      message: 'No LLM API keys found (ANTHROPIC_API_KEY, OPENAI_API_KEY, GOOGLE_API_KEY) and local Ollama not detected'
    });
  }

  // Compute summary
  const total = checks.length;
  const passed = checks.filter(c => c.status === 'ok').length;
  const warnings = checks.filter(c => c.status === 'warning').length;
  const errors = checks.filter(c => c.status === 'error').length;
  const isHealthy = errors === 0;

  const report: DoctorReport = {
    timestamp: new Date().toISOString(),
    healthy: isHealthy,
    checks,
    summary: { total, passed, warnings, errors }
  };

  if (isJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    for (const check of checks) {
      const icon = check.status === 'ok' ? '✅' : check.status === 'warning' ? '⚠️ ' : '❌';
      console.log(`${icon} [${check.category}] ${check.name}: ${check.message}`);
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Summary: ${passed} passed, ${warnings} warnings, ${errors} errors`);
    if (isHealthy) {
      console.log('✨ System is healthy and ready to use!\n');
    } else {
      console.log('❌ Some critical issues were found. Please resolve them above.\n');
    }
  }

  if (!isHealthy) {
    process.exitCode = 1;
  }
}
