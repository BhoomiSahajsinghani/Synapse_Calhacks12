/**
 * Configuration for automatic memory extraction
 */

export const MEMORY_CONFIG = {
  // Minimum importance score for a memory to be saved (0-1)
  MIN_IMPORTANCE_THRESHOLD: 0.5,

  // Categories of information to extract
  MEMORY_CATEGORIES: [
    'fact',        // Factual information about user or entities
    'preference',  // User preferences and likes/dislikes
    'context',     // Ongoing projects, tasks, situations
    'instruction', // Specific requirements or instructions
    'insight',     // Important learnings or conclusions
  ] as const,

  // Keywords that trigger more aggressive memory extraction
  TRIGGER_KEYWORDS: [
    'remember',
    'save this',
    'keep in mind',
    'don\'t forget',
    'always',
    'never',
    'prefer',
    'my name is',
    'I live in',
    'I work',
    'every day',
    'every week',
    'usually',
    'important',
  ],

  // Examples of good memories for the AI to learn from
  MEMORY_EXAMPLES: [
    {
      content: "User lives in San Francisco, CA (PST timezone)",
      importance: 0.8,
      category: 'fact' as const
    },
    {
      content: "Prefers concise, technical explanations without fluff",
      importance: 0.7,
      category: 'preference' as const
    },
    {
      content: "Working on a React Native fitness tracking app called FitTracker",
      importance: 0.9,
      category: 'context' as const
    },
    {
      content: "Always use TypeScript instead of JavaScript for code examples",
      importance: 0.8,
      category: 'instruction' as const
    },
    {
      content: "User is learning machine learning, currently studying neural networks",
      importance: 0.6,
      category: 'context' as const
    },
  ],

  // Configuration for automatic extraction
  AUTO_EXTRACT: {
    enabled: true,
    // Only extract from messages longer than this (characters)
    minMessageLength: 50,
    // Maximum memories to extract per conversation turn
    maxMemoriesPerTurn: 5,
    // Delay before extraction starts (ms) - to avoid blocking the response
    extractionDelay: 1000,
  },

  // Memory search configuration
  SEARCH: {
    // Default number of memories to retrieve
    defaultLimit: 5,
    // Maximum number of memories to retrieve
    maxLimit: 20,
    // Minimum relevance score for search results
    minRelevanceScore: 0.6,
  }
};

export type MemoryCategory = typeof MEMORY_CONFIG.MEMORY_CATEGORIES[number];