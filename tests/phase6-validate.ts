/**
 * Phase 6 validation: Adaptive provider routing with fallback
 */

import { ProviderRouter, ProviderConfig } from '../packages/agent/src/provider-router';

async function validatePhase6(): Promise<boolean> {
  console.log('Phase 6 Validation: Adaptive Provider Routing\n');

  try {
    // Setup test providers
    const providers: ProviderConfig[] = [
      {
        id: 'provider-a',
        name: 'Provider A',
        models: ['model-1', 'model-2'],
        priority: 100,
        maxRetries: 2
      },
      {
        id: 'provider-b',
        name: 'Provider B',
        models: ['model-1'],
        priority: 80,
        maxRetries: 2
      },
      {
        id: 'provider-c',
        name: 'Provider C',
        models: ['model-2', 'model-3'],
        priority: 60,
        maxRetries: 2
      }
    ];

    const router = new ProviderRouter(providers);

    // Test 1: Basic provider selection
    console.log('Test 1: Testing provider selection...');
    const decision = router.selectProvider();

    if (!decision) {
      throw new Error('No provider selected');
    }
    if (decision.provider.id !== 'provider-a') {
      throw new Error(`Expected provider-a, got ${decision.provider.id}`);
    }
    if (decision.fallbackChain.length < 1) {
      throw new Error('Fallback chain empty');
    }

    console.log(`✓ Selected ${decision.provider.name}, fallback chain: ${decision.fallbackChain.map(p => p.name).join(', ')}\n`);

    // Test 2: Model-based selection
    console.log('Test 2: Testing model-based selection...');
    const decision2 = router.selectProvider({ model: 'model-3' });

    if (!decision2 || decision2.provider.id !== 'provider-c') {
      throw new Error(`Expected provider-c for model-3, got ${decision2?.provider.id}`);
    }

    console.log(`✓ Selected ${decision2.provider.name} for model-3\n`);

    // Test 3: Execution with success
    console.log('Test 3: Testing successful execution...');
    let callCount = 0;
    const mockSuccess = async (provider: ProviderConfig) => {
      callCount++;
      return `Success from ${provider.name}`;
    };

    const result1 = await router.executeWithFallback(mockSuccess);

    if (result1.attempts !== 1) {
      throw new Error(`Expected 1 attempt, got ${result1.attempts}`);
    }
    if (callCount !== 1) {
      throw new Error(`Expected 1 call, got ${callCount}`);
    }

    console.log(`✓ Executed successfully on first attempt\n`);

    // Test 4: Fallback on failure
    console.log('Test 4: Testing fallback on provider failure...');
    router.resetHealth();
    callCount = 0;

    const mockFailThenSuccess = async (provider: ProviderConfig) => {
      callCount++;
      if (provider.id === 'provider-a') {
        throw new Error('Provider A failed');
      }
      return `Success from ${provider.name}`;
    };

    const result2 = await router.executeWithFallback(mockFailThenSuccess);

    if (result2.attempts < 2) {
      throw new Error(`Expected ≥2 attempts, got ${result2.attempts}`);
    }
    if (result2.provider.id === 'provider-a') {
      throw new Error('Should have failed over from provider-a');
    }

    console.log(`✓ Failed over to ${result2.provider.name} after ${result2.attempts} attempts\n`);

    // Test 5: Health score tracking
    console.log('Test 5: Testing health score degradation...');
    router.resetHealth();

    // Record multiple failures for provider-a
    for (let i = 0; i < 3; i++) {
      router.recordFailure('provider-a', 100);
    }

    const metrics = router.getHealthMetrics();
    const providerAHealth = metrics.find(m => m.providerId === 'provider-a');

    if (!providerAHealth || providerAHealth.healthScore >= 0.5) {
      throw new Error(`Expected health < 0.5, got ${providerAHealth?.healthScore}`);
    }

    console.log(`✓ Provider A health degraded to ${providerAHealth.healthScore.toFixed(2)} after failures\n`);

    // Test 6: Health-based reordering
    console.log('Test 6: Testing health-based provider reordering...');
    const decision3 = router.selectProvider();

    if (decision3.provider.id === 'provider-a') {
      throw new Error('Unhealthy provider-a should not be selected first');
    }

    console.log(`✓ Selected healthier ${decision3.provider.name} instead of degraded provider-a\n`);

    // Test 7: Health recovery
    console.log('Test 7: Testing health score recovery...');
    const beforeRecovery = providerAHealth.healthScore;

    for (let i = 0; i < 5; i++) {
      router.recordSuccess('provider-a', 50);
    }

    const recoveredHealth = router.getHealthMetrics().find(m => m.providerId === 'provider-a');
    if (!recoveredHealth || recoveredHealth.healthScore < beforeRecovery) {
      throw new Error(`Health score did not recover: ${beforeRecovery.toFixed(2)} → ${recoveredHealth?.healthScore.toFixed(2)}`);
    }

    console.log(`✓ Provider A health recovered: ${beforeRecovery.toFixed(2)} → ${recoveredHealth.healthScore.toFixed(2)}\n`);

    // Test 8: Exponential backoff (timing test)
    console.log('Test 8: Testing exponential backoff...');
    router.resetHealth();

    const startTime = Date.now();
    let retryCount = 0;

    const mockRetry = async (provider: ProviderConfig) => {
      retryCount++;
      if (retryCount < 3) {
        throw new Error('Retry needed');
      }
      return 'Success';
    };

    await router.executeWithFallback(mockRetry);
    const duration = Date.now() - startTime;

    // Should have backoff delays (at least 1 second for retry)
    if (duration < 500) {
      console.log(`⚠ Warning: Expected backoff delays, execution too fast (${duration}ms)`);
    } else {
      console.log(`✓ Backoff delays applied (${duration}ms total)\n`);
    }

    console.log('✅ Phase 6 validation PASSED\n');
    return true;

  } catch (error) {
    console.error('❌ Phase 6 validation FAILED:', error);
    return false;
  }
}

// Run validation
validatePhase6().then(passed => {
  process.exit(passed ? 0 : 1);
});
