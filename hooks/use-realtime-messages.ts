import { useCallback, useEffect, useState } from 'react';
import {
  useStorage,
  useMutation,
  useBroadcastEvent,
  useEventListener,
  useRoom,
} from '@/liveblocks.config';
import type { LiveMessage, LiveArtifact } from '@/liveblocks.config';
import type { ChatMessage } from '@/lib/types';

interface UseRealtimeMessagesProps {
  chatId: string;
  onMessageAdded?: (message: LiveMessage) => void;
  onArtifactUpdated?: (artifact: LiveArtifact) => void;
  onStreamStarted?: (messageId: string) => void;
  onStreamCompleted?: (messageId: string) => void;
}

export function useRealtimeMessages({
  chatId,
  onMessageAdded,
  onArtifactUpdated,
  onStreamStarted,
  onStreamCompleted,
}: UseRealtimeMessagesProps) {
  const room = useRoom();
  const broadcastEvent = useBroadcastEvent();

  // Get storage
  const messages = useStorage((root) => root.messages);
  const artifacts = useStorage((root) => root.artifacts);
  const chatMetadata = useStorage((root) => root.chatMetadata);

  // Local state for optimistic updates
  const [localMessages, setLocalMessages] = useState<LiveMessage[]>([]);
  const [localArtifacts, setLocalArtifacts] = useState<Map<string, LiveArtifact>>(new Map());
  const [streamingMessageIds, setStreamingMessageIds] = useState<Set<string>>(new Set());

  // Sync messages from storage to local state
  useEffect(() => {
    if (!messages) return;

    const messagesArray: LiveMessage[] = [];
    messages.forEach((msg) => {
      if (msg.chatId === chatId) {
        messagesArray.push(msg);
      }
    });

    // Sort by createdAt
    messagesArray.sort((a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    setLocalMessages(messagesArray);
  }, [messages, chatId]);

  // Sync artifacts from storage to local state
  useEffect(() => {
    if (!artifacts) return;

    const artifactsMap = new Map<string, LiveArtifact>();
    artifacts.forEach((artifact, id) => {
      artifactsMap.set(id, artifact);
    });

    setLocalArtifacts(artifactsMap);
  }, [artifacts]);

  // Add new message
  const addMessage = useMutation(({ storage }, message: Omit<LiveMessage, 'createdAt'>) => {
    const messagesList = storage.get('messages');
    const newMessage: LiveMessage = {
      ...message,
      createdAt: new Date().toISOString(),
    };

    messagesList.push(newMessage);

    // Broadcast event
    broadcastEvent({
      type: 'message-added',
      message: newMessage,
    });

    return newMessage;
  }, []);

  // Update message content (for streaming)
  const updateMessageContent = useMutation(
    ({ storage }, messageId: string, content: string, isStreaming: boolean) => {
      const messagesList = storage.get('messages');

      // Find and update the message
      for (let i = 0; i < messagesList.length; i++) {
        const msg = messagesList.get(i);
        if (msg && msg.id === messageId) {
          msg.content = content;
          msg.isStreaming = isStreaming;
          messagesList.set(i, msg);
          break;
        }
      }

      // Broadcast streaming status
      if (!isStreaming) {
        broadcastEvent({
          type: 'stream-completed',
          messageId,
        });
      }
    },
    []
  );

  // Start streaming a message
  const startStreaming = useCallback((messageId: string) => {
    setStreamingMessageIds(prev => new Set([...prev, messageId]));
    broadcastEvent({
      type: 'stream-started',
      messageId,
    });
  }, [broadcastEvent]);

  // Complete streaming a message
  const completeStreaming = useCallback((messageId: string) => {
    setStreamingMessageIds(prev => {
      const next = new Set(prev);
      next.delete(messageId);
      return next;
    });
    broadcastEvent({
      type: 'stream-completed',
      messageId,
    });
  }, [broadcastEvent]);

  // Create or update artifact
  const upsertArtifact = useMutation(
    ({ storage }, artifact: LiveArtifact) => {
      const artifactsMap = storage.get('artifacts');
      artifactsMap.set(artifact.id, artifact);

      // Broadcast event
      broadcastEvent({
        type: 'artifact-updated',
        artifactId: artifact.id,
        artifact,
      });

      return artifact;
    },
    []
  );

  // Delete artifact
  const deleteArtifact = useMutation(({ storage }, artifactId: string) => {
    const artifactsMap = storage.get('artifacts');
    artifactsMap.delete(artifactId);
  }, []);

  // Update chat metadata
  const updateChatMetadata = useMutation(
    ({ storage }, updates: Partial<{
      title: string;
      updatedAt: string;
    }>) => {
      const metadata = storage.get('chatMetadata');

      if (updates.title !== undefined) {
        metadata.set('title', updates.title);
      }

      metadata.set('updatedAt', new Date().toISOString());
    },
    []
  );

  // Listen for real-time events
  useEventListener(({ event }) => {
    switch (event.type) {
      case 'message-added':
        onMessageAdded?.(event.message);
        break;

      case 'artifact-updated':
        onArtifactUpdated?.(event.artifact);
        break;

      case 'stream-started':
        setStreamingMessageIds(prev => new Set([...prev, event.messageId]));
        onStreamStarted?.(event.messageId);
        break;

      case 'stream-completed':
        setStreamingMessageIds(prev => {
          const next = new Set(prev);
          next.delete(event.messageId);
          return next;
        });
        onStreamCompleted?.(event.messageId);
        break;

      case 'flow-reset':
        if (event.chatId === chatId) {
          // Handle flow reset if needed
        }
        break;
    }
  });

  // Convert LiveMessage to ChatMessage format
  const convertToChatMessage = useCallback((liveMessage: LiveMessage): ChatMessage => {
    return {
      id: liveMessage.id,
      role: liveMessage.role,
      parts: liveMessage.parts || [{
        type: 'text',
        text: liveMessage.content,
      }],
      metadata: {
        createdAt: liveMessage.createdAt,
      },
    };
  }, []);

  // Get messages as ChatMessage format
  const getChatMessages = useCallback((): ChatMessage[] => {
    return localMessages.map(convertToChatMessage);
  }, [localMessages, convertToChatMessage]);

  // Check if a message is streaming
  const isMessageStreaming = useCallback((messageId: string): boolean => {
    return streamingMessageIds.has(messageId);
  }, [streamingMessageIds]);

  // Get artifact by ID
  const getArtifact = useCallback((artifactId: string): LiveArtifact | undefined => {
    return localArtifacts.get(artifactId);
  }, [localArtifacts]);

  // Get all artifacts
  const getAllArtifacts = useCallback((): LiveArtifact[] => {
    return Array.from(localArtifacts.values());
  }, [localArtifacts]);

  // Check if storage is loaded
  const isStorageLoaded = messages !== null && artifacts !== null && chatMetadata !== null;

  return {
    // Storage status
    isStorageLoaded,

    // Messages
    messages: localMessages,
    chatMessages: getChatMessages(),
    addMessage,
    updateMessageContent,
    startStreaming,
    completeStreaming,
    isMessageStreaming,

    // Artifacts
    artifacts: localArtifacts,
    getArtifact,
    getAllArtifacts,
    upsertArtifact,
    deleteArtifact,

    // Metadata
    chatMetadata,
    updateChatMetadata,

    // Room info
    roomId: room.id,
  };
}