import { createClient } from "@liveblocks/client";
import { createRoomContext } from "@liveblocks/react";
import type { LiveList, LiveMap, LiveObject } from "@liveblocks/client";

const client = createClient({
  publicApiKey: process.env.NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY as string,
  throttle: 16,
});

// Types for flow nodes and edges matching ReactFlow structure
export type LiveFlowNode = {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: any;
  parentNodeId?: string;
  chatId: string;
  createdAt: string;
  updatedAt: string;
};

export type LiveFlowEdge = {
  id: string;
  source: string;
  target: string;
  type?: string;
  animated?: boolean;
  style?: any;
  chatId: string;
  createdAt: string;
  creatorId?: string; // ID of the user who created this edge
  creatorColor?: string; // Color assigned to the creator
};

// Message type for live synchronization
export type LiveMessage = {
  id: string;
  chatId: string;
  role: "user" | "assistant" | "system";
  content: string;
  parts?: any[];
  attachments?: any[];
  createdAt: string;
  isStreaming?: boolean;
};

// Artifact type for shared documents/code
export type LiveArtifact = {
  id: string;
  title: string;
  content: string;
  language?: string;
  kind: "text" | "code";
  createdAt: string;
  updatedAt: string;
};

// Lock information for node editing
export type NodeLock = {
  nodeId: string;
  userId: string;
  userName: string;
  lockedAt: number; // timestamp
  expiresAt: number; // timestamp for auto-release
};

// Enhanced Presence with more collaboration features
type Presence = {
  cursor: { x: number; y: number } | null;
  user: {
    id: string;
    name: string;
    avatar?: string;
    color: string; // Unique color for cursor/selection
  } | null;
  selectedNodeId: string | null; // Currently selected/focused node
  isTyping: boolean; // Typing indicator for prompt nodes
  viewportPosition: {
    x: number;
    y: number;
    zoom: number;
  } | null;
  followingUserId: string | null; // ID of user being followed
};

// Storage structure for persistent data
export type LiveblocksStorage = {
  flowNodes: LiveMap<string, LiveFlowNode>;
  flowEdges: LiveMap<string, LiveFlowEdge>;
  messages: LiveList<LiveMessage>;
  artifacts: LiveMap<string, LiveArtifact>;
  nodeLocks: LiveMap<string, NodeLock>; // nodeId -> lock info
  chatMetadata: LiveObject<{
    title: string;
    createdAt: string;
    updatedAt: string;
    ownerId: string;
  }>;
};

// User metadata for identification
type UserMeta = {
  id: string;
  info: {
    name: string;
    avatar?: string;
    color: string; // Assigned color for this user
  };
};

// Custom room events for real-time notifications
type RoomEvent =
  | { type: "message-added"; message: LiveMessage }
  | { type: "artifact-updated"; artifactId: string; artifact: LiveArtifact }
  | { type: "node-locked"; nodeId: string; userId: string; userName: string }
  | { type: "node-unlocked"; nodeId: string; userId: string }
  | { type: "user-typing"; nodeId: string; userId: string; isTyping: boolean }
  | { type: "flow-reset"; chatId: string }
  | { type: "stream-started"; messageId: string }
  | { type: "stream-completed"; messageId: string };

// Export room context with all hooks
export const {
  RoomProvider,
  useMyPresence,
  useOthers,
  useOthersMapped,
  useOthersConnectionIds,
  useOther,
  useUpdateMyPresence,
  useSelf,
  useStorage,
  useMutation,
  useHistory,
  useUndo,
  useRedo,
  useCanUndo,
  useCanRedo,
  useRoom,
  useStatus,
  useBroadcastEvent,
  useEventListener,
  useErrorListener,
  useThreads,
} = createRoomContext<Presence, LiveblocksStorage, UserMeta, RoomEvent>(client);

// Helper function to generate a unique user color
export function generateUserColor(userId: string): string {
  const colors = [
    "#FF6B6B", // Red
    "#4ECDC4", // Teal
    "#45B7D1", // Blue
    "#96CEB4", // Green
    "#FECA57", // Yellow
    "#DDA0DD", // Plum
    "#98D8C8", // Mint
    "#FFB6C1", // Light Pink
    "#87CEEB", // Sky Blue
    "#F4A460", // Sandy Brown
  ];

  // Simple hash function to consistently assign colors
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash) + userId.charCodeAt(i);
    hash = hash & hash;
  }

  return colors[Math.abs(hash) % colors.length];
}

// Lock timeout duration (5 minutes)
export const LOCK_TIMEOUT_MS = 5 * 60 * 1000;

// Helper to check if a lock is expired
export function isLockExpired(lock: NodeLock): boolean {
  return Date.now() > lock.expiresAt;
}
