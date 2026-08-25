import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PermissionManager } from '../../hemmers/core/permissions/manager.js';

describe('Permissions: PermissionManager', () => {
  it('allows resource matching allow rule', () => {
    const pm = new PermissionManager();
    pm.addRule({
      permission: { resource: 'filesystem.read' },
      action: 'allow'
    });

    const decision = pm.check({
      resource: 'filesystem.read',
      requester: 'agent-1'
    });

    assert.equal(decision.allowed, true);
    assert.equal(decision.action, 'allow');
  });

  it('denies resource matching deny rule', () => {
    const pm = new PermissionManager();
    pm.addRule({
      permission: { resource: 'shell.execute' },
      action: 'deny'
    });

    const decision = pm.check({
      resource: 'shell.execute',
      requester: 'agent-1'
    });

    assert.equal(decision.allowed, false);
    assert.equal(decision.action, 'deny');
  });

  it('enforces deny over allow when rules conflict', () => {
    const pm = new PermissionManager();
    pm.addRule({
      permission: { resource: 'filesystem.write' },
      action: 'allow'
    });
    pm.addRule({
      permission: { resource: 'filesystem.write' },
      action: 'deny'
    });

    const decision = pm.check({
      resource: 'filesystem.write',
      requester: 'agent-1'
    });

    assert.equal(decision.allowed, false);
    assert.equal(decision.action, 'deny');
  });

  it('supports wildcard resource matching', () => {
    const pm = new PermissionManager();
    pm.addRule({
      permission: { resource: 'git.*' },
      action: 'allow'
    });

    assert.equal(pm.check({ resource: 'git.read', requester: 'agent' }).allowed, true);
    assert.equal(pm.check({ resource: 'git.write', requester: 'agent' }).allowed, true);
    assert.equal(pm.check({ resource: 'network.http', requester: 'agent' }).allowed, false);
  });

  it('supports scope matching', () => {
    const pm = new PermissionManager();
    pm.addRule({
      permission: { resource: 'filesystem.read', scope: '/workspace/src/*' },
      action: 'allow'
    });

    assert.equal(
      pm.check({ resource: 'filesystem.read', scope: '/workspace/src/index.ts', requester: 'agent' }).allowed,
      true
    );
    assert.equal(
      pm.check({ resource: 'filesystem.read', scope: '/etc/shadow', requester: 'agent' }).allowed,
      false
    );
  });

  it('defaults to ask on unconfigured resource', () => {
    const pm = new PermissionManager();
    const decision = pm.check({ resource: 'custom.resource', requester: 'agent' });
    assert.equal(decision.allowed, false);
    assert.equal(decision.action, 'ask');
  });
});
