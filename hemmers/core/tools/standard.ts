/**
 * Tool System - Real Implementation
 * Replaces stubs with actual tool execution
 */

import { Tool, ToolContext } from '../types';

// Basic filesystem tool
export const readFileTool: Tool = {
  name: 'readFile',
  description: 'Read contents of a file',
  schema: {
    parameters: {
      path: { type: 'string', description: 'File path to read' }
    },
    required: ['path']
  },
  permissions: [{ resource: 'filesystem.read' }],
  execute: async (params, context) => {
    const { readFileSync } = await import('fs');
    const content = readFileSync(params.path, 'utf-8');
    return { content, path: params.path };
  }
};

// Write file tool
export const writeFileTool: Tool = {
  name: 'writeFile',
  description: 'Write content to a file',
  schema: {
    parameters: {
      path: { type: 'string' },
      content: { type: 'string' }
    },
    required: ['path', 'content']
  },
  permissions: [{ resource: 'filesystem.write' }],
  execute: async (params, context) => {
    const { writeFileSync } = await import('fs');
    writeFileSync(params.path, params.content, 'utf-8');
    return { success: true, path: params.path };
  }
};

// Shell execution tool
export const shellTool: Tool = {
  name: 'shell',
  description: 'Execute shell command',
  schema: {
    parameters: {
      command: { type: 'string' }
    },
    required: ['command']
  },
  permissions: [{ resource: 'shell.execute' }],
  execute: async (params, context) => {
    const { execSync } = await import('child_process');
    const output = execSync(params.command, { encoding: 'utf-8' });
    return { output, command: params.command };
  }
};

// List directory tool
export const listDirectoryTool: Tool = {
  name: 'listDirectory',
  description: 'List files in a directory',
  schema: {
    parameters: {
      path: { type: 'string' }
    },
    required: ['path']
  },
  permissions: [{ resource: 'filesystem.read' }],
  execute: async (params, context) => {
    const { readdirSync } = await import('fs');
    const files = readdirSync(params.path);
    return { files, path: params.path };
  }
};

// Git status tool
export const gitStatusTool: Tool = {
  name: 'gitStatus',
  description: 'Get git repository status',
  schema: {
    parameters: {
      path: { type: 'string', description: 'Repository path' }
    }
  },
  permissions: [{ resource: 'git.read' }],
  execute: async (params, context) => {
    const { execSync } = await import('child_process');
    const output = execSync('git status --short', {
      cwd: params.path || process.cwd(),
      encoding: 'utf-8'
    });
    return { status: output, path: params.path };
  }
};

// Search files tool
export const searchFilesTool: Tool = {
  name: 'searchFiles',
  description: 'Search for pattern in files',
  schema: {
    parameters: {
      pattern: { type: 'string' },
      path: { type: 'string' }
    },
    required: ['pattern']
  },
  permissions: [{ resource: 'filesystem.read' }],
  execute: async (params, context) => {
    const { execSync } = await import('child_process');
    const output = execSync(
      `grep -r "${params.pattern}" ${params.path || '.'}`,
      { encoding: 'utf-8' }
    ).trim();
    const matches = output.split('\n').filter(Boolean);
    return { matches, pattern: params.pattern };
  }
};

/**
 * Standard tool library
 */
export const standardTools: Tool[] = [
  readFileTool,
  writeFileTool,
  shellTool,
  listDirectoryTool,
  gitStatusTool,
  searchFilesTool
];
