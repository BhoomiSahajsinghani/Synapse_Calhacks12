'use client';

import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
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
  type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ConversationNode } from './conversation-node';
import { PromptNode } from './prompt-node';
import { messagesToNodesAndEdges } from './utils';
import type { ChatMessage } from '@/lib/types';
import type { UseChatHelpers } from '@ai-sdk/react';
import { loadFlowData, saveFlowData } from '@/lib/db/flow-actions';
import { useTheme } from 'next-themes';

interface ChatFlowProps {
  chatId: string;
  messages: ChatMessage[];
  status: UseChatHelpers<ChatMessage>['status'];
  sendMessage: UseChatHelpers<ChatMessage>['sendMessage'];
}

const nodeTypes: NodeTypes = {
  conversationNode: ConversationNode,
  promptNode: PromptNode,
};

function ChatFlowInner({ chatId, messages, status, sendMessage }: ChatFlowProps) {
  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => messagesToNodesAndEdges(messages, status),
    [messages, status]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [connectingNodeId, setConnectingNodeId] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const { screenToFlowPosition } = useReactFlow();

  const { theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Handle mounting to avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Determine the current theme
  const currentTheme = theme === 'system' ? resolvedTheme : theme;

  // Track node positions to preserve them
  const nodePositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const previousMessageCountRef = useRef(messages.length);
  const saveTimeoutRef = useRef<NodeJS.Timeout>();

  // Load flow data from database on mount
  useEffect(() => {
    async function initializeFlow() {
      const { nodes: savedNodes, edges: savedEdges } = await loadFlowData(chatId);

      if (savedNodes.length > 0) {
        // Restore proper data properties for prompt nodes
        const restoredNodes = savedNodes.map(node => {
          if (node.type === 'promptNode') {
            return {
              ...node,
              data: {
                ...node.data,
                sendMessage,
                status,
                onCancel: (node.data as any).onCancel,
              },
            };
          }
          return node;
        });

        setNodes(restoredNodes);
        setEdges(savedEdges);

        // Save positions to ref
        restoredNodes.forEach(node => {
          nodePositionsRef.current.set(node.id, node.position);
        });
      }

      setIsInitialized(true);
    }

    initializeFlow();
  }, [chatId, sendMessage, status, setNodes, setEdges]);

  // Debounced save to database
  const debouncedSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      await saveFlowData({ chatId, nodes, edges });
    }, 1000); // Save 1 second after last change
  }, [chatId, nodes, edges]);

  // Save when nodes or edges change
  useEffect(() => {
    if (!isInitialized) return;
    debouncedSave();

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [nodes, edges, isInitialized, debouncedSave]);

  // Save positions whenever nodes change
  useEffect(() => {
    nodes.forEach(node => {
      if (node.type === 'promptNode' || node.type === 'conversationNode') {
        nodePositionsRef.current.set(node.id, node.position);
      }
    });
  }, [nodes]);

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
      const hasPromptNode = nodes.some(n => n.type === 'promptNode');
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
        setNodes([initialPromptNode]);
        setEdges([]);
      }
      previousMessageCountRef.current = 0;
      return;
    }

    // Check if a new message was just added
    const messageCountIncreased = messages.length > previousMessageCountRef.current;

    // Find any prompt nodes in current view
    const currentPromptNodes = nodes.filter(n => n.type === 'promptNode');

    // Only update if messages changed or we don't have the right conversation nodes
    const currentConversationIds = nodes.filter(n => n.type === 'conversationNode').map(n => n.id);
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

        setEdges((eds) => {
          // Remove the edge from parent to prompt node
          const filtered = eds.filter(
            (e) => !(e.source === parentNodeId && e.target === submittedPromptNode.id)
          );
          return [...filtered, ...newEdges, parentToConversationEdge];
        });
      } else {
        // No parent - just use the default edges from messagesToNodesAndEdges
        setEdges(newEdges);
      }

      // Update nodes: conversation nodes + remaining prompt nodes (excluding submitted one)
      setNodes([...nodesWithPositions, ...remainingPromptNodes]);
      return;
    }

    // No new messages - keep all nodes as is
    const promptNodesToKeep = nodes.filter(n => n.type === 'promptNode');
    setNodes([...nodesWithPositions, ...promptNodesToKeep]);
    setEdges(newEdges);
  }, [messages, status, sendMessage, nodes, setNodes, setEdges, isInitialized]);

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
              setNodes((nds) => nds.filter((n) => n.id !== id));
              setEdges((eds) =>
                eds.filter((e) => e.source !== connectingNodeId || e.target !== id)
              );
              nodePositionsRef.current.delete(id);
            },
          },
          draggable: true,
        };

        setNodes((nds) => nds.concat(newNode));

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

        setEdges((eds) => eds.concat(newEdge));
      }

      setConnectingNodeId(null);
    },
    [connectingNodeId, screenToFlowPosition, sendMessage, status, setNodes, setEdges]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge(connection, eds));
    },
    [setEdges]
  );

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
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
          key={`controls-${currentTheme}`}
          showInteractive={false}
          orientation='horizontal'
          className="rounded-md border shadow-lg backdrop-blur-sm"
          style={{background: 'rgba(26, 26, 26, 0.8)'}}
          // style={{
          //   backgroundColor: mounted ? (currentTheme === 'dark' ? 'rgba(26, 26, 26, 0.8)' : 'rgba(255, 255, 255, 0.8)') : 'rgba(255, 255, 255, 0.8)',
          //   borderColor: mounted ? (currentTheme === 'dark' ? '#333333' : '#e5e5e5') : '#e5e5e5',
          // }}
        />
        <MiniMap
          key={`minimap-${currentTheme}`}
          nodeStrokeWidth={3}
          className="rounded-md border bg-background/80 shadow-lg backdrop-blur-sm"
          pannable
          zoomable
          bgColor={mounted ? (currentTheme === 'dark' ? '#1a1a1a' : '#ffffff') : '#ffffff'}
          maskColor={mounted ? (currentTheme === 'dark' ? '#2a2a2a' : '#ebe8e8') : '#ebe8e8'}
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

export function ChatFlow(props: ChatFlowProps) {
  return (
    <ReactFlowProvider>
      <ChatFlowInner {...props} />
    </ReactFlowProvider>
  );
}
