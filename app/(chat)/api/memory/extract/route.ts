import { auth } from '@/app/(auth)/auth';
import { MemoryExtractor } from '@/lib/ai/memory-extractor';
import { ChatSDKError } from '@/lib/errors';
import { NextResponse } from 'next/server';
import type { ChatMessage } from '@/lib/types';

export async function POST(request: Request) {
  console.log('🧠 Memory extraction requested');

  try {
    const session = await auth();
    if (!session?.user) {
      return new ChatSDKError('unauthorized:chat').toResponse();
    }

    if (session.user.type === 'guest') {
      return NextResponse.json(
        { error: 'Memory features are not available for guest users' },
        { status: 403 }
      );
    }

    if (!process.env.SUPERMEMORY_API_KEY) {
      return NextResponse.json(
        { error: 'Memory system is not configured' },
        { status: 503 }
      );
    }

    const { userMessage, assistantMessage } = await request.json();

    if (!userMessage || !assistantMessage) {
      return NextResponse.json(
        { error: 'Both user and assistant messages are required' },
        { status: 400 }
      );
    }

    const memoryExtractor = new MemoryExtractor(
      process.env.SUPERMEMORY_API_KEY,
      session.user.id
    );

    const result = await memoryExtractor.processConversation(
      userMessage as ChatMessage,
      assistantMessage as ChatMessage
    );

    console.log(`✅ Extracted ${result.extracted} memories, saved ${result.saved}`);

    return NextResponse.json({
      success: true,
      extracted: result.extracted,
      saved: result.saved,
      message: result.saved > 0
        ? `Successfully extracted and saved ${result.saved} memories`
        : 'No important information found to remember'
    });

  } catch (error) {
    console.error('Memory extraction failed:', error);
    return NextResponse.json(
      { error: 'Failed to extract memories' },
      { status: 500 }
    );
  }
}