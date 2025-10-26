'use client';

import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  ReactFlow,
  Background,
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
import { PromptNode, type PromptNodeData } from './prompt-node';
import { AnswerNode, type AnswerNodeData } from './answer-node';
import { CollaboratorList } from './collaborator-list';
import { messagesToNodesAndEdges } from './utils';
import type { ChatMessage } from '@/lib/types';
import type { UseChatHelpers } from '@ai-sdk/react';
import { loadFlowData, saveFlowData } from '@/lib/db/flow-actions';
import { getLayoutedElements, getRadialLayout, getTreeLayout } from './dagre-layout';
import {
  RoomProvider,
  generateUserColor,
  useStorage,
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
export type FlowNodeData = PromptNodeData | AnswerNodeData;

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
  const [hasUpdatedUrl, setHasUpdatedUrl] = useState(false);
  const { screenToFlowPosition, zoomIn, zoomOut } = useReactFlow();

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

  // Track which nodes are handling which messages
  const nodeToMessageMap = useRef<Map<string, string>>(new Map());
  const transformedUserMessages = useRef<Set<string>>(new Set());

  // Wrap sendMessage to handle URL update and database operations
  const wrappedSendMessage = useCallback((message: any) => {
    console.log('🚀 wrappedSendMessage called with:', message);

    // Check if we're on the home page (chatId is a temporary UUID)
    if (!hasUpdatedUrl && !chatId.startsWith('chat-')) {
      // Update URL seamlessly to show chat ID
      window.history.pushState({ chatId }, '', `/chat/${chatId}`);
      setHasUpdatedUrl(true);

      // The backend will automatically create the chat when we send the message
      // Start saving flow data after URL is updated
      setTimeout(() => {
        saveFlowData({
          chatId,
          nodes: nodesLocalRef.current,
          edges: edgesLocalRef.current
        });
      }, 500);
    }

    // Always send the message
    console.log('📤 Sending message to API');
    sendMessage(message);
  }, [hasUpdatedUrl, chatId, sendMessage]);

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

  // Generate stable user ID and name based on sessionStorage
  const { stableUserId, userName, userColor } = useMemo(() => {
    if (typeof window !== 'undefined') {
      let userId = sessionStorage.getItem('liveblocks-user-id');
      let name = sessionStorage.getItem('liveblocks-user-name');

      if (!userId) {
        // Generate a unique ID for this session
        userId = `user-${Math.random().toString(36).substring(2, 10)}`;
        sessionStorage.setItem('liveblocks-user-id', userId);
      }

      if (!name) {
        // Generate a random username
        const adjectives = ['Swift', 'Bright', 'Cool', 'Smart', 'Happy', 'Clever', 'Quick', 'Wise'];
        const nouns = ['Coder', 'Builder', 'Creator', 'Maker', 'Designer', 'Thinker', 'Explorer', 'Pioneer'];
        name = `${adjectives[Math.floor(Math.random() * adjectives.length)]} ${nouns[Math.floor(Math.random() * nouns.length)]}`;
        sessionStorage.setItem('liveblocks-user-name', name);
      }

      const color = generateUserColor(userId);
      return { stableUserId: userId, userName: name, userColor: color };
    }
    // Fallback for SSR
    return {
      stableUserId: `user-${Math.random().toString(36).substring(2, 10)}`,
      userName: 'Anonymous',
      userColor: '#6b7280'
    };
  }, []); // No dependencies - ID should be stable per session

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
      console.log('Skipping empty Liveblocks update');
      return;
    }

    // Skip initial Liveblocks updates if we've restored from saved nodes
    // Give some time for our restored nodes to sync to Liveblocks
    if (hasRestoredFromSavedNodes.current && restoredFromSavedNodesTimestamp.current > 0) {
      const timeSinceRestore = Date.now() - restoredFromSavedNodesTimestamp.current;
      if (timeSinceRestore < 3000) { // Give 3 seconds for sync
        console.log('Skipping Liveblocks update - just restored from saved nodes', timeSinceRestore, 'ms ago');
        return;
      }
    }

    // Don't update if we have more nodes locally (likely just added one)
    if (nodesLocalRef.current.length > newNodes.length) {
      console.log('Skipping Liveblocks update - have more nodes locally');
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

      // Get the new node from Liveblocks
      const newNode = newNodesMap.get(localNode.id);

      // If there's a new node, carefully merge it
      if (newNode) {
        // Preserve the node type and critical data
        if (localNode.type === 'answerNode' && newNode.type === 'promptNode') {
          console.warn('Preventing answerNode from becoming promptNode:', localNode.id);
          return localNode; // Keep the local version
        }

        // For answer nodes, preserve the message data
        if (localNode.type === 'answerNode') {
          const localData = localNode.data as AnswerNodeData;
          return {
            ...newNode,
            type: 'answerNode',
            data: {
              ...localData,
              // Only update position from Liveblocks, keep message data
              ...(newNode.data || {}),
              userMessage: localData.userMessage,
              assistantMessage: localData.assistantMessage,
              isLoading: localData.isLoading,
              onAddNewNode: localData.onAddNewNode,
            }
          };
        }

        return newNode;
      }

      // Keep local if no update
      return localNode;
    });

    // Add any new nodes from Liveblocks that we don't have locally
    newNodes.forEach(newNode => {
      if (!mergedNodes.find(n => n.id === newNode.id)) {
        // For prompt nodes, add the required functions
        // These will be properly set up later when the node is rendered
        if (newNode.type === 'promptNode') {
          const nodeWithFunctions = {
            ...newNode,
            data: {
              ...newNode.data,
              sendMessage: wrappedSendMessage,
              status: 'ready' as const,
              // onCancel will be added when the component updates
            },
          };
          mergedNodes.push(nodeWithFunctions);
        } else {
          mergedNodes.push(newNode);
        }
      }
    });

    // Update local state with merged nodes
    setNodesLocal(mergedNodes as FlowNode[]);

    // Reset flag immediately using microtask for better performance
    Promise.resolve().then(() => {
      isReceivingUpdatesRef.current = false;
    });
  }, [setNodesLocal, isInitialized, wrappedSendMessage, setEdgesLocal]);

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
            if (isFlowStorageLoaded && updateNodePosition) {
              updateNodePosition(change.id, change.position);
            }
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
    userColor: presenceColor,
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
    userName: userName,
  });

  // Handler for creating new prompt nodes from answer nodes
  const handleAddNewNodeFromAnswer = useCallback((parentId: string, direction: string = 'right') => {
    // Ensure sendMessage is available
    if (!wrappedSendMessage) {
      return;
    }

    const id = `prompt-${Date.now()}`;

    // Get parent node from current nodes
    const parentNode = nodesLocalRef.current.find((n: any) => n.id === parentId);
    if (!parentNode) {
      return;
    }

    // Position new node based on direction
    let position;
    switch (direction) {
      case 'left':
        position = {
          x: parentNode.position.x - 600,
          y: parentNode.position.y,
        };
        break;
      case 'right':
        position = {
          x: parentNode.position.x + 600,
          y: parentNode.position.y,
        };
        break;
      case 'top':
        position = {
          x: parentNode.position.x,
          y: parentNode.position.y - 300,
        };
        break;
      case 'bottom':
        position = {
          x: parentNode.position.x,
          y: parentNode.position.y + 300,
        };
        break;
      default:
        position = {
          x: parentNode.position.x + 600, // Default to right
          y: parentNode.position.y,
        };
    }

    // Save this position
    nodePositionsRef.current.set(id, position);

    const newNode = {
      id,
      type: 'promptNode' as const,
      position,
      data: {
        sendMessage: wrappedSendMessage,
        status: 'ready' as const, // Always set to 'ready' so the new node can accept input
        parentNodeId: parentId,
        creatorId: stableUserId,
        creatorName: userName,
        creatorColor: userColor,
        onCancel: () => {
          setNodesLocal((nds: any) => nds.filter((n: any) => n.id !== id));
          setEdgesLocal((eds: any) =>
            eds.filter((e: any) => e.source !== parentId || e.target !== id)
          );
          // Only delete from storage if it's loaded
          if (isFlowStorageLoaded && deleteNode) {
            deleteNode(id);
          }
          nodePositionsRef.current.delete(id);
        },
      },
      draggable: true,
    };

    // Add the new node - use spread to ensure React sees a new array
    setNodesLocal((currentNodes: any) => [...currentNodes, newNode]);

    // Create dashed edge connecting parent to new prompt with user's color
    const newEdge = {
      id: `edge-${parentId}-${id}`,
      source: parentId,
      target: id,
      type: 'smoothstep',
      style: {
        stroke: userColor || '#10b981', // Use user's color or fallback to green
        strokeWidth: 3, // Thicker for better visibility
        strokeDasharray: '5,5',
      },
      animated: true,
    };

    setEdgesLocal((eds: any) => [...eds, newEdge]);


    // Sync to Liveblocks immediately to prevent overwrite
    if (isFlowStorageLoaded && addNode && addEdge) {
      // Add node and edge to Liveblocks storage
      addNode(newNode);
      addEdge(newEdge);
    }

    // Don't save prompt nodes to database - wait until they become answer nodes
    // This prevents the issue where prompt nodes are saved and then loaded back as prompt nodes
  }, [wrappedSendMessage, status, setNodesLocal, setEdgesLocal, isFlowStorageLoaded, addNode, addEdge, deleteNode, stableUserId, userName, userColor]);

  // Add required functions to nodes that come from Liveblocks
  // This effect must be after handleAddNewNodeFromAnswer is defined
  useEffect(() => {
    if (!nodes || !wrappedSendMessage) return;

    // Update nodes with proper functions
    const nodesNeedingUpdate = nodesLocal.filter((node: FlowNode) => {
      if (node.type === 'promptNode') {
        const data = node.data as PromptNodeData;
        return !data.onCancel || !data.sendMessage;
      } else if (node.type === 'answerNode') {
        const data = node.data as AnswerNodeData;
        return !data.onAddNewNode;
      }
      return false;
    });

    if (nodesNeedingUpdate.length > 0) {
      setNodesLocal((currentNodes: FlowNode[]) => {
        return currentNodes.map((node: FlowNode) => {
          if (node.type === 'promptNode') {
            const data = node.data as PromptNodeData;
            if (!data.onCancel || !data.sendMessage) {
              return {
                ...node,
                data: {
                  ...data,
                  sendMessage: wrappedSendMessage,
                  status: data.status || 'ready',
                  onCancel: () => {
                    setNodesLocal((nds: FlowNode[]) => nds.filter((n) => n.id !== node.id));
                    setEdgesLocal((eds) =>
                      eds.filter((e) => e.source !== node.id && e.target !== node.id)
                    );
                    if (isFlowStorageLoaded && deleteNode) {
                      deleteNode(node.id);
                    }
                    nodePositionsRef.current.delete(node.id);
                  },
                } as PromptNodeData,
              };
            }
          } else if (node.type === 'answerNode') {
            const data = node.data as AnswerNodeData;
            if (!data.onAddNewNode) {
              return {
                ...node,
                data: {
                  ...data,
                  onAddNewNode: handleAddNewNodeFromAnswer,
                } as AnswerNodeData,
              };
            }
          }
          return node;
        });
      });
    }
  }, [nodes, wrappedSendMessage, handleAddNewNodeFromAnswer, setNodesLocal, setEdgesLocal, isFlowStorageLoaded, deleteNode, nodesLocal]);

  // Track if we've loaded flow data from database
  const hasLoadedFlowDataRef = useRef(false);
  const hasRestoredFromSavedNodes = useRef(false);
  const restoredFromSavedNodesTimestamp = useRef(0);

  // Get Liveblocks storage directly to check if data exists
  const flowNodesStorage = useStorage((root) => root?.flowNodes);
  const flowEdgesStorage = useStorage((root) => root?.flowEdges);

  // Load flow data from database on mount - but ONLY if Liveblocks is empty
  useEffect(() => {
    // Don't initialize until sendMessage is available
    if (!wrappedSendMessage || hasLoadedFlowDataRef.current || !isFlowStorageLoaded) {
      return;
    }

    async function initializeFlow() {
      hasLoadedFlowDataRef.current = true;

      // Check if Liveblocks already has data (from another user)
      let liveblocksHasData = false;
      if (flowNodesStorage && flowEdgesStorage) {
        // Check if there are any nodes for this chat in Liveblocks
        flowNodesStorage.forEach((node) => {
          if (node.chatId === chatId) {
            liveblocksHasData = true;
          }
        });
      }

      // If Liveblocks already has data, don't load from database
      // Liveblocks is the source of truth for real-time collaboration
      if (liveblocksHasData) {
        console.log('Liveblocks already has data, skipping database load');
        // Mark messages as processed to avoid duplicate processing
        lastProcessedMessageCount.current = messages.length;

        // Restore tracking maps from Liveblocks nodes
        const liveblocksNodes: Node[] = [];
        flowNodesStorage?.forEach((liveNode) => {
          if (liveNode.chatId === chatId) {
            liveblocksNodes.push({
              id: liveNode.id,
              type: liveNode.type,
              position: liveNode.position,
              data: liveNode.data,
            });
          }
        });

        liveblocksNodes.forEach(node => {
          if (node.type === 'answerNode') {
            const nodeData = node.data as AnswerNodeData;
            if (nodeData.userMessage) {
              nodeToMessageMap.current.set(node.id, nodeData.userMessage.id);
              transformedUserMessages.current.add(nodeData.userMessage.id);
            }
          }
          nodePositionsRef.current.set(node.id, node.position);
        });

        setIsInitialized(true);
        return;
      }

      // Liveblocks is empty, load from database (first user)
      const { nodes: savedNodes, edges: savedEdges } = await loadFlowData(chatId);

      if (savedNodes.length > 0) {
        console.log('First user - loading saved nodes from database:', savedNodes.length, 'nodes');
        console.log('Saved node types:', savedNodes.map(n => ({ id: n.id, type: n.type })));

        // We have saved nodes, mark that we're restoring from saved state
        hasRestoredFromSavedNodes.current = true;
        restoredFromSavedNodesTimestamp.current = Date.now();

        // Restore proper data properties for prompt and answer nodes
        const restoredNodes: FlowNode[] = savedNodes.map(node => {
          if (node.type === 'promptNode') {
            return {
              ...node,
              data: {
                ...node.data,
                sendMessage: wrappedSendMessage,
                status: 'ready' as const, // Always set to 'ready' for restored prompt nodes
                onCancel: () => {
                  setNodesLocal((nds: any) => nds.filter((n: any) => n.id !== node.id));
                  setEdgesLocal((eds: any) =>
                    eds.filter((e: any) => e.source !== node.id && e.target !== node.id)
                  );
                  if (isFlowStorageLoaded && deleteNode) {
                    deleteNode(node.id);
                  }
                  nodePositionsRef.current.delete(node.id);
                },
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

        console.log('Restored nodes set locally:', restoredNodes.map(n => ({ id: n.id, type: n.type })));

        // Check if we need to add a prompt node for continuing the conversation
        // Only add if the last node is an answer node with both user and assistant messages
        const lastNode = restoredNodes[restoredNodes.length - 1];
        if (lastNode && lastNode.type === 'answerNode') {
          const answerData = lastNode.data as AnswerNodeData;
          // If the answer node has both messages and is not loading, user might want to continue
          if (answerData.userMessage && answerData.assistantMessage && !answerData.isLoading) {
            console.log('Last node is complete answer node, ready for follow-up');
            // Don't auto-add prompt node - let user click "Add Follow-up" button
          }
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

        // Mark all current messages as processed since we're loading from saved state
        lastProcessedMessageCount.current = messages.length;

        // Immediately sync to Liveblocks if storage is ready, otherwise wait a bit
        if (isFlowStorageLoaded && addNode && addEdge) {
          // Clear any existing Liveblocks data first by not adding anything
          // Then add our restored nodes
          restoredNodes.forEach(node => addNode(node));
          savedEdges.forEach(edge => addEdge(edge));
        } else {
          // If storage isn't loaded yet, wait and retry
          const retryInterval = setInterval(() => {
            if (isFlowStorageLoaded && addNode && addEdge) {
              restoredNodes.forEach(node => addNode(node));
              savedEdges.forEach(edge => addEdge(edge));
              clearInterval(retryInterval);
            }
          }, 100);

          // Clear interval after 2 seconds to prevent memory leak
          setTimeout(() => clearInterval(retryInterval), 2000);
        }
      } else {
        // No saved nodes (or only prompt nodes which we don't save)
        // Check if we need to add a new prompt node or reconstruct from messages

        if (messages.length === 0) {
          // New chat - add initial prompt node
          const initialPromptNode = {
            id: 'prompt-initial',
            type: 'promptNode' as const,
            position: { x: 100, y: 300 },
            data: {
              sendMessage: wrappedSendMessage,
              status: 'ready' as const,
              creatorId: stableUserId,
              creatorName: userName,
              creatorColor: userColor,
              onCancel: undefined,
            },
            draggable: true,
          };
          //@ts-ignore
          setNodesLocal([initialPromptNode]);
          setEdgesLocal([]);
          lastProcessedMessageCount.current = 0;
        } else {
          // Messages exist but no saved answer nodes yet
          // This can happen if messages are still being processed
          // Don't create any initial node - let the message processing effect handle it
          lastProcessedMessageCount.current = 0;
          setNodesLocal([]);
          setEdgesLocal([]);
        }
      }

      setIsInitialized(true);
    }

    initializeFlow();
  }, [chatId, wrappedSendMessage, status, isFlowStorageLoaded, addNode, addEdge, setNodesLocal, setEdgesLocal, messages.length, deleteNode, flowNodesStorage, flowEdgesStorage, stableUserId, userName, userColor]);

  // Debounced save to database
  const debouncedSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      // Filter out prompt nodes that haven't been transformed to answer nodes yet
      // Only save answer nodes to prevent the issue with prompt nodes being loaded back
      const nodesToSave = nodesLocal.filter((node: any) => {
        // Save answer nodes
        if (node.type === 'answerNode') return true;
        // Don't save prompt nodes - they should only be saved after becoming answer nodes
        if (node.type === 'promptNode') {
          console.log('Skipping save for prompt node:', node.id);
          return false;
        }
        // Save other node types if any
        return true;
      });

      // Always use the current chatId which is passed in as prop
      // Don't save empty nodes/edges
      if (nodesToSave.length > 0) {
        await saveFlowData({
          chatId: chatId,
          nodes: nodesToSave,
          edges: edgesLocal
        });
        console.log('Saved flow data for chat:', chatId, 'Nodes:', nodesToSave.length, 'Edges:', edgesLocal.length);

        // Log node types for debugging
        const nodeTypes = nodesToSave.map(n => ({ id: n.id, type: n.type }));
        console.log('Node types saved:', nodeTypes);
      }
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
        if (node.type === 'promptNode' || node.type === 'answerNode') {
          nodePositionsRef.current.set(node.id, node.position);
        }
      });
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [nodesLocal]);



  const lastProcessedMessageCount = useRef(0);

  // Handle message changes - only process NEW messages
  useEffect(() => {
    if (!isInitialized || !wrappedSendMessage) return;

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
            const updatedNodes = currentNodes.map((n: any) => {
              if (n.id === availablePromptNode.id) {
                return {
                  ...n,
                  type: 'answerNode',
                  data: {
                    userMessage: message,
                    assistantMessage: undefined,
                    isLoading: true,
                    onAddNewNode: handleAddNewNodeFromAnswer,
                    creatorId: stableUserId,
                    creatorName: userName,
                    creatorColor: userColor,
                  } as AnswerNodeData,
                };
              }
              return n;
            });

            // Save the transformation to database immediately
            // Now that it's an answer node, we can save it
            setTimeout(() => {
              // Filter to only save answer nodes (no prompt nodes)
              const nodesToSave = updatedNodes.filter((n: any) => n.type === 'answerNode');
              saveFlowData({
                chatId,
                nodes: nodesToSave,
                edges: edgesLocalRef.current
              });
              console.log('Saved prompt->answer transformation for node:', availablePromptNode.id);
              console.log('Total answer nodes saved:', nodesToSave.length);
            }, 100);

            return updatedNodes;
          });
        } else if (nodesLocalRef.current.length === 0) {
          // No nodes exist yet but we have a user message - create answer node directly
          // This happens when loading a chat that has messages but no saved nodes yet
          const nodeId = `answer-${message.id}`;

          // Mark as processed
          transformedUserMessages.current.add(message.id);
          nodeToMessageMap.current.set(nodeId, message.id);

          // Find if there's a corresponding assistant message
          const messageIndex = messages.indexOf(message);
          const assistantMessage = messages[messageIndex + 1]?.role === 'assistant' ? messages[messageIndex + 1] : undefined;

          const newAnswerNode: FlowNode = {
            id: nodeId,
            type: 'answerNode',
            position: { x: 100, y: 300 },
            data: {
              userMessage: message,
              assistantMessage: assistantMessage,
              isLoading: !assistantMessage,
              onAddNewNode: handleAddNewNodeFromAnswer,
              creatorId: stableUserId,
              creatorName: userName,
              creatorColor: userColor,
            } as AnswerNodeData,
            draggable: true,
          };

          setNodesLocal([newAnswerNode]);

          // Save immediately
          setTimeout(() => {
            saveFlowData({
              chatId,
              nodes: [newAnswerNode],
              edges: []
            });
            console.log('Created and saved answer node from existing messages');
          }, 100);
        }
      } else if (message.role === 'assistant') {
        console.log('🤖 Processing assistant message:', message);

        // Find the user message this is responding to
        const messageIndex = messages.indexOf(message);
        const userMessageIndex = messageIndex - 1;

        if (userMessageIndex >= 0 && messages[userMessageIndex]?.role === 'user') {
          const userMessage = messages[userMessageIndex];
          console.log('👤 Found corresponding user message:', userMessage);

          // Update the answer node with the assistant response
          setNodesLocal((currentNodes: any) => {
            const updatedNodes = currentNodes.map((n: any) => {
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

            // Save the assistant response to database immediately
            setTimeout(() => {
              // Filter to only save answer nodes (no prompt nodes)
              const nodesToSave = updatedNodes.filter((n: any) => n.type === 'answerNode');
              saveFlowData({
                chatId,
                nodes: nodesToSave,
                edges: edgesLocalRef.current
              });
              console.log('Saved assistant response to answer node');
              console.log('Total answer nodes saved:', nodesToSave.length);
            }, 100);

            return updatedNodes;
          });
        }
      }
    });

    // Update the last processed count
    lastProcessedMessageCount.current = messages.length;

  }, [messages, isInitialized, wrappedSendMessage, setNodesLocal, handleAddNewNodeFromAnswer, chatId, stableUserId, userName, userColor]);

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
            sendMessage: wrappedSendMessage,
            status: 'ready' as const, // Set to 'ready' to allow input
            parentNodeId: connectingNodeId,
            onCancel: () => {
              setNodesLocal((nds: any) => nds.filter((n: any) => n.id !== id));
              setEdgesLocal((eds: any) =>
                eds.filter((e: any) => e.source !== connectingNodeId || e.target !== id)
              );
              // Only delete from storage if it's loaded
              if (isFlowStorageLoaded && deleteNode) {
                deleteNode(id);
              }
              nodePositionsRef.current.delete(id);
            },
          },
          draggable: true,
        };

        setNodesLocal((nds: any) => nds.concat(newNode));

        // Create edge connecting parent to child with user's color
        const newEdge = {
          id: `edge-${connectingNodeId}-${id}`,
          source: connectingNodeId,
          target: id,
          type: 'smoothstep',
          style: {
            stroke: userColor || 'hsl(var(--primary))', // Use user's color or fallback
            strokeWidth: 2,
            strokeDasharray: '5,5',
          },
        };

        setEdgesLocal((eds: any) => eds.concat(newEdge));

        // Sync to Liveblocks (only if storage is loaded)
        if (isFlowStorageLoaded && addNode && addEdge) {
          addNode(newNode);
          addEdge(newEdge);
        }
      }

      setConnectingNodeId(null);
    },
    [connectingNodeId, screenToFlowPosition, wrappedSendMessage, status, setNodesLocal, setEdgesLocal, isFlowStorageLoaded, addNode, deleteNode, addEdge]
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
        style: {
          stroke: userColor || 'hsl(var(--primary))',
          strokeWidth: 2,
        },
      };

      // Only sync to Liveblocks if storage is loaded
      if (isFlowStorageLoaded && addEdge) {
        addEdge(newEdge);
      }
    },
    [isFlowStorageLoaded, addEdge, userColor]
  );

  // Auto-layout function using dagre
  const [showLayoutMenu, setShowLayoutMenu] = useState(false);

  const autoLayout = useCallback((layoutType: 'horizontal' | 'vertical' | 'radial' | 'tree' = 'horizontal') => {
    let layouted;

    if (layoutType === 'radial') {
      layouted = getRadialLayout<FlowNodeData>(nodesLocal as FlowNode[], edgesLocal);
    } else if (layoutType === 'tree') {
      layouted = getTreeLayout<FlowNodeData>(nodesLocal as FlowNode[], edgesLocal, 'vertical');
    } else {
      const direction = layoutType === 'horizontal' ? 'LR' : 'TB';
      layouted = getLayoutedElements<FlowNodeData>(nodesLocal as FlowNode[], edgesLocal, direction, layoutType);
    }

    setNodesLocal(layouted.nodes as FlowNode[]);
    setEdgesLocal(layouted.edges);

    // Update position refs
    layouted.nodes.forEach(node => {
      nodePositionsRef.current.set(node.id, node.position);
    });

    setShowLayoutMenu(false);

    // Save to database after layout
    debouncedSave();
  }, [nodesLocal, edgesLocal, setNodesLocal, setEdgesLocal, debouncedSave]);

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
        defaultEdgeOptions={{
          type: 'smoothstep',
          animated: false,
          style: {
            stroke: 'rgb(148 163 184 / 0.3)',
            strokeWidth: 2,
          },
        }}
        connectionLineStyle={{
          stroke: 'rgb(148 163 184 / 0.3)',
          strokeWidth: 2,
        }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={16}
          size={0.5}
          className="opacity-[0.02] dark:opacity-[0.03]"
          color="rgb(156 163 175)"
        />

        {/* Collaborator list showing active users and their colors */}
        <CollaboratorList />

        {/* Minimal custom controls */}
        <div className="absolute right-3 bottom-3 z-10 flex flex-col gap-1">
          <button
            onClick={() => zoomIn()}
            className="rounded border border-gray-200 bg-white p-1 text-gray-500 hover:text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
            aria-label="Zoom in"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
              <line x1="6" y1="3" x2="6" y2="9" />
              <line x1="3" y1="6" x2="9" y2="6" />
            </svg>
          </button>
          <button
            onClick={() => zoomOut()}
            className="rounded border border-gray-200 bg-white p-1 text-gray-500 hover:text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
            aria-label="Zoom out"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
              <line x1="3" y1="6" x2="9" y2="6" />
            </svg>
          </button>
        </div>

        {/* Auto-layout dropdown menu */}
        <div className="absolute left-3 bottom-3 z-10">
          <div className="relative">
            <button
              onClick={() => setShowLayoutMenu(!showLayoutMenu)}
              className="flex items-center gap-1 rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-500 hover:text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="1" y="1" width="3" height="3" />
                <rect x="8" y="1" width="3" height="3" />
                <rect x="1" y="8" width="3" height="3" />
                <rect x="8" y="8" width="3" height="3" />
                <line x1="4" y1="2.5" x2="8" y2="2.5" />
                <line x1="4" y1="9.5" x2="8" y2="9.5" />
                <line x1="2.5" y1="4" x2="2.5" y2="8" />
                <line x1="9.5" y1="4" x2="9.5" y2="8" />
              </svg>
              Auto Layout
            </button>

            {showLayoutMenu && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute bottom-full left-0 mb-2 overflow-hidden rounded border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900"
              >
                <button
                  onClick={() => autoLayout('horizontal')}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <span className="text-gray-600 dark:text-gray-400">→</span>
                  Horizontal Flow
                </button>
                <button
                  onClick={() => autoLayout('vertical')}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <span className="text-gray-600 dark:text-gray-400">↓</span>
                  Vertical Flow
                </button>
                <button
                  onClick={() => autoLayout('tree')}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <span className="text-gray-600 dark:text-gray-400">🌳</span>
                  Tree Layout
                </button>
                <button
                  onClick={() => autoLayout('radial')}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <span className="text-gray-600 dark:text-gray-400">⭕</span>
                  Radial Layout
                </button>
              </motion.div>
            )}
          </div>
        </div>

        {/* Minimal minimap */}
        <MiniMap
          className="bg-white! border! border-gray-200! dark:bg-gray-900! dark:border-gray-700!"
          nodeColor={() => '#9ca3af'}
          nodeStrokeWidth={3}
          pannable
          zoomable
          style={{
            height: 80,
            width: 120,
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
  // Use a deterministic ID based on chatId to avoid hydration mismatches
  const userId = useMemo(() => `user-${props.chatId.substring(0, 8)}`, [props.chatId]); // TODO: Get actual user ID
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
