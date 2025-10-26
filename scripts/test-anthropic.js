#!/usr/bin/env node

/**
 * Test script to verify Anthropic API configuration
 * Run with: node scripts/test-anthropic.js
 */

require('dotenv').config({ path: '.env.local' });

const testAnthropicConfig = () => {
  console.log('🔍 Testing Anthropic Configuration...\n');

  // Check environment variable
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.log('❌ ANTHROPIC_API_KEY is not set in .env.local');
    console.log('   Please add your API key to .env.local:');
    console.log('   ANTHROPIC_API_KEY=your_anthropic_api_key_here\n');
    return false;
  }

  if (apiKey === 'your_anthropic_api_key_here' || apiKey.length < 10) {
    console.log('⚠️  ANTHROPIC_API_KEY appears to be a placeholder');
    console.log('   Please replace it with your actual API key from https://console.anthropic.com/\n');
    return false;
  }

  console.log('✅ ANTHROPIC_API_KEY is configured');
  console.log(`   Key starts with: ${apiKey.substring(0, 10)}...`);
  console.log(`   Key length: ${apiKey.length} characters\n`);

  // Test provider configuration
  console.log('📦 Testing provider configuration...');

  try {
    const { myProvider } = require('../lib/ai/providers');
    const models = ['claude-3-5-sonnet', 'claude-3-5-sonnet-latest'];

    for (const modelId of models) {
      try {
        const model = myProvider.languageModel(modelId);
        console.log(`✅ Model '${modelId}' is properly configured`);
        console.log(`   Model ID: ${model.modelId || 'N/A'}`);
      } catch (error) {
        console.log(`❌ Failed to configure model '${modelId}'`);
        console.log(`   Error: ${error.message}`);
      }
    }

    console.log('\n✨ Configuration test complete!');
    console.log('   Your Claude models should work properly in the application.');
    return true;

  } catch (error) {
    console.log('❌ Failed to load provider configuration');
    console.log(`   Error: ${error.message}`);
    return false;
  }
};

// Run the test
const success = testAnthropicConfig();
process.exit(success ? 0 : 1);