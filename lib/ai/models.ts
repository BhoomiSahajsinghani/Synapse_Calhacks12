export const DEFAULT_CHAT_MODEL: string = 'chat-model';

export interface ChatModel {
  id: string;
  name: string;
  description: string;
  provider: 'google' | 'anthropic';
}

export const chatModels: Array<ChatModel> = [
  {
    id: 'chat-model',
    name: 'Gemini 2.5 Flash',
    description: 'Advanced multimodal model with vision and text capabilities',
    provider: 'google',
  },
  {
    id: 'chat-model-reasoning',
    name: 'Gemini 2.5 Flash (Reasoning)',
    description:
      'Uses advanced chain-of-thought reasoning for complex problems',
    provider: 'google',
  },
  {
    id: 'claude-3-5-sonnet',
    name: 'Claude 3.5 Sonnet',
    description: 'Latest Claude model with strong coding and reasoning capabilities',
    provider: 'anthropic',
  },
  {
    id: 'claude-3-5-sonnet-latest',
    name: 'Claude 3.5 Sonnet (Latest)',
    description: 'Most recent version of Claude 3.5 Sonnet with improved performance',
    provider: 'anthropic',
  },
];
