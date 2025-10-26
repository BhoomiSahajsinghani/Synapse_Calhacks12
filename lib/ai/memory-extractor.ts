import { generateText } from 'ai';
import { myProvider } from './providers';
import Supermemory from 'supermemory';
import type { ChatMessage } from '../types';
import { MEMORY_CONFIG, type MemoryCategory } from './memory-config';

interface ExtractedMemory {
  content: string;
  importance: number; // 0-1 score
  category: MemoryCategory;
}

export class MemoryExtractor {
  private client: Supermemory;
  private containerTags: string[];

  constructor(apiKey: string, userId: string) {
    this.client = new Supermemory({ apiKey });
    this.containerTags = [`sm_project_${userId}`];
  }

  /**
   * Analyze a conversation and extract important memories
   */
  async extractMemories(
    userMessage: ChatMessage,
    assistantMessage: ChatMessage
  ): Promise<ExtractedMemory[]> {
    const userText = userMessage.parts?.find((p: any) => p.type === 'text')?.text || '';
    const assistantText = assistantMessage.parts?.find((p: any) => p.type === 'text')?.text || '';

    if (!userText || !assistantText) return [];

    // Skip extraction for very short messages
    if (userText.length < MEMORY_CONFIG.AUTO_EXTRACT.minMessageLength) {
      return [];
    }

    try {
      // Use AI to analyze what should be remembered
      const { text } = await generateText({
        model: myProvider.languageModel('chat-model'),
        system: `You are a memory extraction system. Analyze the conversation and extract important information that should be remembered for future conversations.

Extract memories that are:
1. User preferences, habits, or personal information
2. Important facts or decisions made
3. Context about ongoing projects or tasks
4. Key insights or learning points
5. Instructions or requirements for future reference

For each memory, provide:
- content: A clear, concise statement of what to remember
- importance: Score from 0 to 1 (0.3=minor detail, 0.5=useful, 0.7=important, 0.9=critical)
- category: One of: fact, preference, context, instruction, insight

Only extract truly valuable information. Skip generic chat or temporary details.

Return as JSON array of objects with {content, importance, category}.
Return empty array [] if nothing important to remember.`,
        prompt: `User said: "${userText}"

Assistant responded: "${assistantText}"

What important information should be remembered from this exchange?`,
        temperature: 0.3,
        maxTokens: 500,
      });

      // Parse the extracted memories
      const memories = this.parseMemories(text);

      // Filter by importance threshold
      const filtered = memories.filter(
        m => m.importance >= MEMORY_CONFIG.MIN_IMPORTANCE_THRESHOLD
      );

      // Limit the number of memories per turn
      return filtered.slice(0, MEMORY_CONFIG.AUTO_EXTRACT.maxMemoriesPerTurn);
    } catch (error) {
      console.error('Failed to extract memories:', error);
      return [];
    }
  }

  /**
   * Parse AI response into structured memories
   */
  private parseMemories(text: string): ExtractedMemory[] {
    try {
      // Try to find JSON array in the response
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];

      const parsed = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(parsed)) return [];

      return parsed
        .filter(item =>
          item.content &&
          typeof item.importance === 'number' &&
          item.category
        )
        .map(item => ({
          content: String(item.content),
          importance: Math.min(1, Math.max(0, Number(item.importance))),
          category: item.category as MemoryCategory,
        }));
    } catch (error) {
      console.error('Failed to parse memories:', error);
      return [];
    }
  }

  /**
   * Save extracted memories to Supermemory
   */
  async saveMemories(memories: ExtractedMemory[]): Promise<number> {
    let saved = 0;

    for (const memory of memories) {
      try {
        await this.client.memories.add({
          content: `[${memory.category.toUpperCase()}] ${memory.content}`,
          containerTags: this.containerTags,
          metadata: {
            importance: memory.importance,
            category: memory.category,
            extractedAt: new Date().toISOString(),
          },
        } as any);
        saved++;
        console.log(`💾 Saved memory (importance: ${memory.importance}): ${memory.content.substring(0, 50)}...`);
      } catch (error) {
        console.error('Failed to save memory:', error);
      }
    }

    return saved;
  }

  /**
   * Automatically extract and save important memories from a conversation
   */
  async processConversation(
    userMessage: ChatMessage,
    assistantMessage: ChatMessage
  ): Promise<{ extracted: number; saved: number }> {
    const memories = await this.extractMemories(userMessage, assistantMessage);

    if (memories.length === 0) {
      return { extracted: 0, saved: 0 };
    }

    const saved = await this.saveMemories(memories);

    return {
      extracted: memories.length,
      saved
    };
  }
}