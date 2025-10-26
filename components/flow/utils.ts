import type { Node, Edge } from '@xyflow/react';
import type { ChatMessage } from '@/lib/types';
import type { ConversationNodeData } from './conversation-node';
import type { PromptNodeData } from './prompt-node';

// Union type for all node data types
type FlowNodeData = ConversationNodeData | PromptNodeData;

export function messagesToNodesAndEdges(
  messages: ChatMessage[],
  status?: string
): { nodes: Node<FlowNodeData>[]; edges: Edge[] } {
  const nodes: Node<FlowNodeData>[] = [];
  const edges: Edge[] = [];

  // Vertical spacing between nodes
  const VERTICAL_SPACING = 280;
  const HORIZONTAL_CENTER = 300;

  // Group messages into conversation pairs (user + assistant)
  const conversations: Array<{
    userMessage: ChatMessage;
    assistantMessage?: ChatMessage;
  }> = [];

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    if (message.role === 'user') {
      const nextMessage = messages[i + 1];
      conversations.push({
        userMessage: message,
        assistantMessage: nextMessage?.role === 'assistant' ? nextMessage : undefined,
      });
      // Skip the next message if it's the assistant response
      if (nextMessage?.role === 'assistant') {
        i++;
      }
    }
  }

  // Create conversation nodes
  conversations.forEach((conversation, index) => {
    const nodeId = `conversation-${conversation.userMessage.id}`;
    const isLastConversation = index === conversations.length - 1;
    const isLoading = status === 'streaming' && isLastConversation && !conversation.assistantMessage;

    nodes.push({
      id: nodeId,
      type: 'conversationNode',
      position: {
        x: HORIZONTAL_CENTER,
        y: index * VERTICAL_SPACING,
      },
      data: {
        userMessage: conversation.userMessage,
        assistantMessage: conversation.assistantMessage,
        isLoading,
      } as ConversationNodeData,
      draggable: true,
    });

    // Create edge connecting to previous conversation
    if (index > 0) {
      const previousNodeId = `conversation-${conversations[index - 1].userMessage.id}`;
      edges.push({
        id: `edge-${previousNodeId}-${nodeId}`,
        source: previousNodeId,
        target: nodeId,
        type: 'smoothstep',
        animated: false,
        style: {
          stroke: 'hsl(var(--border))',
          strokeWidth: 2,
        },
      });
    }
  });

  return { nodes, edges };
}

// Auto-layout utility for better node positioning
export function autoLayoutNodes(nodes: Node[]): Node[] {
  // This is a simple vertical layout
  // You can enhance this with more sophisticated layouts like dagre
  return nodes.map((node, index) => ({
    ...node,
    position: {
      x: 300,
      y: index * 250,
    },
  }));
}
