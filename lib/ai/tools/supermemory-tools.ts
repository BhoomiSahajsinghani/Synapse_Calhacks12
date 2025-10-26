import { tool } from 'ai';
import { z } from 'zod';
import Supermemory from 'supermemory';

export function addMemoryTool(apiKey: string, opts: { projectId: string }) {
  const client = new Supermemory({ apiKey });
  const containerTags = [`sm_project_${opts.projectId}`];

  return tool({
    description:
      'Proactively save important information about the user, their preferences, context, or facts. Use this when the user shares: personal details (name, location, job), preferences (style, tools, formats), ongoing projects, recurring needs, instructions, or when they say "remember". Always be proactive about saving useful context.',
    inputSchema: z.object({
      memory: z
        .string()
        .min(1)
        .describe('Clear, specific, searchable description of what to remember. Include category context.'),
    }),
    execute: async ({ memory }) => {
      const res = await client.memories.add({
        content: memory,
        containerTags,
      });
      return { success: true, memory: res } as const;
    },
  });
}

export function searchMemoriesTool(
  apiKey: string,
  opts: { projectId: string },
) {
  const client = new Supermemory({ apiKey });
  const containerTags = [`sm_project_${opts.projectId}`];

  return tool({
    description:
      'Search memories BEFORE answering questions or using tools. Always search for: user location/timezone for weather, user preferences for any task, project context for technical questions, past instructions for recurring tasks. Use this proactively to personalize responses.',
    inputSchema: z.object({
      informationToGet: z
        .string()
        .min(1)
        .describe("Terms to search for in the user's memories"),
      includeFullDocs: z
        .boolean()
        .optional()
        .default(true)
        .describe('Include full document content.'),
      limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .optional()
        .default(5)
        .describe('Maximum number of results to return'),
    }),
    execute: async ({
      informationToGet,
      includeFullDocs = true,
      limit = 5,
    }) => {
      const r = await client.search.execute({
        q: informationToGet,
        containerTags,
        limit,
        chunkThreshold: 0.6,
        includeFullDocs,
      } as any);

      return {
        success: true,
        results: r.results,
        count: r.results?.length ?? 0,
      } as const;
    },
  });
}
