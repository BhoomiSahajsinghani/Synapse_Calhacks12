'use server';

import {
  getFlowNodesByChatId,
  getFlowEdgesByChatId,
  saveFlowNodes,
  saveFlowEdges,
  dbNodeToReactFlow,
  dbEdgeToReactFlow,
} from './flow-queries';
import type { Node, Edge } from '@xyflow/react';

export async function loadFlowData(chatId: string) {
  try {
    const [dbNodes, dbEdges] = await Promise.all([
      getFlowNodesByChatId({ chatId }),
      getFlowEdgesByChatId({ chatId }),
    ]);

    const nodes = dbNodes.map(dbNodeToReactFlow);
    const edges = dbEdges.map(dbEdgeToReactFlow);

    return { nodes, edges };
  } catch (error) {
    console.error('Failed to load flow data:', error);
    return { nodes: [], edges: [] };
  }
}

export async function saveFlowData({
  chatId,
  nodes,
  edges,
}: {
  chatId: string;
  nodes: Node[];
  edges: Edge[];
}) {
  try {
    // Convert nodes to database format
    const dbNodes = nodes
      .filter((node) => node.type === 'conversationNode' || node.type === 'promptNode' || node.type === 'answerNode')
      .map((node) => ({
        id: node.id,
        type: node.type || 'default',
        positionX: node.position.x.toString(),
        positionY: node.position.y.toString(),
        data: node.data,
        parentNodeId: (node.data as any)?.parentNodeId,
      }));

    // Convert edges to database format
    const dbEdges = edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: edge.type,
      animated: edge.animated,
      style: edge.style,
    }));

    // Save to database - errors are handled gracefully in the save functions
    await Promise.all([
      saveFlowNodes({ nodes: dbNodes, chatId }),
      saveFlowEdges({ edges: dbEdges, chatId }),
    ]);

    return { success: true };
  } catch (error) {
    console.error('Failed to save flow data:', error);
    return { success: false, error: String(error) };
  }
}
