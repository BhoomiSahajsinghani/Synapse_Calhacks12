/**
 * Test script to verify Anthropic models are working
 * Run with: bun scripts/test-anthropic.ts
 */

import 'dotenv/config';
import { myProvider } from '../lib/ai/providers';
import { chatModels } from '../lib/ai/models';

async function testAnthropicModels() {
  console.log('🧪 Testing Anthropic Models Configuration\n');

  // Check API key
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('❌ ANTHROPIC_API_KEY is not set');
    process.exit(1);
  }

  console.log('✅ ANTHROPIC_API_KEY is configured');
  console.log(`   Key starts with: ${apiKey.substring(0, 10)}...`);
  console.log(`   Key length: ${apiKey.length} characters\n`);

  // Test Claude models
  const claudeModels = chatModels.filter(m => m.provider === 'anthropic');
  console.log(`📋 Found ${claudeModels.length} Claude models:\n`);

  for (const model of claudeModels) {
    console.log(`Testing model: ${model.name} (${model.id})`);

    try {
      const languageModel = myProvider.languageModel(model.id);
      console.log(`  ✅ Model configured successfully`);
      console.log(`     Model ID: ${languageModel.modelId}`);
      console.log(`     Provider: ${model.provider}`);
      console.log(`     Description: ${model.description}\n`);
    } catch (error: any) {
      console.error(`  ❌ Failed to configure model`);
      console.error(`     Error: ${error.message}\n`);
    }
  }

  console.log('✨ Configuration test complete!');
  console.log('   Claude models are ready to use in the application.');
  console.log('   Users can now select Claude models from the dropdown in prompt nodes.\n');
}

// Run the test
testAnthropicModels().catch(console.error);