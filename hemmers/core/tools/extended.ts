/**
 * Extended Tool Library
 * Hardened implementations for filesystem, git, networking, process, and package management
 */

import { mkdirSync, unlinkSync, renameSync, statSync } from 'fs';
import { Tool, ToolContext } from '../types/index.js';
import {
  resolveSafePath,
  safeSpawn,
  validateSafeUrl,
  checkSensitiveHeaders,
  isSensitiveEnvKey,
  SecurityError
} from '../security/safety.js';

// 1. Create Directory
export const createDirectoryTool: Tool = {
  name: 'createDirectory',
  description: 'Create a new directory securely within workspace',
  schema: {
    parameters: {
      path: { type: 'string', description: 'Directory path to create' }
    },
    required: ['path']
  },
  permissions: [{ resource: 'filesystem.write' }],
  execute: async (params: { path: string }, context: ToolContext) => {
    const workspaceRoot = (context as unknown as Record<string, unknown>).workspaceRoot as string || process.cwd();
    const safePath = resolveSafePath(params.path, workspaceRoot);

    mkdirSync(safePath, { recursive: true });
    return { success: true, path: safePath };
  }
};

// 2. Delete File
export const deleteFileTool: Tool = {
  name: 'deleteFile',
  description: 'Delete a file securely within workspace',
  schema: {
    parameters: {
      path: { type: 'string', description: 'File path to delete' }
    },
    required: ['path']
  },
  permissions: [{ resource: 'filesystem.delete' }],
  execute: async (params: { path: string }, context: ToolContext) => {
    const workspaceRoot = (context as unknown as Record<string, unknown>).workspaceRoot as string || process.cwd();
    const safePath = resolveSafePath(params.path, workspaceRoot);

    unlinkSync(safePath);
    return { success: true, path: safePath };
  }
};

// 3. Move File
export const moveFileTool: Tool = {
  name: 'moveFile',
  description: 'Move or rename a file securely within workspace',
  schema: {
    parameters: {
      source: { type: 'string', description: 'Source file path' },
      destination: { type: 'string', description: 'Destination file path' }
    },
    required: ['source', 'destination']
  },
  permissions: [{ resource: 'filesystem.write' }],
  execute: async (params: { source: string; destination: string }, context: ToolContext) => {
    const workspaceRoot = (context as unknown as Record<string, unknown>).workspaceRoot as string || process.cwd();
    const safeSource = resolveSafePath(params.source, workspaceRoot);
    const safeDest = resolveSafePath(params.destination, workspaceRoot);

    renameSync(safeSource, safeDest);
    return { success: true, from: safeSource, to: safeDest };
  }
};

// 4. Get File Info
export const getFileInfoTool: Tool = {
  name: 'getFileInfo',
  description: 'Get file information (size, modified date, etc.) securely',
  schema: {
    parameters: {
      path: { type: 'string', description: 'File path' }
    },
    required: ['path']
  },
  permissions: [{ resource: 'filesystem.read' }],
  execute: async (params: { path: string }, context: ToolContext) => {
    const workspaceRoot = (context as unknown as Record<string, unknown>).workspaceRoot as string || process.cwd();
    const safePath = resolveSafePath(params.path, workspaceRoot);

    const stats = statSync(safePath);
    return {
      path: safePath,
      size: stats.size,
      isDirectory: stats.isDirectory(),
      isFile: stats.isFile(),
      created: stats.birthtimeMs,
      modified: stats.mtimeMs
    };
  }
};

// 5. Git Commit
export const gitCommitTool: Tool = {
  name: 'gitCommit',
  description: 'Create a git commit securely without shell concatenation',
  schema: {
    parameters: {
      message: { type: 'string', description: 'Commit message' },
      files: { type: 'array', items: { type: 'string' }, description: 'Files to commit' },
      path: { type: 'string', description: 'Repository path' }
    },
    required: ['message']
  },
  permissions: [{ resource: 'git.write' }],
  execute: async (params: { message: string; files?: string[]; path?: string }, context: ToolContext) => {
    const workspaceRoot = (context as unknown as Record<string, unknown>).workspaceRoot as string || process.cwd();
    const safeCwd = params.path ? resolveSafePath(params.path, workspaceRoot) : workspaceRoot;

    // Add files if specified
    if (params.files && params.files.length > 0) {
      const safeFiles = params.files.map(f => resolveSafePath(f, safeCwd));
      await safeSpawn('git', ['add', ...safeFiles], { cwd: safeCwd });
    }

    // Commit
    const result = await safeSpawn('git', ['commit', '-m', params.message], { cwd: safeCwd });

    return {
      success: result.exitCode === 0,
      message: params.message,
      output: result.stdout || result.stderr
    };
  }
};

// 6. Git Diff
export const gitDiffTool: Tool = {
  name: 'gitDiff',
  description: 'Show git diff safely',
  schema: {
    parameters: {
      file: { type: 'string', description: 'Specific file to diff (optional)' },
      path: { type: 'string', description: 'Repository path' }
    }
  },
  permissions: [{ resource: 'git.read' }],
  execute: async (params: { file?: string; path?: string }, context: ToolContext) => {
    const workspaceRoot = (context as unknown as Record<string, unknown>).workspaceRoot as string || process.cwd();
    const safeCwd = params.path ? resolveSafePath(params.path, workspaceRoot) : workspaceRoot;

    const args = ['diff'];
    if (params.file) {
      const safeFile = resolveSafePath(params.file, safeCwd);
      args.push(safeFile);
    }

    const result = await safeSpawn('git', args, { cwd: safeCwd });
    return { diff: result.stdout, file: params.file };
  }
};

// 7. Git Branch
export const gitBranchTool: Tool = {
  name: 'gitBranch',
  description: 'List, create, or switch git branches safely',
  schema: {
    parameters: {
      action: { type: 'string', enum: ['list', 'create', 'switch'] },
      name: { type: 'string', description: 'Branch name (for create/switch)' },
      path: { type: 'string', description: 'Repository path' }
    },
    required: ['action']
  },
  permissions: [{ resource: 'git.write' }],
  execute: async (params: { action: 'list' | 'create' | 'switch'; name?: string; path?: string }, context: ToolContext) => {
    const workspaceRoot = (context as unknown as Record<string, unknown>).workspaceRoot as string || process.cwd();
    const safeCwd = params.path ? resolveSafePath(params.path, workspaceRoot) : workspaceRoot;

    if (params.action === 'list') {
      const result = await safeSpawn('git', ['branch'], { cwd: safeCwd });
      return { branches: result.stdout.split('\n').map(b => b.trim()).filter(Boolean) };
    }

    if (!params.name || !/^[A-Za-z0-9_\-\.\/]+$/.test(params.name)) {
      throw new SecurityError('Invalid branch name: contains illegal characters', 'INVALID_BRANCH_NAME');
    }

    if (params.action === 'create') {
      const result = await safeSpawn('git', ['branch', params.name], { cwd: safeCwd });
      return { success: result.exitCode === 0, branch: params.name, action: 'created', output: result.stdout };
    }

    if (params.action === 'switch') {
      const result = await safeSpawn('git', ['checkout', params.name], { cwd: safeCwd });
      return { success: result.exitCode === 0, branch: params.name, action: 'switched', output: result.stdout || result.stderr };
    }

    throw new Error('Invalid action');
  }
};

// 8. HTTP Request with SSRF guard and Header Protection
export const httpRequestTool: Tool = {
  name: 'httpRequest',
  description: 'Make HTTP request securely with SSRF prevention, timeouts, and header protection',
  schema: {
    parameters: {
      url: { type: 'string', description: 'Target URL' },
      method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE'], description: 'HTTP method' },
      headers: { type: 'object', description: 'Request headers' },
      body: { type: 'string', description: 'Request body' },
      timeout: { type: 'number', description: 'Timeout in milliseconds (default 10,000)' },
      allowPrivateNetwork: { type: 'boolean', description: 'Explicitly allow requests to private network' },
      allowSensitiveHeaders: { type: 'boolean', description: 'Explicitly allow sending auth headers' }
    },
    required: ['url']
  },
  permissions: [{ resource: 'network.http' }],
  execute: async (params: {
    url: string;
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    timeout?: number;
    allowPrivateNetwork?: boolean;
    allowSensitiveHeaders?: boolean;
  }) => {
    // 1. Validate URL & SSRF
    const safeUrl = validateSafeUrl(params.url, params.allowPrivateNetwork ?? false);

    // 2. Protect sensitive headers
    checkSensitiveHeaders(params.headers, params.allowSensitiveHeaders ?? false);

    // 3. Setup timeout and controller
    const timeoutMs = params.timeout ? Math.min(params.timeout, 30000) : 10000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(safeUrl.toString(), {
        method: params.method || 'GET',
        headers: params.headers,
        body: params.body,
        signal: controller.signal
      });

      clearTimeout(timer);

      // Max response body size: 1 MB
      const text = await response.text();
      const maxLen = 1024 * 1024;
      const isTruncated = text.length > maxLen;
      const body = isTruncated ? text.slice(0, maxLen) + '\n[Response body truncated]' : text;

      return {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body,
        truncated: isTruncated
      };
    } catch (err) {
      clearTimeout(timer);
      if ((err as Error).name === 'AbortError') {
        throw new SecurityError(`HTTP request timed out after ${timeoutMs}ms: ${params.url}`, 'REQUEST_TIMEOUT');
      }
      throw err;
    }
  }
};

// 9. Get Current Directory
export const getCurrentDirectoryTool: Tool = {
  name: 'getCurrentDirectory',
  description: 'Get current working directory',
  schema: { parameters: {} },
  permissions: [{ resource: 'filesystem.read' }],
  execute: async () => {
    return { cwd: process.cwd() };
  }
};

// 10. Get Environment Variable (with redaction for secrets)
export const getEnvironmentVariableTool: Tool = {
  name: 'getEnvironmentVariable',
  description: 'Get environment variable value with secret protection',
  schema: {
    parameters: {
      name: { type: 'string', description: 'Environment variable name' }
    },
    required: ['name']
  },
  permissions: [{ resource: 'system.read' }],
  execute: async (params: { name: string }) => {
    const isSensitive = isSensitiveEnvKey(params.name);

    if (isSensitive) {
      return {
        name: params.name,
        value: '[REDACTED]',
        isRedacted: true,
        reason: 'Sensitive credential or API key is protected by security policy'
      };
    }

    return {
      name: params.name,
      value: process.env[params.name],
      isRedacted: false
    };
  }
};

// 11. NPM Install (with safe arguments)
export const npmInstallTool: Tool = {
  name: 'npmInstall',
  description: 'Install npm package safely without shell injection',
  schema: {
    parameters: {
      package: { type: 'string', description: 'Package name to install' },
      dev: { type: 'boolean', description: 'Install as dev dependency' },
      cwd: { type: 'string', description: 'Working directory' }
    },
    required: ['package']
  },
  permissions: [{ resource: 'shell.execute' }, { resource: 'filesystem.write' }],
  execute: async (params: { package: string; dev?: boolean; cwd?: string }, context: ToolContext) => {
    const workspaceRoot = (context as unknown as Record<string, unknown>).workspaceRoot as string || process.cwd();
    const safeCwd = params.cwd ? resolveSafePath(params.cwd, workspaceRoot) : workspaceRoot;

    // Validate package name format (prevents shell injection or flags like --script-shell)
    if (!/^[a-zA-Z0-9@\/_\-\.]+$/.test(params.package)) {
      throw new SecurityError(`Invalid package name: "${params.package}"`, 'INVALID_PACKAGE_NAME');
    }

    const args = ['install', params.package];
    if (params.dev) {
      args.push('--save-dev');
    }

    const result = await safeSpawn('npm', args, {
      cwd: safeCwd,
      timeout: 120000
    });

    return {
      success: result.exitCode === 0,
      package: params.package,
      output: result.stdout || result.stderr
    };
  }
};

/**
 * Extended tool library
 */
export const extendedTools: Tool[] = [
  createDirectoryTool,
  deleteFileTool,
  moveFileTool,
  getFileInfoTool,
  gitCommitTool,
  gitDiffTool,
  gitBranchTool,
  httpRequestTool,
  getCurrentDirectoryTool,
  getEnvironmentVariableTool,
  npmInstallTool
];
