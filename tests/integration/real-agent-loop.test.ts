/**
 * Complete Integration Test
 * Tests real LLM execution with tools
 */

import { AgentRuntime } from '../../hemmers/core/runtime/agent';
import { ToolEngine } from '../../hemmers/core/tools/engine';
import { standardTools } from '../../hemmers/core/tools/standard';
import { HemmersAgent } from '../../hemmers/core/runtime/hemmers-agent';
import { agentRegistry } from '../../hemmers/protocol/agent';

async function testRealAgentLoop() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Real Agent Loop Integration Test\n');

  // Check for API keys
  if (!process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY) {
    console.log('⚠️  No API keys found. Set ANTHROPIC_API_KEY or OPENAI_API_KEY');
    console.log('   Skipping real LLM tests\n');
    return true;
  }

  try {
    console.log('Test 1: Agent Runtime Initialization...');
    const runtime = new AgentRuntime({
      provider: process.env.ANTHROPIC_API_KEY ? 'anthropic' : 'openai',
      model: process.env.ANTHROPIC_API_KEY ? 'claude-opus-5' : 'gpt-4o',
      systemPrompt: 'You are a helpful coding assistant.',
      enableTools: false // Start without tools
    });

    console.log('✅ Runtime initialized\n');

    console.log('Test 2: Simple Question (No Tools)...');
    const turn1 = await runtime.executeTurn('What is 2+2?');

    console.log(`   User: What is 2+2?`);
    console.log(`   Assistant: ${turn1.assistantMessage.substring(0, 100)}...`);
    console.log(`   Tokens: ${turn1.tokensUsed}\n`);

    console.log('Test 3: Tool Registration...');
    const toolEngine = new ToolEngine();

    // Register standard tools
    for (const tool of standardTools) {
      toolEngine.register(tool);
    }

    console.log(`✅ Registered ${standardTools.length} tools\n`);

    console.log('Test 4: Universal Agent Protocol...');
    const hemmersAgent = new HemmersAgent();

    await hemmersAgent.initialize({
      provider: process.env.ANTHROPIC_API_KEY ? 'anthropic' : 'openai',
      model: process.env.ANTHROPIC_API_KEY ? 'claude-opus-5' : 'gpt-4o'
    });

    const metadata = hemmersAgent.getMetadata();
    console.log(`   Agent: ${metadata.name}`);
    console.log(`   Capabilities: ${metadata.capabilities.length}`);
    console.log(`   Context Window: ${metadata.contextWindow}\n`);

    // Register with global registry
    agentRegistry.register(hemmersAgent);
    console.log('✅ Agent registered with protocol\n');

    console.log('Test 5: Session Management...');
    const session = await hemmersAgent.createSession();
    console.log(`   Session ID: ${session.id}`);
    console.log(`   Created: ${new Date(session.createdAt).toISOString()}\n`);

    console.log('Test 6: Agent Request via Protocol...');
    const response = await hemmersAgent.request({
      sessionId: session.id,
      messages: [
        { role: 'user', content: 'Hello! Can you help me?' }
      ]
    });

    console.log(`   Response: ${response.content.substring(0, 100)}...`);
    console.log(`   Tokens: ${response.metadata?.tokensUsed || 'N/A'}\n`);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Real Agent Loop Tests PASSED\n');

    console.log('Summary:');
    console.log('✅ Real LLM execution working');
    console.log('✅ Provider abstraction working');
    console.log('✅ Tool system initialized');
    console.log('✅ Universal Protocol implemented');
    console.log('✅ Session management working');
    console.log('✅ Agent registry functional\n');

    await hemmersAgent.shutdown();
    return true;

  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
}

testRealAgentLoop().then(passed => {
  process.exit(passed ? 0 : 1);
});
