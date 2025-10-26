import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from 'ai';
import { google } from '@ai-sdk/google';
import { createAnthropic } from '@ai-sdk/anthropic';
import { isTestEnvironment } from '../constants';

// Create Anthropic provider with explicit API key
const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const myProvider = isTestEnvironment
  ? (() => {
      const {
        artifactModel,
        chatModel,
        reasoningModel,
        titleModel,
      } = require('./models.mock');
      return customProvider({
        languageModels: {
          'chat-model': chatModel,
          'chat-model-reasoning': reasoningModel,
          'title-model': titleModel,
          'artifact-model': artifactModel,
        },
      });
    })()
  : customProvider({
      languageModels: {
        'chat-model': google('gemini-2.5-flash'),
        'chat-model-reasoning': wrapLanguageModel({
          model: google('gemini-2.5-flash'),
          middleware: extractReasoningMiddleware({ tagName: 'think' }),
        }),
        'claude-3-5-sonnet': anthropic('claude-3-5-sonnet-20241022'),
        'claude-3-5-sonnet-latest': anthropic('claude-3-5-sonnet-latest'),
        'title-model': google('gemini-2.5-flash'),
        'artifact-model': google('gemini-2.5-flash'),
      },
    });
