import { useCallback, useEffect, useRef, useState } from 'react';
import { type Node, type Edge, applyNodeChanges, applyEdgeChanges, type NodeChange, type EdgeChange } from '@xyflow/react';
import {
  useStorage,
  useMutation,
  useBroadcastEvent,
  useEventListener,
  useSelf
} from '@/liveblocks.config';
import type { LiveFlowNode, LiveFlowEdge, NodeLock } from '@/liveblocks.config';
import { LOCK_TIMEOUT_MS, isLockExpired, generateUserColor } from '@/liveblocks.config';
import { debounce } from '@/lib/utils';

interface UseRealtimeFlowProps {
  chatId: string;
  initialNodes?: Node[];
  initialEdges?: Edge[];
  onNodesChange?: (nodes: Node[]) => void;
  onEdgesChange?: (edges: Edge[]) => void;
}

export function useRealtimeFlow({
  chatId,
  initialNodes = [],
  initialEdges = [],
  onNodesChange,
  onEdgesChange,
}: UseRealtimeFlowProps) {
  const self = useSelf();
  const userId = self?.id || 'anonymous';
  const userName = self?.info?.name || 'Anonymous';
  const userColor = self?.info?.color || generateUserColor(userId);

  // Use state for reactive updates
  const [localNodes, setLocalNodes] = useState<Node[]>(initialNodes);
  const [localEdges, setLocalEdges] = useState<Edge[]>(initialEdges);

  // Keep refs for internal use
  const localNodesRef = useRef<Node[]>(initialNodes);
  const localEdgesRef = useRef<Edge[]>(initialEdges);

  // Track if we've already initialized storage
  const hasInitialized = useRef(false);

  // Get storage
  const flowNodes = useStorage((root) => root.flowNodes);
  // Use a shallow selector that creates a new array to force re-renders
  const flowEdges = useStorage((root) => {
    const edges = root.flowEdges;
    if (!edges) return null;
    // Force a new reference by converting to array and back to Map
    // This ensures React detects the change
    return new Map(edges.entries());
  });
  const nodeLocks = useStorage((root) => root.nodeLocks);

  const broadcastEvent = useBroadcastEvent();

  // Initialize storage with initial data if empty - prevent duplicates
  const initializeStorage = useMutation(({ storage }, nodes: Node[], edges: Edge[]) => {
    const flowNodesMap = storage.get('flowNodes');
    const flowEdgesMap = storage.get('flowEdges');

    // Check if there's already data for this chat
    let hasExistingData = false;
    flowNodesMap.forEach((node) => {
      if (node.chatId === chatId) {
        hasExistingData = true;
      }
    });

    // Only initialize if truly empty for this chat
    if (!hasExistingData && nodes.length > 0) {
      console.log('🎯 Initializing storage with', nodes.length, 'nodes for chat:', chatId);
      nodes.forEach(node => {
        const liveNode: LiveFlowNode = {
          id: node.id,
          type: node.type || 'default',
          position: node.position,
          data: node.data,
          chatId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        flowNodesMap.set(node.id, liveNode);
        console.log('  Added node to initial storage:', node.id, node.type);
      });
    }

    // Check edges similarly
    let hasExistingEdges = false;
    flowEdgesMap.forEach((edge) => {
      if (edge.chatId === chatId) {
        hasExistingEdges = true;
      }
    });

    if (!hasExistingEdges && edges.length > 0) {
      edges.forEach(edge => {
        const liveEdge: LiveFlowEdge = {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          type: edge.type,
          animated: edge.animated,
          style: edge.style,
          chatId,
          createdAt: new Date().toISOString(),
          creatorId: userId,
          creatorColor: userColor,
        };
        flowEdgesMap.set(edge.id, liveEdge);
      });
    }
  }, [chatId, userId, userColor]);

  // Track last synced nodes to avoid unnecessary updates
  const lastSyncedNodesRef = useRef<string>('');

  // Sync nodes from storage to local state
  useEffect(() => {
    if (!flowNodes) return;

    console.log('🔄 Syncing nodes from Liveblocks to local state');
    const nodes: Node[] = [];
    flowNodes.forEach((liveNode) => {
      if (liveNode.chatId === chatId) {
        console.log('  Found node in Liveblocks:', liveNode.id, liveNode.type);
        // Find existing local node to preserve other properties
        const existingNode = localNodesRef.current.find(n => n.id === liveNode.id);
        if (existingNode) {
          // Preserve functions and update data from Liveblocks
          const preservedData = {
            ...liveNode.data,
            // Preserve functions that can't be serialized
            ...(existingNode.data && typeof existingNode.data === 'object' ? {
              onCancel: (existingNode.data as any).onCancel,
              sendMessage: (existingNode.data as any).sendMessage,
              onAddNewNode: (existingNode.data as any).onAddNewNode,
            } : {}),
          };

          nodes.push({
            ...existingNode,
            type: liveNode.type, // Update type in case of transformation
            position: liveNode.position,
            data: preservedData,
          });
        } else {
          // New node, add it completely
          // For prompt nodes, we need to reconstruct the onCancel function
          // since functions can't be serialized in Liveblocks
          const nodeData = liveNode.type === 'promptNode'
            ? {
                ...liveNode.data,
                onCancel: undefined, // This will be added by the parent component
                sendMessage: undefined, // This will be added by the parent component
              }
            : liveNode.type === 'answerNode'
            ? {
                ...liveNode.data,
                onAddNewNode: undefined, // This will be added by the parent component
              }
            : liveNode.data;

          nodes.push({
            id: liveNode.id,
            type: liveNode.type,
            position: liveNode.position,
            data: nodeData,
          });
        }
      }
    });

    // Check if nodes have actually changed
    const nodesString = JSON.stringify(nodes.map(n => ({
      id: n.id,
      type: n.type, // Include type in comparison
      position: n.position,
      data: n.data
    })));
    if (nodesString !== lastSyncedNodesRef.current) {
      console.log('🔄 Nodes changed, updating local state with', nodes.length, 'nodes');
      console.log('  Node types:', nodes.map(n => ({ id: n.id, type: n.type })));
      lastSyncedNodesRef.current = nodesString;
      localNodesRef.current = nodes;
      setLocalNodes(nodes);
      onNodesChange?.(nodes);
    } else {
      console.log('⏸️  No node changes detected, skipping update');
    }
  }, [flowNodes, chatId, onNodesChange]);

  // Track last synced edges to avoid unnecessary updates
  const lastSyncedEdgesRef = useRef<string>('');

  // Sync edges from storage to local state
  const syncEdgesFromStorage = useCallback(() => {
    if (!flowEdges) return;

    console.log('🔄 Syncing edges from Liveblocks to local state for chat:', chatId);
    const edges: Edge[] = [];
    let totalEdgesInStorage = 0;
    flowEdges.forEach((liveEdge) => {
      totalEdgesInStorage++;
      if (liveEdge.chatId === chatId) {
        console.log('  ✅ Found edge for this chat:', liveEdge.id, 'from', liveEdge.source, 'to', liveEdge.target, 'style:', liveEdge.style);
        // Use the style as-is from Liveblocks (it includes color, strokeDasharray, etc.)
        edges.push({
          id: liveEdge.id,
          source: liveEdge.source,
          target: liveEdge.target,
          type: liveEdge.type || 'smoothstep',
          animated: liveEdge.animated,
          style: liveEdge.style || {}, // Use the full style from Liveblocks
          data: {
            creatorId: liveEdge.creatorId,
            creatorColor: liveEdge.creatorColor,
          },
        });
      }
    });

    console.log(`📊 Total edges in storage: ${totalEdgesInStorage}, Edges for this chat: ${edges.length}`);

    // Always update if we have a different number of edges
    if (edges.length !== localEdgesRef.current.length) {
      console.log('🔄 Edge count changed, updating local state');
      localEdgesRef.current = edges;
      setLocalEdges(edges);
      onEdgesChange?.(edges);
      lastSyncedEdgesRef.current = JSON.stringify(edges);
    } else {
      // Check if edges have actually changed
      const edgesString = JSON.stringify(edges);
      if (edgesString !== lastSyncedEdgesRef.current) {
        console.log('🔄 Edge data changed, updating local state');
        lastSyncedEdgesRef.current = edgesString;
        localEdgesRef.current = edges;
        setLocalEdges(edges);
        onEdgesChange?.(edges);
      } else {
        console.log('⏸️  No edge changes detected');
      }
    }
  }, [flowEdges, chatId, onEdgesChange]);

  // Sync edges when storage changes
  useEffect(() => {
    syncEdgesFromStorage();
  }, [syncEdgesFromStorage]);

  // Periodic edge sync as fallback (every 2 seconds)
  useEffect(() => {
    if (!flowEdges) return;

    const interval = setInterval(() => {
      console.log('⏰ Periodic edge sync check');
      syncEdgesFromStorage();
    }, 2000);

    return () => clearInterval(interval);
  }, [flowEdges, syncEdgesFromStorage]);

  // Listen for edge-added broadcast events
  useEventListener(({ event }) => {
    if (event.type === 'edge-added' && event.chatId === chatId && event.userId !== userId) {
      console.log('📡 Received edge-added event from another user, syncing edges');
      // Force a re-sync of edges
      setTimeout(() => {
        syncEdgesFromStorage();
      }, 100); // Small delay to ensure storage is updated
    }
  });

  // Check if storage is loaded
  const isStorageLoaded = flowNodes !== null && flowEdges !== null && nodeLocks !== null;

  // Initialize storage on mount (only after storage is loaded)
  // We use refs to capture initial values to avoid dependency issues
  const initialNodesRef = useRef(initialNodes);
  const initialEdgesRef = useRef(initialEdges);

  useEffect(() => {
    if (!isStorageLoaded || hasInitialized.current) return;

    const nodes = initialNodesRef.current;
    const edges = initialEdgesRef.current;

    if (nodes.length > 0 || edges.length > 0) {
      initializeStorage(nodes, edges);
      hasInitialized.current = true;
    }
  }, [isStorageLoaded, initializeStorage]); // Only depend on storage loaded state

  // Update nodes in storage
  const updateNodes = useMutation(({ storage }, changes: NodeChange[]) => {
    try {
      const flowNodesMap = storage.get('flowNodes');
      if (!flowNodesMap) return;

      console.log('📝 Updating nodes in Liveblocks:', changes);
      const updatedNodes = applyNodeChanges(changes, localNodesRef.current);

    updatedNodes.forEach(node => {
      const existingNode = flowNodesMap.get(node.id);
      const liveNode: LiveFlowNode = {
        id: node.id,
        type: node.type || 'default',
        position: node.position,
        data: node.data,
        parentNodeId: existingNode?.parentNodeId,
        chatId,
        createdAt: existingNode?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      flowNodesMap.set(node.id, liveNode);
      console.log('  Updated node:', node.id, 'type:', node.type);
    });

    // Remove deleted nodes
    const nodeIds = new Set(updatedNodes.map(n => n.id));
    Array.from(flowNodesMap.keys()).forEach(id => {
      const node = flowNodesMap.get(id);
      if (node?.chatId === chatId && !nodeIds.has(id)) {
        flowNodesMap.delete(id);
      }
    });

    localNodesRef.current = updatedNodes;
    } catch (error) {
      console.warn('Storage not ready for updateNodes:', error);
    }
  }, [chatId]);

  // Debounced node position update - optimized for responsiveness
  const debouncedUpdateNodePosition = useRef(
    debounce((nodeId: string, position: { x: number; y: number }) => {
      try {
        updateNodePosition(nodeId, position);
      } catch (error) {
        console.warn('Storage not ready for position update:', error);
      }
    }, 50) // Much faster updates for responsive feel
  ).current;

  // Update single node position
  const updateNodePosition = useMutation(({ storage }, nodeId: string, position: { x: number; y: number }) => {
    try {
      const flowNodesMap = storage.get('flowNodes');
      if (!flowNodesMap) return;

      const node = flowNodesMap.get(nodeId);
      if (node && node.chatId === chatId) {
        // Always update position for immediate responsiveness
        node.position = position;
        node.updatedAt = new Date().toISOString();
        flowNodesMap.set(nodeId, node);
      }
    } catch (error) {
      console.warn('Storage not ready for updateNodePosition:', error);
    }
  }, [chatId]);

  // Update edges in storage
  const updateEdges = useMutation(({ storage }, changes: EdgeChange[]) => {
    try {
      const flowEdgesMap = storage.get('flowEdges');
      if (!flowEdgesMap) return;

      const updatedEdges = applyEdgeChanges(changes, localEdgesRef.current);

      updatedEdges.forEach(edge => {
        const existingEdge = flowEdgesMap.get(edge.id);

        // Only update edges that belong to this chat
        if (existingEdge && existingEdge.chatId !== chatId) {
          console.warn('⚠️ Skipping edge update - belongs to different chat:', edge.id);
          return;
        }

        const liveEdge: LiveFlowEdge = {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          type: edge.type || 'smoothstep',
          animated: edge.animated,
          style: (edge as any).style || {},
          chatId, // Always use the current chatId
          createdAt: existingEdge?.createdAt || new Date().toISOString(),
          creatorId: existingEdge?.creatorId || userId,
          creatorColor: existingEdge?.creatorColor || userColor,
        };
        flowEdgesMap.set(edge.id, liveEdge);
        console.log('📝 Updated edge in Liveblocks:', edge.id);
      });

    // Remove deleted edges
    const edgeIds = new Set(updatedEdges.map(e => e.id));
    Array.from(flowEdgesMap.keys()).forEach(id => {
      const edge = flowEdgesMap.get(id);
      if (edge?.chatId === chatId && !edgeIds.has(id)) {
        flowEdgesMap.delete(id);
      }
    });

    localEdgesRef.current = updatedEdges;
    } catch (error) {
      console.warn('Storage not ready for updateEdges:', error);
    }
  }, [chatId, userId, userColor]);

  // Add new node - prevent duplicates
  const addNode = useMutation(({ storage }, node: Node) => {
    try {
      const flowNodesMap = storage.get('flowNodes');
      if (!flowNodesMap) {
        console.error('❌ flowNodesMap is null, cannot add node');
        return;
      }

      // Check if node already exists
      if (flowNodesMap.has(node.id)) {
        console.log('Node already exists in Liveblocks, skipping add:', node.id);
        return;
      }

      console.log('✅ Adding node to Liveblocks:', node.id, node.type);
      const liveNode: LiveFlowNode = {
        id: node.id,
        type: node.type || 'default',
        position: node.position,
        data: node.data,
        chatId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      flowNodesMap.set(node.id, liveNode);
      console.log('✅ Node added successfully to Liveblocks');
    } catch (error) {
      console.warn('Storage not ready for addNode:', error);
    }
  }, [chatId]);

  // Add new edge - prevent duplicates
  const addEdge = useMutation(({ storage }, edge: Edge) => {
    try {
      const flowEdgesMap = storage.get('flowEdges');
      if (!flowEdgesMap) {
        console.error('❌ flowEdgesMap is null, cannot add edge');
        return;
      }

      // Check if edge already exists
      if (flowEdgesMap.has(edge.id)) {
        console.log('Edge already exists in Liveblocks, skipping add:', edge.id);
        return;
      }

      console.log('✅ Adding edge to Liveblocks:', edge.id, 'from', edge.source, 'to', edge.target, 'for chat:', chatId);

      // Get creator info from edge data if available, otherwise use current user
      const edgeData = (edge as any).data || {};
      const creatorId = edgeData.creatorId || userId;
      const creatorColor = edgeData.creatorColor || userColor;

      const liveEdge: LiveFlowEdge = {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: edge.type || 'smoothstep',
        animated: edge.animated,
        style: (edge as any).style || {}, // Preserve the original style completely
        chatId, // This is crucial - make sure chatId is set
        createdAt: new Date().toISOString(),
        creatorId,
        creatorColor,
      };
      flowEdgesMap.set(edge.id, liveEdge);
      console.log('✅ Edge added successfully to Liveblocks:', {
        id: liveEdge.id,
        chatId: liveEdge.chatId,
        style: liveEdge.style,
        creatorId: liveEdge.creatorId,
        creatorColor: liveEdge.creatorColor
      });

      // Broadcast the edge addition to notify other users
      broadcastEvent({
        type: 'edge-added',
        edgeId: edge.id,
        chatId: liveEdge.chatId,
        userId,
      });
    } catch (error) {
      console.warn('Storage not ready for addEdge:', error);
    }
  }, [chatId, userId, userColor, broadcastEvent]);

  // Update node data (for transformations and data updates)
  const updateNodeData = useMutation(({ storage }, nodeId: string, newData: any, newType?: string, nodePosition?: { x: number; y: number }) => {
    try {
      const flowNodesMap = storage.get('flowNodes');
      if (!flowNodesMap) {
        console.error('❌ flowNodesMap is null, cannot update node data');
        return;
      }

      const existingNode = flowNodesMap.get(nodeId);

      // If node doesn't exist in Liveblocks yet, we need to add it first
      if (!existingNode) {
        console.warn(`⚠️ Node ${nodeId} not found in Liveblocks, attempting to add it first`);

        // If we don't have position, we can't add the node
        if (!nodePosition) {
          console.error('❌ Cannot add node without position:', nodeId);
          return;
        }

        // Add the node to Liveblocks first
        const liveNode: LiveFlowNode = {
          id: nodeId,
          type: newType || 'default',
          position: nodePosition,
          data: newData,
          chatId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        flowNodesMap.set(nodeId, liveNode);
        console.log('✅ Node added to Liveblocks:', nodeId);

        // Broadcast the addition
        broadcastEvent({
          type: 'node-added',
          nodeId,
          nodeType: liveNode.type,
          userId,
        });
        return;
      }

      // Check if it's the wrong chat
      if (existingNode.chatId !== chatId) {
        console.error('❌ Node belongs to different chat:', nodeId);
        return;
      }

      console.log('🔄 Updating node data in Liveblocks:', nodeId, 'type:', newType || existingNode.type);

      // Update the node with new data and optionally new type
      const updatedNode: LiveFlowNode = {
        ...existingNode,
        type: newType || existingNode.type,
        data: newData,
        updatedAt: new Date().toISOString(),
      };

      flowNodesMap.set(nodeId, updatedNode);
      console.log('✅ Node data updated successfully in Liveblocks');

      // Broadcast the update for immediate notification
      if (newType && newType !== existingNode.type) {
        broadcastEvent({
          type: 'node-transformed',
          nodeId,
          fromType: existingNode.type,
          toType: newType,
          userId,
        });
      } else {
        broadcastEvent({
          type: 'node-data-updated',
          nodeId,
          userId,
        });
      }
    } catch (error) {
      console.warn('Storage not ready for updateNodeData:', error);
    }
  }, [chatId, userId]);

  // Delete node
  const deleteNode = useMutation(({ storage }, nodeId: string) => {
    try {
      const flowNodesMap = storage.get('flowNodes');
      const flowEdgesMap = storage.get('flowEdges');

      if (!flowNodesMap || !flowEdgesMap) {
        console.error('❌ Storage maps not available for node deletion');
        return;
      }

      console.log('🗑️ Deleting node from Liveblocks:', nodeId);
      // Delete the node
      flowNodesMap.delete(nodeId);

      // Delete connected edges
      let deletedEdges = 0;
      flowEdgesMap.forEach((edge, id) => {
        if (edge.source === nodeId || edge.target === nodeId) {
          flowEdgesMap.delete(id);
          deletedEdges++;
          console.log('  Also deleted connected edge:', id);
        }
      });
      console.log(`✅ Node ${nodeId} deleted, along with ${deletedEdges} connected edges`);
    } catch (error) {
      console.warn('Storage not ready for deleteNode:', error);
    }
  }, []);

  // Lock management
  const acquireLock = useMutation(({ storage }, nodeId: string): boolean => {
    const locks = storage.get('nodeLocks');
    const existingLock = locks.get(nodeId);

    // Check if lock exists and is not expired
    if (existingLock && !isLockExpired(existingLock) && existingLock.userId !== userId) {
      return false; // Lock is held by another user
    }

    // Acquire or renew lock
    const lock: NodeLock = {
      nodeId,
      userId,
      userName,
      lockedAt: Date.now(),
      expiresAt: Date.now() + LOCK_TIMEOUT_MS,
    };

    locks.set(nodeId, lock);
    broadcastEvent({ type: 'node-locked', nodeId, userId, userName });

    return true;
  }, [userId, userName]);

  const releaseLock = useMutation(({ storage }, nodeId: string) => {
    const locks = storage.get('nodeLocks');
    const lock = locks.get(nodeId);

    if (lock && lock.userId === userId) {
      locks.delete(nodeId);
      broadcastEvent({ type: 'node-unlocked', nodeId, userId });
    }
  }, [userId]);

  const renewLock = useMutation(({ storage }, nodeId: string): boolean => {
    const locks = storage.get('nodeLocks');
    const lock = locks.get(nodeId);

    if (lock && lock.userId === userId) {
      lock.expiresAt = Date.now() + LOCK_TIMEOUT_MS;
      locks.set(nodeId, lock);
      return true;
    }

    return false;
  }, [userId]);

  // Get lock info for a node
  const getNodeLock = useCallback((nodeId: string): NodeLock | null => {
    if (!nodeLocks) return null;
    const lock = nodeLocks.get(nodeId);
    return lock && !isLockExpired(lock) ? lock : null;
  }, [nodeLocks]);

  // Check if current user has lock
  const hasLock = useCallback((nodeId: string): boolean => {
    const lock = getNodeLock(nodeId);
    return lock?.userId === userId;
  }, [getNodeLock, userId]);

  // Clean up expired locks periodically
  const cleanupExpiredLocks = useMutation(({ storage }) => {
    const locks = storage.get('nodeLocks');
    const now = Date.now();

    locks.forEach((lock, nodeId) => {
      if (lock.expiresAt < now) {
        locks.delete(nodeId);
        broadcastEvent({ type: 'node-unlocked', nodeId, userId: lock.userId });
      }
    });
  }, []);

  // Cleanup expired locks every minute
  useEffect(() => {
    const interval = setInterval(() => {
      cleanupExpiredLocks();
    }, 60000);

    return () => clearInterval(interval);
  }, [cleanupExpiredLocks]);

  // Listen for lock events and node updates
  useEventListener(({ event }) => {
    if (event.type === 'node-locked' || event.type === 'node-unlocked') {
      // Force re-render to update lock UI
      onNodesChange?.(localNodesRef.current);
    } else if (event.type === 'node-transformed' || event.type === 'node-data-updated') {
      // Log the event for debugging
      console.log('📡 Received broadcast event:', event.type, 'for node:', (event as any).nodeId);
      // The storage subscription should handle the update, but we log for debugging
    }
  });

  return {
    // Storage status
    isStorageLoaded,

    // Node operations
    updateNodes,
    updateNodePosition: debouncedUpdateNodePosition,
    updateNodeData,
    addNode,
    deleteNode,

    // Edge operations
    updateEdges,
    addEdge,

    // Lock management
    acquireLock,
    releaseLock,
    renewLock,
    getNodeLock,
    hasLock,

    // Current state (return state for reactivity)
    nodes: localNodes,
    edges: localEdges,
  };
}