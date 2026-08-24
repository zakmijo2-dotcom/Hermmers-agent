/**
 * Additional Standard Tools
 * Expanding the tool library with more useful tools
 */

import { Tool } from '../types';

// File system tools
export const createDirectoryTool: Tool = {
  name: 'createDirectory',
  description: 'Create a new directory',
  schema: {
    parameters: {
      path: { type: 'string', description: 'Directory path to create' }
    },
    required: ['path']
  },
  permissions: [{ resource: 'filesystem.write' }],
  execute: async (params) => {
    const { mkdirSync } = await import('fs');
    mkdirSync(params.path, { recursive: true });
    return { success: true, path: params.path };
  }
};

export const deleteFileTool: Tool = {
  name: 'deleteFile',
  description: 'Delete a file',
  schema: {
    parameters: {
      path: { type: 'string', description: 'File path to delete' }
    },
    required: ['path']
  },
  permissions: [{ resource: 'filesystem.delete' }],
  execute: async (params) => {
    const { unlinkSync } = await import('fs');
    unlinkSync(params.path);
    return { success: true, path: params.path };
  }
};

export const moveFileTool: Tool = {
  name: 'moveFile',
  description: 'Move or rename a file',
  schema: {
    parameters: {
      source: { type: 'string' },
      destination: { type: 'string' }
    },
    required: ['source', 'destination']
  },
  permissions: [{ resource: 'filesystem.write' }],
  execute: async (params) => {
    const { renameSync } = await import('fs');
    renameSync(params.source, params.destination);
    return { success: true, from: params.source, to: params.destination };
  }
};

export const getFileInfoTool: Tool = {
  name: 'getFileInfo',
  description: 'Get file information (size, modified date, etc.)',
  schema: {
    parameters: {
      path: { type: 'string' }
    },
    required: ['path']
  },
  permissions: [{ resource: 'filesystem.read' }],
  execute: async (params) => {
    const { statSync } = await import('fs');
    const stats = statSync(params.path);
    return {
      path: params.path,
      size: stats.size,
      isDirectory: stats.isDirectory(),
      isFile: stats.isFile(),
      created: stats.birthtime,
      modified: stats.mtime
    };
  }
};

// Git tools
export const gitCommitTool: Tool = {
  name: 'gitCommit',
  description: 'Create a git commit',
  schema: {
    parameters: {
      message: { type: 'string', description: 'Commit message' },
      files: { type: 'array', items: { type: 'string' }, description: 'Files to commit' }
    },
    required: ['message']
  },
  permissions: [{ resource: 'git.write' }],
  execute: async (params) => {
    const { execSync } = await import('child_process');

    // Add files if specified
    if (params.files && params.files.length > 0) {
      execSync(`git add ${params.files.join(' ')}`, { encoding: 'utf-8' });
    }

    // Commit
    const output = execSync(`git commit -m "${params.message}"`, { encoding: 'utf-8' });

    return { success: true, message: params.message, output };
  }
};

export const gitDiffTool: Tool = {
  name: 'gitDiff',
  description: 'Show git diff',
  schema: {
    parameters: {
      file: { type: 'string', description: 'Specific file to diff (optional)' }
    }
  },
  permissions: [{ resource: 'git.read' }],
  execute: async (params) => {
    const { execSync } = await import('child_process');
    const command = params.file ? `git diff ${params.file}` : 'git diff';
    const diff = execSync(command, { encoding: 'utf-8' });
    return { diff, file: params.file };
  }
};

export const gitBranchTool: Tool = {
  name: 'gitBranch',
  description: 'List or create git branches',
  schema: {
    parameters: {
      action: { type: 'string', enum: ['list', 'create', 'switch'] },
      name: { type: 'string', description: 'Branch name (for create/switch)' }
    },
    required: ['action']
  },
  permissions: [{ resource: 'git.write' }],
  execute: async (params) => {
    const { execSync } = await import('child_process');

    if (params.action === 'list') {
      const branches = execSync('git branch', { encoding: 'utf-8' });
      return { branches: branches.split('\n').map(b => b.trim()).filter(Boolean) };
    }

    if (params.action === 'create') {
      execSync(`git branch ${params.name}`, { encoding: 'utf-8' });
      return { success: true, branch: params.name, action: 'created' };
    }

    if (params.action === 'switch') {
      execSync(`git checkout ${params.name}`, { encoding: 'utf-8' });
      return { success: true, branch: params.name, action: 'switched' };
    }

    throw new Error('Invalid action');
  }
};

// Web tools
export const httpRequestTool: Tool = {
  name: 'httpRequest',
  description: 'Make HTTP request',
  schema: {
    parameters: {
      url: { type: 'string' },
      method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE'] },
      headers: { type: 'object' },
      body: { type: 'string' }
    },
    required: ['url']
  },
  permissions: [{ resource: 'network.http' }],
  execute: async (params) => {
    const response = await fetch(params.url, {
      method: params.method || 'GET',
      headers: params.headers,
      body: params.body
    });

    const text = await response.text();

    return {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body: text
    };
  }
};

// Process tools
export const getCurrentDirectoryTool: Tool = {
  name: 'getCurrentDirectory',
  description: 'Get current working directory',
  schema: { parameters: {} },
  permissions: [{ resource: 'filesystem.read' }],
  execute: async () => {
    return { cwd: process.cwd() };
  }
};

export const getEnvironmentVariableTool: Tool = {
  name: 'getEnvironmentVariable',
  description: 'Get environment variable value',
  schema: {
    parameters: {
      name: { type: 'string' }
    },
    required: ['name']
  },
  permissions: [{ resource: 'system.read' }],
  execute: async (params) => {
    return {
      name: params.name,
      value: process.env[params.name]
    };
  }
};

// Package management tools
export const npmInstallTool: Tool = {
  name: 'npmInstall',
  description: 'Install npm package',
  schema: {
    parameters: {
      package: { type: 'string' },
      dev: { type: 'boolean', description: 'Install as dev dependency' }
    },
    required: ['package']
  },
  permissions: [{ resource: 'shell.execute' }, { resource: 'filesystem.write' }],
  execute: async (params) => {
    const { execSync } = await import('child_process');
    const devFlag = params.dev ? '--save-dev' : '';
    const output = execSync(`npm install ${params.package} ${devFlag}`, { encoding: 'utf-8' });
    return { success: true, package: params.package, output };
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
