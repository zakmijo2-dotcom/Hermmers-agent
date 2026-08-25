import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ToolEngine } from '../../hemmers/core/tools/engine.js';
import { readFileTool, writeFileTool, shellTool } from '../../hemmers/core/tools/standard.js';
import { SecurityEngine } from '../../hemmers/core/security/engine.js';

describe('Security: Bypass Prevention & Policy Enforcement', () => {
  it('prevents direct ToolEngine execution when policy denies action', async () => {
    const secEngine = new SecurityEngine([
      {
        id: 'strict-shell',
        name: 'Strict Shell',
        enabled: true,
        rules: [{ resource: 'shell.execute', action: 'deny', riskLevel: 'critical' }]
      }
    ]);

    const engine = new ToolEngine({ securityEngine: secEngine });
    engine.register(shellTool);

    const result = await engine.execute(
      'shell',
      { command: 'node -v' },
      { sessionId: 's1', agent: 'unauthorized-agent' }
    );

    assert.equal(result.success, false);
    assert.match(result.error || '', /Security violation/);
  });

  it('rejects tampered approval tokens on sensitive operations', async () => {
    const secEngine = new SecurityEngine([
      {
        id: 'write-approval',
        name: 'Write Approval',
        enabled: true,
        rules: [{ resource: 'filesystem.write', action: 'approve', riskLevel: 'high' }]
      }
    ]);

    const engine = new ToolEngine({ securityEngine: secEngine });
    engine.register(writeFileTool);

    // Initial check triggers approval requirement
    const initRes = await engine.execute(
      'writeFile',
      { path: 'test.txt', content: 'good content' },
      { sessionId: 's1', agent: 'agent-1' }
    );

    assert.equal(initRes.success, false);
    assert.equal(initRes.requiresApproval, true);
    assert.ok(initRes.approvalRequestId);

    // Approve the request
    const token = secEngine.approveRequest(initRes.approvalRequestId);
    assert.ok(token);

    // Try executing with altered path/content using the same token
    const tamperedRes = await engine.execute(
      'writeFile',
      { path: 'malicious.sh', content: 'bad payload' },
      { sessionId: 's1', agent: 'agent-1' },
      { approvalToken: token }
    );

    assert.equal(tamperedRes.success, false);
    assert.match(tamperedRes.error || '', /Security violation/);
  });
});
