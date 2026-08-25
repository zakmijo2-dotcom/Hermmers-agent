import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import {
  readFileTool,
  writeFileTool,
  listDirectoryTool,
  searchFilesTool
} from '../../hemmers/core/tools/standard.js';
import {
  createDirectoryTool,
  deleteFileTool,
  moveFileTool,
  getFileInfoTool,
  getEnvironmentVariableTool
} from '../../hemmers/core/tools/extended.js';
import { ToolEngine } from '../../hemmers/core/tools/engine.js';
import { SecurityEngine } from '../../hemmers/core/security/engine.js';

describe('Tools: Filesystem & Search Execution', () => {
  const testDir = join(tmpdir(), `hemmers-tools-test-${Date.now()}`);
  mkdirSync(testDir, { recursive: true });

  const context = { sessionId: 'test-session', agent: 'test-agent', workspaceRoot: testDir };

  it('writeFileTool writes content within workspace', async () => {
    const res = await writeFileTool.execute({ path: 'file1.txt', content: 'hello world' }, context);
    assert.equal(res.success, true);
    assert.equal(existsSync(join(testDir, 'file1.txt')), true);
  });

  it('readFileTool reads content within workspace', async () => {
    const res = await readFileTool.execute({ path: 'file1.txt' }, context);
    assert.equal(res.content, 'hello world');
  });

  it('listDirectoryTool lists entries', async () => {
    const res = await listDirectoryTool.execute({ path: '.' }, context);
    assert.ok(res.files.includes('file1.txt'));
  });

  it('createDirectoryTool creates nested directory', async () => {
    const res = await createDirectoryTool.execute({ path: 'sub/nested' }, context);
    assert.equal(res.success, true);
    assert.equal(existsSync(join(testDir, 'sub', 'nested')), true);
  });

  it('moveFileTool moves file within workspace', async () => {
    const res = await moveFileTool.execute({ source: 'file1.txt', destination: 'sub/file1_moved.txt' }, context);
    assert.equal(res.success, true);
    assert.equal(existsSync(join(testDir, 'file1.txt')), false);
    assert.equal(existsSync(join(testDir, 'sub', 'file1_moved.txt')), true);
  });

  it('getFileInfoTool returns metadata', async () => {
    const res = await getFileInfoTool.execute({ path: 'sub/file1_moved.txt' }, context);
    assert.equal(res.isFile, true);
    assert.ok(res.size > 0);
  });

  it('searchFilesTool finds pattern in workspace files', async () => {
    const res = await searchFilesTool.execute({ pattern: 'hello', path: '.' }, context);
    assert.ok(res.matches.length > 0);
    assert.ok(res.matches[0].content.includes('hello'));
  });

  it('deleteFileTool deletes file within workspace', async () => {
    const res = await deleteFileTool.execute({ path: 'sub/file1_moved.txt' }, context);
    assert.equal(res.success, true);
    assert.equal(existsSync(join(testDir, 'sub', 'file1_moved.txt')), false);
  });

  it('getEnvironmentVariableTool protects sensitive keys', async () => {
    process.env.TEST_SECRET_KEY = 'super_secret';
    const res = await getEnvironmentVariableTool.execute({ name: 'TEST_SECRET_KEY' }, context);
    assert.equal(res.value, '[REDACTED]');
    assert.equal(res.isRedacted, true);
    delete process.env.TEST_SECRET_KEY;
  });

  it('cleans up test directory', () => {
    rmSync(testDir, { recursive: true, force: true });
  });
});

describe('Tools: ToolEngine Security Enforcement', () => {
  it('enforces security checks before tool execution', async () => {
    const secEngine = new SecurityEngine([
      {
        id: 'deny-write',
        name: 'Deny Write',
        enabled: true,
        rules: [{ resource: 'filesystem.write', action: 'deny', riskLevel: 'high' }]
      }
    ]);

    const engine = new ToolEngine({ securityEngine: secEngine });
    engine.register(writeFileTool);

    const res = await engine.execute(
      'writeFile',
      { path: 'test.txt', content: 'test' },
      { sessionId: 's1', agent: 'test' }
    );

    assert.equal(res.success, false);
    assert.match(res.error || '', /Security violation/);
  });
});
