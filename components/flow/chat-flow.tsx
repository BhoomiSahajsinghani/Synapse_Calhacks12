'use client';

import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type NodeTypes,
  addEdge,
  type Connection,
  BackgroundVariant,
  useReactFlow,
  type OnConnectStart,
  type OnConnectEnd,
  ReactFlowProvider,
  type OnMove,
  type NodeProps,
  type Node,
  type Edge,
} from '@xyflow/react';
//@ts-ignore
import '@xyflow/react/dist/style.css';
import { ConversationNode, type ConversationNodeData } from './conversation-node';
import { PromptNode, type PromptNodeData } from './prompt-node';
import { messagesToNodesAndEdges } from './utils';
import type { ChatMessage } from '@/lib/types';
import type { UseChatHelpers } from '@ai-sdk/react';
import { loadFlowData, saveFlowData } from '@/lib/db/flow-actions';
import {
  RoomProvider,
  generateUserColor,
  type LiveblocksStorage,
  type LiveFlowNode,
  type LiveFlowEdge,
  type LiveMessage,
  type LiveArtifact,
  type NodeLock,
} from '@/liveblocks.config';
import { LiveList, LiveMap, LiveObject } from '@liveblocks/client';
import { useRealtimeFlow } from '@/hooks/use-realtime-flow';
import { useRealtimePresence } from '@/hooks/use-realtime-presence';
import { useRealtimeMessages } from '@/hooks/use-realtime-messages';
import { CursorOverlay } from './cursor-overlay';
import { PresenceAvatars } from './presence-avatars';
import { CollaborationToolbar } from '@/components/collaboration-toolbar';

// Union type for all possible node data types
export type FlowNodeData = ConversationNodeData | PromptNodeData;

// Properly typed flow node
export type FlowNode = Node<FlowNodeData>;

interface ChatFlowProps {
  chatId: string;
  messages: ChatMessage[];
  status: UseChatHelpers<ChatMessage>['status'];
  sendMessage: UseChatHelpers<ChatMessage>['sendMessage'];
}

// Create properly typed node components
// We need to cast because ReactFlow's type system expects generic components
const nodeTypes = {
  conversationNode: ConversationNode as React.ComponentType<NodeProps>,
  promptNode: PromptNode as React.ComponentType<NodeProps>,
};

function ChatFlowInner({ chatId, messages, status, sendMessage }: ChatFlowProps) {
  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => messagesToNodesAndEdges(messages, status),
    [messages, status]
  );

  const [connectingNodeId, setConnectingNodeId] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [showPresence, setShowPresence] = useState(true);
  const { screenToFlowPosition } = useReactFlow();

  // Use realtime messages hook for message synchronization
  const {
    isStorageLoaded,
    addMessage: addLiveblocksMessage,
    updateMessageContent,
    startStreaming,
    completeStreaming,
    isMessageStreaming,
  } = useRealtimeMessages({
    chatId,
    onMessageAdded: (_message) => {
      // Handle new message from other users - could trigger UI updates here
    },
    onStreamStarted: (_messageId) => {
      // Handle streaming start - could show loading indicators
    },
    onStreamCompleted: (_messageId) => {
      // Handle streaming completion - could update UI state
    },
  });

  // Track node positions to preserve them
  const nodePositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const previousMessageCountRef = useRef(messages.length);
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const flowContainerRef = useRef<HTMLDivElement>(null);

  // Track synced message IDs to avoid duplicates
  const syncedMessageIds = useRef<Set<string>>(new Set());

  // Track previous message count to detect new messages
  const previousMessageLengthRef = useRef(messages.length);

  // Sync new messages to Liveblocks
  useEffect(() => {
    // Only sync if storage is loaded
    if (!isStorageLoaded) return;

    // Only process if we have new messages
    if (messages.length > previousMessageLengthRef.current) {
      // Process only new messages
      const newMessages = messages.slice(previousMessageLengthRef.current);

      newMessages.forEach(message => {
        if (!syncedMessageIds.current.has(message.id)) {
          // This is a new message that hasn't been synced yet
          const textPart = message.parts.find(p => p.type === 'text');
          if (textPart && textPart.type === 'text') {
            addLiveblocksMessage({
              id: message.id,
              chatId,
              role: message.role,
              content: textPart.text,
              parts: message.parts,
              attachments: [],
              isStreaming: status === 'streaming' && message.role === 'assistant',
            });
            syncedMessageIds.current.add(message.id);

            // If this is an assistant message and it's streaming, handle streaming updates
            if (message.role === 'assistant' && status === 'streaming') {
              startStreaming(message.id);
            }
          }
        }
      });
    }

    previousMessageLengthRef.current = messages.length;

    // If streaming has completed, update the last assistant message
    if (status === 'ready' && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'assistant' && isMessageStreaming(lastMessage.id)) {
        completeStreaming(lastMessage.id);
      }
    }
  }, [messages, status, chatId, isStorageLoaded, addLiveblocksMessage, startStreaming, completeStreaming, isMessageStreaming]);

  // Generate stable user ID
  const stableUserId = useMemo(() => `user-${Math.random().toString(36).substring(2, 11)}`, []); // TODO: Get actual user ID

  // Local state for ReactFlow (synced with Liveblocks)
  const [nodesLocal, setNodesLocal, onNodesChangeLocal] = useNodesState<FlowNode>(initialNodes as FlowNode[]);
  const [edgesLocal, setEdgesLocal, onEdgesChangeLocal] = useEdgesState(initialEdges);

  // Track if we're currently receiving updates from Liveblocks
  const isReceivingUpdatesRef = useRef(false);
  // Track which nodes we're currently dragging
  const draggingNodesRef = useRef<Set<string>>(new Set());

  // Stable callbacks for Liveblocks updates
  const handleNodesChangeFromLiveblocks = useCallback((newNodes: Node[]) => {
    // Prevent syncing back only during the update
    isReceivingUpdatesRef.current = true;

    // Filter out updates for nodes we're currently dragging
    const filteredNodes = newNodes.map(newNode => {
      // If we're dragging this node locally, keep our local version
      if (draggingNodesRef.current.has(newNode.id)) {
        const localNode = nodesLocal.find(n => n.id === newNode.id);
        return localNode || newNode;
      }
      return newNode;
    });

    // Update local state when nodes change from other users
    setNodesLocal(filteredNodes as FlowNode[]);

    // Reset flag immediately using microtask for better performance
    Promise.resolve().then(() => {
      isReceivingUpdatesRef.current = false;
    });
  }, [setNodesLocal, nodesLocal]);

  const handleEdgesChangeFromLiveblocks = useCallback((newEdges: Edge[]) => {
    // Prevent syncing back only during the update
    isReceivingUpdatesRef.current = true;

    // Update local state when edges change from other users
    setEdgesLocal(newEdges);

    // Reset flag immediately using microtask
    Promise.resolve().then(() => {
      isReceivingUpdatesRef.current = false;
    });
  }, [setEdgesLocal]);

  // Realtime flow hook for synchronization
  const {
    isStorageLoaded: isFlowStorageLoaded,
    nodes,
    edges,
    updateNodes,
    updateEdges,
    addNode,
    deleteNode,
    addEdge,
    updateNodePosition,
    acquireLock,
    releaseLock,
    hasLock,
    getNodeLock,
  } = useRealtimeFlow({
    chatId,
    initialNodes,
    initialEdges,
    onNodesChange: handleNodesChangeFromLiveblocks,
    onEdgesChange: handleEdgesChangeFromLiveblocks,
  });

  // Note: Local state is already updated via the callbacks passed to useRealtimeFlow
  // No need for additional effects here as they would cause duplicate updates

  // Wrap the onNodesChange to sync with Liveblocks
  const onNodesChange = useCallback((changes: any) => {
    // Apply changes locally first - immediate UI response
    onNodesChangeLocal(changes);

    // Don't sync back to Liveblocks if we're receiving updates from Liveblocks
    if (isReceivingUpdatesRef.current) return;

    // Then sync to Liveblocks (only if storage is loaded)
    if (isFlowStorageLoaded && changes && changes.length > 0) {
      changes.forEach((change: any) => {
        if (change.type === 'position') {
          if (change.dragging) {
            // Start dragging - just track locally, no lock needed during drag
            draggingNodesRef.current.add(change.id);
          } else if (change.position && draggingNodesRef.current.has(change.id)) {
            // Finished dragging - update position immediately
            draggingNodesRef.current.delete(change.id);
            // Update position directly without debouncing for drag end
            updateNodePosition(change.id, change.position);
          }
        }
      });

      // For non-position changes, update immediately
      const nonPositionChanges = changes.filter((change: any) =>
        change.type !== 'position'
      );
      if (nonPositionChanges.length > 0) {
        updateNodes(nonPositionChanges);
      }
    }
  }, [onNodesChangeLocal, isFlowStorageLoaded, updateNodes, updateNodePosition]);

  // Wrap the onEdgesChange to sync with Liveblocks
  const onEdgesChange = useCallback((changes: any) => {
    // Apply changes locally first
    onEdgesChangeLocal(changes);

    // Don't sync back to Liveblocks if we're receiving updates from Liveblocks
    if (isReceivingUpdatesRef.current) return;

    // Then sync to Liveblocks (only if storage is loaded)
    if (isFlowStorageLoaded && changes && changes.length > 0) {
      updateEdges(changes);
    }
  }, [onEdgesChangeLocal, isFlowStorageLoaded, updateEdges]);

  // Realtime presence hook
  const {
    myPresence,
    userColor,
    setSelectedNode,
    setIsTyping,
    handleTyping,
    updateViewport,
    followUser,
    followingUser,
    followedUser,
    otherUsers,
    activeUserCount,
    getUsersOnNode,
  } = useRealtimePresence({
    containerRef: flowContainerRef,
    userId: stableUserId,
    userName: 'User', // TODO: Get actual user name
  });

  // Load flow data from database on mount
  useEffect(() => {
    async function initializeFlow() {
      const { nodes: savedNodes, edges: savedEdges } = await loadFlowData(chatId);

      if (savedNodes.length > 0) {
        // Restore proper data properties for prompt nodes
        const restoredNodes: FlowNode[] = savedNodes.map(node => {
          if (node.type === 'promptNode') {
            return {
              ...node,
              data: {
                ...node.data,
                sendMessage,
                status,
                onCancel: (node.data as PromptNodeData).onCancel,
              } as PromptNodeData,
            } as FlowNode;
          }
          return node as FlowNode;
        });

        setNodesLocal(restoredNodes);
        setEdgesLocal(savedEdges);
        // Also sync to Liveblocks (only if storage is loaded)
        if (isFlowStorageLoaded) {
          restoredNodes.forEach(node => addNode(node));
          savedEdges.forEach(edge => addEdge(edge));
        }

        // Save positions to ref
        restoredNodes.forEach(node => {
          nodePositionsRef.current.set(node.id, node.position);
        });
      }

      setIsInitialized(true);
    }

    initializeFlow();
  }, [chatId, sendMessage, status, isFlowStorageLoaded, addNode, addEdge, setNodesLocal, setEdgesLocal]);

  // Debounced save to database
  const debouncedSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      await saveFlowData({ chatId, nodes: nodesLocal, edges: edgesLocal });
    }, 1000); // Save 1 second after last change
  }, [chatId, nodesLocal, edgesLocal]);

  // Save when nodes or edges change
  useEffect(() => {
    if (!isInitialized) return;
    debouncedSave();

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [isInitialized, debouncedSave]);

  // Save positions whenever nodes change (debounced to avoid frequent updates)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      nodesLocal.forEach(node => {
        if (node.type === 'promptNode' || node.type === 'conversationNode') {
          nodePositionsRef.current.set(node.id, node.position);
        }
      });
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [nodesLocal]);

  // Store nodes in ref to avoid dependency issues
  const nodesLocalRef = useRef(nodesLocal);
  useEffect(() => {
    nodesLocalRef.current = nodesLocal;
  }, [nodesLocal]);

  // Update nodes and edges when messages change
  useEffect(() => {
    // Wait for initialization to complete before syncing messages
    if (!isInitialized) return;

    const { nodes: newNodes, edges: newEdges } = messagesToNodesAndEdges(
      messages,
      status
    );

    // If no messages, add an initial prompt node
    if (newNodes.length === 0) {
      // Check if we already have a prompt node
      const hasPromptNode = nodesLocalRef.current.some(n => n.type === 'promptNode');
      if (!hasPromptNode) {
        const initialPromptNode = {
          id: 'initial-prompt',
          type: 'promptNode' as const,
          position: { x: 300, y: 100 },
          data: {
            sendMessage,
            status,
          },
          draggable: false,
        };
        setNodesLocal([initialPromptNode]);
        setEdgesLocal([]);
        // Also sync to Liveblocks (only if storage is loaded)
        if (isFlowStorageLoaded) {
          addNode(initialPromptNode);
        }
      }
      previousMessageCountRef.current = 0;
      return;
    }

    // Check if a new message was just added
    const messageCountIncreased = messages.length > previousMessageCountRef.current;

    // Find any prompt nodes in current view
    const currentPromptNodes = nodesLocalRef.current.filter(n => n.type === 'promptNode');

    // Only update if messages changed or we don't have the right conversation nodes
    const currentConversationIds = nodesLocalRef.current.filter(n => n.type === 'conversationNode').map(n => n.id);
    const newConversationIds = newNodes.map(n => n.id);
    const needsUpdate = messageCountIncreased ||
                        currentConversationIds.length !== newConversationIds.length ||
                        !currentConversationIds.every(id => newConversationIds.includes(id));

    if (!needsUpdate) {
      previousMessageCountRef.current = messages.length;
      return;
    }

    previousMessageCountRef.current = messages.length;

    // Apply saved positions to nodes
    const nodesWithPositions = newNodes.map((newNode, index) => {
      // First check if this exact node ID exists in saved positions
      const savedPosition = nodePositionsRef.current.get(newNode.id);
      if (savedPosition) {
        return { ...newNode, position: savedPosition };
      }

      // If this is a newly created conversation node and we just added a message
      // Use the position of the first prompt node (which was just used to create this)
      if (messageCountIncreased && newNode.type === 'conversationNode' && currentPromptNodes.length > 0) {
        const lastConversationIndex = newNodes.filter(n => n.type === 'conversationNode').length - 1;
        if (index === newNodes.findIndex(n => n.type === 'conversationNode' && newNodes.indexOf(n) === lastConversationIndex)) {
          // This is the newest conversation node - use the prompt node's position
          const promptPosition = currentPromptNodes[0].position;
          nodePositionsRef.current.set(newNode.id, promptPosition);
          return { ...newNode, position: promptPosition };
        }
      }

      return newNode;
    });

    // If we just added a message, replace the prompt node with the conversation node
    if (messageCountIncreased && currentPromptNodes.length > 0) {
      const newestConversationNode = nodesWithPositions[nodesWithPositions.length - 1];
      const submittedPromptNode = currentPromptNodes[0];
      const parentNodeId = (submittedPromptNode.data as any)?.parentNodeId;

      // Remove the submitted prompt node from the list of nodes to keep
      const remainingPromptNodes = currentPromptNodes.filter(n => n.id !== submittedPromptNode.id);

      if (parentNodeId && newestConversationNode) {
        // Has a parent - update edge from parent → prompt to parent → conversation
        const parentToConversationEdge = {
          id: `edge-${parentNodeId}-${newestConversationNode.id}`,
          source: parentNodeId,
          target: newestConversationNode.id,
          type: 'smoothstep',
          style: {
            stroke: 'hsl(var(--primary))',
            strokeWidth: 2,
          },
        };

        setEdgesLocal((eds: any) => {
          // Remove the edge from parent to prompt node
          const filtered = eds.filter(
            (e: any) => !(e.source === parentNodeId && e.target === submittedPromptNode.id)
          );
          return [...filtered, ...newEdges, parentToConversationEdge];
        });
      } else {
        // No parent - just use the default edges from messagesToNodesAndEdges
        setEdgesLocal(newEdges);
      }

      // Update nodes: conversation nodes + remaining prompt nodes (excluding submitted one)
      const allNodes = [...nodesWithPositions, ...remainingPromptNodes];
      setNodesLocal(allNodes);

      // Sync new conversation nodes to Liveblocks (only if storage is loaded)
      if (isFlowStorageLoaded) {
        nodesWithPositions.forEach(node => {
          // Only add if it's a new node (not already in Liveblocks)
          const existingNode = nodes.find(n => n.id === node.id);
          if (!existingNode) {
            addNode(node);
          }
        });

        // Also sync the edge updates to Liveblocks
        if (parentNodeId && newestConversationNode) {
          const parentToConversationEdge = {
            id: `edge-${parentNodeId}-${newestConversationNode.id}`,
            source: parentNodeId,
            target: newestConversationNode.id,
            type: 'smoothstep',
          };
          addEdge(parentToConversationEdge);

          // Delete the old prompt node from Liveblocks
          deleteNode(submittedPromptNode.id);
        }
      }

      return;
    }

    // No new messages - keep all nodes as is
    const promptNodesToKeep = nodesLocalRef.current.filter(n => n.type === 'promptNode');
    const allNodes = [...nodesWithPositions, ...promptNodesToKeep];
    setNodesLocal(allNodes);
    setEdgesLocal(newEdges);

    // Sync to Liveblocks if needed (only if storage is loaded)
    if (isFlowStorageLoaded) {
      nodesWithPositions.forEach(node => {
        const existingNode = nodes.find(n => n.id === node.id);
        if (!existingNode) {
          addNode(node);
        }
      });

      newEdges.forEach(edge => {
        const existingEdge = edges.find(e => e.id === edge.id);
        if (!existingEdge) {
          addEdge(edge);
        }
      });
    }
  }, [messages, status, sendMessage, setNodesLocal, setEdgesLocal, isInitialized, isFlowStorageLoaded, addNode, addEdge, deleteNode, nodes, edges]);

  const onConnectStart: OnConnectStart = useCallback((_, { nodeId }) => {
    setConnectingNodeId(nodeId);
  }, []);

  const onConnectEnd: OnConnectEnd = useCallback(
    (event) => {
      if (!connectingNodeId) return;

      const targetIsPane = (event.target as Element).classList.contains(
        'react-flow__pane'
      );

      if (targetIsPane && event instanceof MouseEvent) {
        // Create a new prompt node at the drop position
        const id = `prompt-${Date.now()}`;
        const position = screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });

        // Save this position
        nodePositionsRef.current.set(id, position);

        const newNode = {
          id,
          type: 'promptNode' as const,
          position,
          data: {
            sendMessage,
            status,
            parentNodeId: connectingNodeId,
            onCancel: () => {
              setNodesLocal((nds: any) => nds.filter((n: any) => n.id !== id));
              setEdgesLocal((eds: any) =>
                eds.filter((e: any) => e.source !== connectingNodeId || e.target !== id)
              );
              deleteNode(id);
              nodePositionsRef.current.delete(id);
            },
          },
          draggable: true,
        };

        setNodesLocal((nds: any) => nds.concat(newNode));

        // Create edge connecting parent to child
        const newEdge = {
          id: `edge-${connectingNodeId}-${id}`,
          source: connectingNodeId,
          target: id,
          type: 'smoothstep',
          style: {
            stroke: 'hsl(var(--primary))',
            strokeWidth: 2,
            strokeDasharray: '5,5',
          },
        };

        setEdgesLocal((eds: any) => eds.concat(newEdge));

        // Sync to Liveblocks (only if storage is loaded)
        if (isFlowStorageLoaded) {
          addNode(newNode);
          addEdge(newEdge);
        }
      }

      setConnectingNodeId(null);
    },
    [connectingNodeId, screenToFlowPosition, sendMessage, status, setNodesLocal, setEdgesLocal, isFlowStorageLoaded, addNode, deleteNode, addEdge]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;

      const newEdge = {
        id: `${connection.source}-${connection.target}`,
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle,
        targetHandle: connection.targetHandle,
      };

      // Only sync to Liveblocks if storage is loaded
      if (isFlowStorageLoaded) {
        addEdge(newEdge);
      }
    },
    [isFlowStorageLoaded, addEdge]
  );

  return (
    <div className='relative h-full w-full' ref={flowContainerRef}>
      {/* Collaboration Toolbar */}
      <div className="absolute top-4 right-4 z-10">
        <CollaborationToolbar
          followingUser={followingUser}
          onFollowUser={followUser}
          showPresence={showPresence}
          onTogglePresence={() => setShowPresence(!showPresence)}
        />
      </div>

      {/* Cursor Overlay */}
      {showPresence && <CursorOverlay containerRef={flowContainerRef} />}

      <ReactFlow
        nodes={nodesLocal}
        edges={edgesLocal}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{
          padding: 0.3,
          includeHiddenNodes: false,
          maxZoom: 1,
        }}
        minZoom={0.2}
        maxZoom={1.2}
        defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
        className="bg-background"
        proOptions={{ hideAttribution: true }}
        nodesDraggable={true}
        nodesConnectable={true}
        elementsSelectable={true}
        panOnScroll={true}
        panOnDrag={true}
        zoomOnScroll={true}
        zoomOnPinch={true}
        zoomOnDoubleClick={false}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1.5}
          className="bg-background"
          color="hsl(var(--border))"
        />
        <Controls
          showInteractive={false}
          className="rounded-md border bg-background/80 shadow-lg backdrop-blur-sm"
        />
        <MiniMap
          nodeStrokeWidth={3}
          className="rounded-md border bg-background/80 shadow-lg backdrop-blur-sm"
          pannable
          zoomable
          nodeColor={(node) => {
            if (node.type === 'conversationNode') return '#a855f7';
            if (node.type === 'promptNode') return '#22c55e';
            return '#6b7280';
          }}
        />
      </ReactFlow>
    </div>
  );
}

function ChatFlowWithRealtime(props: ChatFlowProps) {
  return (
    <ReactFlowProvider>
      <ChatFlowInner {...props} />
    </ReactFlowProvider>
  );
}

export function ChatFlow(props: ChatFlowProps) {
  // Generate stable user ID and color
  const userId = useMemo(() => `user-${Math.random().toString(36).substring(2, 11)}`, []); // TODO: Get actual user ID
  const userColor = useMemo(() => generateUserColor(userId), [userId]);

  // Create stable initial presence
  const initialPresence = useMemo(() => ({
    cursor: null,
    user: {
      id: userId,
      name: 'User', // TODO: Get actual user name
      avatar: undefined,
      color: userColor,
    },
    selectedNodeId: null,
    isTyping: false,
    viewportPosition: null,
    followingUserId: null,
  }), [userId, userColor]);

  // Create stable initial storage function
  const initialStorage = useCallback((): LiveblocksStorage => ({
    flowNodes: new LiveMap<string, LiveFlowNode>(),
    flowEdges: new LiveMap<string, LiveFlowEdge>(),
    messages: new LiveList<LiveMessage>([]),
    artifacts: new LiveMap<string, LiveArtifact>(),
    nodeLocks: new LiveMap<string, NodeLock>(),
    chatMetadata: new LiveObject({
      title: 'Chat',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ownerId: userId,
    }),
  }), [userId]);

  // Initialize Liveblocks room with chat ID
  return (
    <RoomProvider
      id={`chat-${props.chatId}`}
      initialPresence={initialPresence}
      initialStorage={initialStorage}
    >
      <ChatFlowWithRealtime {...props} />
    </RoomProvider>
  );
}
