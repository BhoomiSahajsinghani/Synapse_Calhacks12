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
import { AnswerNode, type AnswerNodeData } from './answer-node';
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
export type FlowNodeData = ConversationNodeData | PromptNodeData | AnswerNodeData;

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
  answerNode: AnswerNode as React.ComponentType<NodeProps>,
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

  // Track which user messages have already been transformed to answer nodes
  const transformedUserMessages = useRef<Set<string>>(new Set());

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
          const textPart = message?.parts?.find(p => p.type === 'text');
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

  // Store nodes and edges in refs for use in callbacks
  const nodesLocalRef = useRef(nodesLocal);
  const edgesLocalRef = useRef(edgesLocal);

  // Keep refs updated
  useEffect(() => {
    nodesLocalRef.current = nodesLocal;
  }, [nodesLocal]);

  useEffect(() => {
    edgesLocalRef.current = edgesLocal;
  }, [edgesLocal]);

  // Track if we're currently receiving updates from Liveblocks
  const isReceivingUpdatesRef = useRef(false);
  // Track which nodes we're currently dragging
  const draggingNodesRef = useRef<Set<string>>(new Set());

  // Stable callbacks for Liveblocks updates
  const handleNodesChangeFromLiveblocks = useCallback((newNodes: Node[]) => {
    // Don't overwrite with empty nodes if we have local nodes
    if (newNodes.length === 0 && nodesLocalRef.current.length > 0) {
      return;
    }

    // Don't update if we have more nodes locally (likely just added one)
    if (nodesLocalRef.current.length > newNodes.length) {
      return;
    }

    // Prevent syncing back only during the update
    isReceivingUpdatesRef.current = true;

    // Create a map of incoming nodes for efficient lookup
    const newNodesMap = new Map(newNodes.map(n => [n.id, n]));

    // Merge with local nodes - preserve local nodes not in the update
    const mergedNodes = nodesLocalRef.current.map(localNode => {
      // If we're dragging this node locally, keep our local version
      if (draggingNodesRef.current.has(localNode.id)) {
        return localNode;
      }
      // Use updated version if it exists, otherwise keep local
      return newNodesMap.get(localNode.id) || localNode;
    });

    // Add any new nodes from Liveblocks that we don't have locally
    newNodes.forEach(newNode => {
      if (!mergedNodes.find(n => n.id === newNode.id)) {
        mergedNodes.push(newNode);
      }
    });

    // Update local state with merged nodes
    setNodesLocal(mergedNodes as FlowNode[]);

    // Reset flag immediately using microtask for better performance
    Promise.resolve().then(() => {
      isReceivingUpdatesRef.current = false;
    });
  }, [setNodesLocal]);

  const handleEdgesChangeFromLiveblocks = useCallback((newEdges: Edge[]) => {
    // Don't overwrite if we have more edges locally (likely just added one)
    if (edgesLocalRef.current.length > newEdges.length) {
      return;
    }

    // Prevent syncing back only during the update
    isReceivingUpdatesRef.current = true;

    // Create a map of incoming edges for efficient lookup
    const newEdgesMap = new Map(newEdges.map(e => [e.id, e]));

    // Merge with local edges - preserve local edges not in the update
    const mergedEdges = edgesLocalRef.current.map(localEdge => {
      return newEdgesMap.get(localEdge.id) || localEdge;
    });

    // Add any new edges from Liveblocks that we don't have locally
    newEdges.forEach(newEdge => {
      if (!mergedEdges.find(e => e.id === newEdge.id)) {
        mergedEdges.push(newEdge);
      }
    });

    // Update local state with merged edges
    setEdgesLocal(mergedEdges);

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

  // Handler for creating new prompt nodes from answer nodes
  const handleAddNewNodeFromAnswer = useCallback((parentId: string) => {
    // Ensure sendMessage is available
    if (!sendMessage) {
      return;
    }

    const id = `prompt-${Date.now()}`;

    // Get parent node from current nodes
    const parentNode = nodesLocalRef.current.find((n: any) => n.id === parentId);
    if (!parentNode) {
      return;
    }

    // Position new node below the parent
    const position = {
      x: parentNode.position.x,
      y: parentNode.position.y + 280,
    };

    // Save this position
    nodePositionsRef.current.set(id, position);

    const newNode = {
      id,
      type: 'promptNode' as const,
      position,
      data: {
        sendMessage,
        status,
        parentNodeId: parentId,
        onCancel: () => {
          setNodesLocal((nds: any) => nds.filter((n: any) => n.id !== id));
          setEdgesLocal((eds: any) =>
            eds.filter((e: any) => e.source !== parentId || e.target !== id)
          );
          if (deleteNode) deleteNode(id);
          nodePositionsRef.current.delete(id);
        },
      },
      draggable: true,
    };

    // Add the new node - use spread to ensure React sees a new array
    setNodesLocal((currentNodes: any) => [...currentNodes, newNode]);

    // Create dashed edge connecting parent to new prompt
    const newEdge = {
      id: `edge-${parentId}-${id}`,
      source: parentId,
      target: id,
      type: 'smoothstep',
      style: {
        stroke: '#10b981', // Green color for visibility
        strokeWidth: 3, // Thicker for better visibility
        strokeDasharray: '5,5',
      },
      animated: true,
    };

    setEdgesLocal((eds: any) => [...eds, newEdge]);


    // Sync to Liveblocks immediately to prevent overwrite
    if (isFlowStorageLoaded) {
      // Add node and edge to Liveblocks storage
      addNode(newNode);
      addEdge(newEdge);
    }
  }, [sendMessage, status, setNodesLocal, setEdgesLocal, isFlowStorageLoaded, addNode, addEdge, deleteNode]);

  // Track if we've loaded flow data from database
  const hasLoadedFlowDataRef = useRef(false);

  // Load flow data from database on mount
  useEffect(() => {
    // Don't initialize until sendMessage is available
    if (!sendMessage || hasLoadedFlowDataRef.current) {
      return;
    }

    async function initializeFlow() {
      hasLoadedFlowDataRef.current = true;
      const { nodes: savedNodes, edges: savedEdges } = await loadFlowData(chatId);

      if (savedNodes.length > 0) {
        // Restore proper data properties for prompt and answer nodes
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
          } else if (node.type === 'answerNode') {
            const answerData = node.data as AnswerNodeData;
            return {
              ...node,
              data: {
                ...answerData,
                onAddNewNode: handleAddNewNodeFromAnswer,
              } as AnswerNodeData,
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

        // Restore node-to-message mapping for answer nodes
        restoredNodes.forEach(node => {
          if (node.type === 'answerNode') {
            const nodeData = node.data as AnswerNodeData;
            if (nodeData.userMessage) {
              nodeToMessageMap.current.set(node.id, nodeData.userMessage.id);
              transformedUserMessages.current.add(nodeData.userMessage.id);
            }
          }
        });

        // Update last processed message count
        lastProcessedMessageCount.current = messages.length;
      } else {
        // No saved nodes - add initial prompt node
        const initialPromptNode = {
          id: 'prompt-initial',
          type: 'promptNode' as const,
          position: { x: 400, y: 200 },
          data: {
            sendMessage,
            status,
          },
          draggable: true,
        };
        setNodesLocal([initialPromptNode]);
        setEdgesLocal([]);

        // Also sync to Liveblocks to prevent it from clearing our node
        if (isFlowStorageLoaded) {
          addNode(initialPromptNode);
        }

        // Set last processed message count to current messages to avoid reprocessing
        lastProcessedMessageCount.current = messages.length;
      }

      setIsInitialized(true);
    }

    initializeFlow();
  }, [chatId, sendMessage, status, isFlowStorageLoaded, addNode, addEdge, setNodesLocal, setEdgesLocal, messages.length]);

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
        if (node.type === 'promptNode' || node.type === 'conversationNode' || node.type === 'answerNode') {
          nodePositionsRef.current.set(node.id, node.position);
        }
      });
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [nodesLocal]);



  // Track which nodes are handling which messages
  const nodeToMessageMap = useRef<Map<string, string>>(new Map());
  const lastProcessedMessageCount = useRef(0);

  // Handle message changes - only process NEW messages
  useEffect(() => {
    if (!isInitialized || !sendMessage) return;

    // If messages were cleared/reset, reset our tracking
    if (messages.length < lastProcessedMessageCount.current) {
      lastProcessedMessageCount.current = 0;
      nodeToMessageMap.current.clear();
      transformedUserMessages.current.clear();
    }

    // Only process new messages
    if (messages.length <= lastProcessedMessageCount.current) return;

    const newMessages = messages.slice(lastProcessedMessageCount.current);

    // Double-check we have actual new messages
    if (newMessages.length === 0) return;

    newMessages.forEach((message) => {
      if (message.role === 'user') {
        // Check if we've already processed this message
        if (transformedUserMessages.current.has(message.id)) return;

        // Find a prompt node that hasn't been assigned a message yet
        // Important: Only look for prompt nodes that exist and aren't already handling a message
        // This ensures new prompt nodes from "Add Follow-up" aren't matched with old messages
        const promptNodes = nodesLocalRef.current.filter(n => n.type === 'promptNode');

        // Find unassigned prompt nodes
        const unassignedPromptNodes = promptNodes.filter(node => {
          // Check if this node is already handling a message
          for (const [nodeId] of nodeToMessageMap.current) {
            if (nodeId === node.id) return false;
          }
          return true;
        });

        // Prefer the initial prompt node or the oldest unassigned one
        const availablePromptNode = unassignedPromptNodes.find(n => n.id === 'prompt-initial') ||
                                   unassignedPromptNodes[0];

        if (availablePromptNode) {
          // Mark as processed
          transformedUserMessages.current.add(message.id);
          nodeToMessageMap.current.set(availablePromptNode.id, message.id);

          // Transform prompt node to answer node
          setNodesLocal((currentNodes: any) => {
            return currentNodes.map((n: any) => {
              if (n.id === availablePromptNode.id) {
                return {
                  ...n,
                  type: 'answerNode',
                  data: {
                    userMessage: message,
                    assistantMessage: undefined,
                    isLoading: true,
                    onAddNewNode: handleAddNewNodeFromAnswer,
                  } as AnswerNodeData,
                };
              }
              return n;
            });
          });
        }
      } else if (message.role === 'assistant') {
        // Find the user message this is responding to
        const messageIndex = messages.indexOf(message);
        const userMessageIndex = messageIndex - 1;

        if (userMessageIndex >= 0 && messages[userMessageIndex]?.role === 'user') {
          const userMessage = messages[userMessageIndex];

          // Update the answer node with the assistant response
          setNodesLocal((currentNodes: any) => {
            return currentNodes.map((n: any) => {
              if (n.type === 'answerNode') {
                const nodeData = n.data as AnswerNodeData;
                if (nodeData.userMessage?.id === userMessage.id) {
                  return {
                    ...n,
                    data: {
                      ...nodeData,
                      assistantMessage: message,
                      isLoading: false,
                      onAddNewNode: nodeData.onAddNewNode || handleAddNewNodeFromAnswer,
                    },
                  };
                }
              }
              return n;
            });
          });
        }
      }
    });

    // Update the last processed count
    lastProcessedMessageCount.current = messages.length;

  }, [messages, isInitialized, sendMessage, setNodesLocal, handleAddNewNodeFromAnswer]);

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
