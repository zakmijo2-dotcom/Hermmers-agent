/**
 * Standard Tool System
 * Hardened implementations with path canonicalization, workspace isolation, and safe execution
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { Tool, ToolContext } from '../types/index.js';
import { resolveSafePath, safeSpawn, SecurityError } from '../security/safety.js';

// Basic filesystem tool: readFile
export const readFileTool: Tool = {
  name: 'readFile',
  description: 'Read contents of a file securely within the workspace',
  schema: {
    parameters: {
      path: { type: 'string', description: 'File path to read' }
    },
    required: ['path']
  },
  permissions: [{ resource: 'filesystem.read' }],
  execute: async (params: { path: string }, context: ToolContext) => {
    const workspaceRoot = (context as unknown as Record<string, unknown>).workspaceRoot as string || process.cwd();
    const safePath = resolveSafePath(params.path, workspaceRoot);

    const stats = statSync(safePath);
    if (stats.size > 10 * 1024 * 1024) {
      throw new SecurityError(`File exceeds maximum readable size limit of 10MB (${stats.size} bytes)`, 'FILE_TOO_LARGE');
    }

    const content = readFileSync(safePath, 'utf-8');
    return { content, path: safePath, size: stats.size };
  }
};

// Write file tool: writeFile
export const writeFileTool: Tool = {
  name: 'writeFile',
  description: 'Write content to a file securely within the workspace',
  schema: {
    parameters: {
      path: { type: 'string', description: 'File path to write' },
      content: { type: 'string', description: 'File content' }
    },
    required: ['path', 'content']
  },
  permissions: [{ resource: 'filesystem.write' }],
  execute: async (params: { path: string; content: string }, context: ToolContext) => {
    const workspaceRoot = (context as unknown as Record<string, unknown>).workspaceRoot as string || process.cwd();
    const safePath = resolveSafePath(params.path, workspaceRoot);

    writeFileSync(safePath, params.content, 'utf-8');
    return { success: true, path: safePath, bytesWritten: Buffer.byteLength(params.content, 'utf-8') };
  }
};

// Shell execution tool: shell
export const shellTool: Tool = {
  name: 'shell',
  description: 'Execute approved command safely without shell interpolation',
  schema: {
    parameters: {
      command: { type: 'string', description: 'Command binary to execute' },
      args: { type: 'array', items: { type: 'string' }, description: 'Command arguments' },
      cwd: { type: 'string', description: 'Working directory' }
    },
    required: ['command']
  },
  permissions: [{ resource: 'shell.execute' }],
  execute: async (params: { command: string; args?: string[]; cwd?: string }, context: ToolContext) => {
    const workspaceRoot = (context as unknown as Record<string, unknown>).workspaceRoot as string || process.cwd();
    const safeCwd = params.cwd ? resolveSafePath(params.cwd, workspaceRoot) : workspaceRoot;

    // If a full command string is passed in `command` (legacy callers), parse command + arguments cleanly
    let binary = params.command;
    let args = params.args || [];

    if (!params.args && binary.includes(' ')) {
      const parts = binary.trim().split(/\s+/);
      binary = parts[0];
      args = parts.slice(1);
    }

    const result = await safeSpawn(binary, args, {
      cwd: safeCwd,
      timeout: 30000,
      maxBuffer: 1024 * 1024
    });

    return {
      output: result.stdout,
      errorOutput: result.stderr,
      exitCode: result.exitCode,
      duration: result.duration
    };
  }
};

// List directory tool: listDirectory
export const listDirectoryTool: Tool = {
  name: 'listDirectory',
  description: 'List files in a directory securely within workspace',
  schema: {
    parameters: {
      path: { type: 'string', description: 'Directory path' }
    },
    required: ['path']
  },
  permissions: [{ resource: 'filesystem.read' }],
  execute: async (params: { path: string }, context: ToolContext) => {
    const workspaceRoot = (context as unknown as Record<string, unknown>).workspaceRoot as string || process.cwd();
    const safePath = resolveSafePath(params.path || '.', workspaceRoot);

    const files = readdirSync(safePath);
    return { files, path: safePath, count: files.length };
  }
};

// Git status tool: gitStatus
export const gitStatusTool: Tool = {
  name: 'gitStatus',
  description: 'Get git repository status safely',
  schema: {
    parameters: {
      path: { type: 'string', description: 'Repository path' }
    }
  },
  permissions: [{ resource: 'git.read' }],
  execute: async (params: { path?: string }, context: ToolContext) => {
    const workspaceRoot = (context as unknown as Record<string, unknown>).workspaceRoot as string || process.cwd();
    const safePath = params.path ? resolveSafePath(params.path, workspaceRoot) : workspaceRoot;

    const result = await safeSpawn('git', ['status', '--short'], {
      cwd: safePath,
      timeout: 10000
    });

    return {
      status: result.stdout,
      clean: result.stdout.length === 0,
      path: safePath
    };
  }
};

// Search files tool: searchFiles (Deterministic recursive search without shell injection)
export const searchFilesTool: Tool = {
  name: 'searchFiles',
  description: 'Search for pattern in workspace files safely without shell injection',
  schema: {
    parameters: {
      pattern: { type: 'string', description: 'Regex or text pattern to search' },
      path: { type: 'string', description: 'Search root path' },
      maxResults: { type: 'number', description: 'Maximum matches to return (default 100)' }
    },
    required: ['pattern']
  },
  permissions: [{ resource: 'filesystem.read' }],
  execute: async (params: { pattern: string; path?: string; maxResults?: number }, context: ToolContext) => {
    const workspaceRoot = (context as unknown as Record<string, unknown>).workspaceRoot as string || process.cwd();
    const safePath = resolveSafePath(params.path || '.', workspaceRoot);
    const maxResults = params.maxResults || 100;
    const regex = new RegExp(params.pattern, 'i');

    const matches: Array<{ file: string; line: number; content: string }> = [];

    function searchDir(dir: string, depth: number = 0): void {
      if (depth > 10 || matches.length >= maxResults) return;

      let entries: string[] = [];
      try {
        entries = readdirSync(dir);
      } catch {
        return;
      }

      for (const entry of entries) {
        if (matches.length >= maxResults) break;
        if (entry === 'node_modules' || entry === '.git' || entry === 'dist') continue;

        const fullPath = join(dir, entry);
        try {
          const stats = statSync(fullPath);
          if (stats.isDirectory()) {
            searchDir(fullPath, depth + 1);
          } else if (stats.isFile() && stats.size < 2 * 1024 * 1024) {
            const content = readFileSync(fullPath, 'utf-8');
            const lines = content.split('\n');
            for (let i = 0; i < lines.length; i++) {
              if (regex.test(lines[i])) {
                matches.push({
                  file: fullPath.slice(workspaceRoot.length + 1) || fullPath,
                  line: i + 1,
                  content: lines[i].trim().slice(0, 300)
                });
                if (matches.length >= maxResults) break;
              }
            }
          }
        } catch {
          // ignore unreadable files
        }
      }
    }

    searchDir(safePath);

    return {
      pattern: params.pattern,
      matches,
      totalMatches: matches.length,
      searchedPath: safePath
    };
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
