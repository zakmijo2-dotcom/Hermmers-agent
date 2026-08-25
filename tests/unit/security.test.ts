import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import {
  resolveSafePath,
  safeSpawn,
  validateSafeUrl,
  checkSensitiveHeaders,
  isSensitiveEnvKey,
  redactSecrets,
  computeRequestHash,
  SecurityError
} from '../../hemmers/core/security/safety.js';
import { SecurityEngine } from '../../hemmers/core/security/engine.js';

describe('Security: Path Traversal & Canonicalization', () => {
  const testDir = join(tmpdir(), `hemmers-sec-test-${Date.now()}`);
  mkdirSync(testDir, { recursive: true });
  const subDir = join(testDir, 'workspace');
  mkdirSync(subDir, { recursive: true });
  writeFileSync(join(subDir, 'allowed.txt'), 'hello');

  it('allows safe relative path within workspace', () => {
    const safe = resolveSafePath('allowed.txt', subDir);
    assert.equal(safe, join(subDir, 'allowed.txt'));
  });

  it('allows nested safe relative path within workspace', () => {
    const safe = resolveSafePath('./sub/../allowed.txt', subDir);
    assert.equal(safe, join(subDir, 'allowed.txt'));
  });

  it('blocks path traversal escaping workspace via ../', () => {
    assert.throws(
      () => resolveSafePath('../../outside.txt', subDir),
      (err: Error) => err instanceof SecurityError && err.code === 'PATH_TRAVERSAL'
    );
  });

  it('blocks absolute path outside workspace', () => {
    assert.throws(
      () => resolveSafePath('/etc/passwd', subDir),
      (err: Error) => err instanceof SecurityError && err.code === 'PATH_TRAVERSAL'
    );
  });

  it('blocks null-byte injection', () => {
    assert.throws(
      () => resolveSafePath('allowed.txt\0/etc/passwd', subDir),
      (err: Error) => err instanceof SecurityError && err.code === 'NULL_BYTE_INJECTION'
    );
  });

  it('cleans up test directory', () => {
    rmSync(testDir, { recursive: true, force: true });
  });
});

describe('Security: Command Safety & Safe Spawn', () => {
  it('allows safe whitelisted binary (echo/node)', async () => {
    const res = await safeSpawn('node', ['-e', 'console.log("safe execution")']);
    assert.equal(res.exitCode, 0);
    assert.equal(res.stdout, 'safe execution');
  });

  it('blocks binary not in allowlist', async () => {
    await assert.rejects(
      async () => safeSpawn('unknown_dangerous_binary_xyz', []),
      (err: Error) => err instanceof SecurityError && err.code === 'COMMAND_NOT_ALLOWED'
    );
  });

  it('blocks dangerous destructive command patterns', async () => {
    await assert.rejects(
      async () => safeSpawn('node', ['-e', 'rm -rf /'], { allowAllCommands: true }),
      (err: Error) => err instanceof SecurityError && err.code === 'DANGEROUS_COMMAND'
    );
  });
});

describe('Security: SSRF & URL Protection', () => {
  it('allows public HTTPS URLs', () => {
    const url = validateSafeUrl('https://api.github.com/repos');
    assert.equal(url.hostname, 'api.github.com');
  });

  it('blocks private IPv4 (127.0.0.1, 10.0.0.1, 192.168.1.1, 169.254.169.254)', () => {
    assert.throws(() => validateSafeUrl('http://127.0.0.1/admin'), /SSRF Blocked/);
    assert.throws(() => validateSafeUrl('http://localhost:8080/api'), /SSRF Blocked/);
    assert.throws(() => validateSafeUrl('http://10.0.0.5/api'), /SSRF Blocked/);
    assert.throws(() => validateSafeUrl('http://192.168.1.1/router'), /SSRF Blocked/);
    assert.throws(() => validateSafeUrl('http://169.254.169.254/latest/meta-data/'), /SSRF Blocked/);
  });

  it('blocks forbidden protocols (file:, ftp:)', () => {
    assert.throws(() => validateSafeUrl('file:///etc/passwd'), /Forbidden URL protocol/);
    assert.throws(() => validateSafeUrl('ftp://ftp.server.com/file'), /Forbidden URL protocol/);
  });
});

describe('Security: Sensitive Headers & Env Protection', () => {
  it('detects and blocks unauthorized Authorization / Cookie headers', () => {
    assert.throws(
      () => checkSensitiveHeaders({ Authorization: 'Bearer token123' }, false),
      /Sending sensitive header/
    );
    assert.throws(
      () => checkSensitiveHeaders({ Cookie: 'session=secret' }, false),
      /Sending sensitive header/
    );
    assert.throws(
      () => checkSensitiveHeaders({ 'x-api-key': 'key123' }, false),
      /Sending sensitive header/
    );
  });

  it('allows sensitive headers when explicitly permitted', () => {
    assert.doesNotThrow(() => checkSensitiveHeaders({ Authorization: 'Bearer token' }, true));
  });

  it('identifies sensitive environment variable names', () => {
    assert.equal(isSensitiveEnvKey('OPENAI_API_KEY'), true);
    assert.equal(isSensitiveEnvKey('ANTHROPIC_API_KEY'), true);
    assert.equal(isSensitiveEnvKey('DATABASE_URL'), true);
    assert.equal(isSensitiveEnvKey('AWS_SECRET_ACCESS_KEY'), true);
    assert.equal(isSensitiveEnvKey('NODE_ENV'), false);
    assert.equal(isSensitiveEnvKey('PATH'), false);
  });

  it('redacts secrets from logs and objects', () => {
    const data = {
      user: 'alice',
      OPENAI_API_KEY: 'sk-123456789012345678901234',
      message: 'Bearer secret_token_123456789'
    };
    const redacted = redactSecrets(data);
    assert.equal(redacted.user, 'alice');
    assert.equal(redacted.OPENAI_API_KEY, '[REDACTED]');
    assert.equal(redacted.message.includes('Bearer [REDACTED]'), true);
  });
});

describe('Security: SecurityEngine Policies & Approval Tokens', () => {
  it('evaluates deny rules with highest precedence over allow', async () => {
    const engine = new SecurityEngine([
      {
        id: 'test-policy',
        name: 'Test Policy',
        enabled: true,
        rules: [
          { resource: 'tool.delete', action: 'allow', riskLevel: 'low' },
          { resource: 'tool.delete', action: 'deny', riskLevel: 'high' }
        ]
      }
    ]);

    const decision = await engine.checkSecurity({
      agentId: 'test-agent',
      action: 'tool.execute',
      resource: 'tool.delete'
    });

    assert.equal(decision.allowed, false);
    assert.equal(decision.riskLevel, 'high');
  });

  it('queues approval for approval-required actions and validates approval tokens', async () => {
    const engine = new SecurityEngine([
      {
        id: 'test-approval-policy',
        name: 'Approval Policy',
        enabled: true,
        rules: [{ resource: 'shell.execute', action: 'approve', riskLevel: 'high' }]
      }
    ]);

    const initial = await engine.checkSecurity({
      agentId: 'agent-1',
      action: 'tool.execute',
      resource: 'shell.execute',
      params: { command: 'git status' }
    });

    assert.equal(initial.allowed, false);
    assert.equal(initial.requiresApproval, true);
    assert.ok(initial.approvalRequestId);

    // Approve the request
    const token = engine.approveRequest(initial.approvalRequestId);
    assert.ok(token);
    assert.equal(token.resource, 'shell.execute');

    // Re-check with token
    const afterApproval = await engine.checkSecurity({
      agentId: 'agent-1',
      action: 'tool.execute',
      resource: 'shell.execute',
      params: { command: 'git status' },
      approvalToken: token
    });

    assert.equal(afterApproval.allowed, true);

    // Tampered params should be rejected
    const tampered = await engine.checkSecurity({
      agentId: 'agent-1',
      action: 'tool.execute',
      resource: 'shell.execute',
      params: { command: 'git commit -m "tampered"' },
      approvalToken: token
    });

    assert.equal(tampered.allowed, false);
  });
});
