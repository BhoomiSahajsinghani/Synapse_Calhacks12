import 'server-only';

import { and, eq, inArray, or } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { flowNode, flowEdge, type FlowNode, type FlowEdge } from './schema';
import { ChatSDKError } from '../errors';
import type { Node, Edge } from '@xyflow/react';

// biome-ignore lint: Forbidden non-null assertion.
const client = postgres(process.env.POSTGRES_URL!);
const db = drizzle(client);

// ============================================
// FLOW NODE CRUD OPERATIONS
// ============================================

export async function saveFlowNode({
  id,
  chatId,
  type,
  positionX,
  positionY,
  data,
  parentNodeId,
  userMessageId,
  assistantMessageId,
}: {
  id: string;
  chatId: string;
  type: string;
  positionX: string;
  positionY: string;
  data: any;
  parentNodeId?: string;
  userMessageId?: string;
  assistantMessageId?: string;
}) {
  try {
    return await db
      .insert(flowNode)
      .values({
        id,
        chatId,
        type,
        positionX,
        positionY,
        data,
        parentNodeId,
        userMessageId,
        assistantMessageId,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: flowNode.id,
        set: {
          positionX,
          positionY,
          data,
          parentNodeId,
          userMessageId,
          assistantMessageId,
          updatedAt: new Date(),
        },
      });
  } catch (error) {
    console.error('Failed to save flow node:', error);
    throw new ChatSDKError('bad_request:database', 'Failed to save flow node');
  }
}

export async function saveFlowNodes({
  nodes,
  chatId,
}: {
  nodes: Array<{
    id: string;
    type: string;
    positionX: string;
    positionY: string;
    data: any;
    parentNodeId?: string;
    userMessageId?: string;
    assistantMessageId?: string;
  }>;
  chatId: string;
}) {
  try {
    if (nodes.length === 0) return;

    const values = nodes.map((node) => ({
      id: node.id,
      chatId,
      type: node.type,
      positionX: node.positionX,
      positionY: node.positionY,
      data: node.data,
      parentNodeId: node.parentNodeId,
      userMessageId: node.userMessageId,
      assistantMessageId: node.assistantMessageId,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    return await db
      .insert(flowNode)
      .values(values)
      .onConflictDoUpdate({
        target: flowNode.id,
        set: {
          positionX: values[0].positionX,
          positionY: values[0].positionY,
          data: values[0].data,
          parentNodeId: values[0].parentNodeId,
          userMessageId: values[0].userMessageId,
          assistantMessageId: values[0].assistantMessageId,
          updatedAt: new Date(),
        },
      });
  } catch (error) {
    console.error('Failed to save flow nodes:', error);
    throw new ChatSDKError('bad_request:database', 'Failed to save flow nodes');
  }
}

export async function getFlowNodesByChatId({ chatId }: { chatId: string }) {
  try {
    return await db
      .select()
      .from(flowNode)
      .where(eq(flowNode.chatId, chatId))
      .orderBy(flowNode.createdAt);
  } catch (error) {
    console.error('Failed to get flow nodes:', error);
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get flow nodes by chat id',
    );
  }
}

export async function getFlowNodeById({ id }: { id: string }) {
  try {
    const nodes = await db.select().from(flowNode).where(eq(flowNode.id, id));
    return nodes[0];
  } catch (error) {
    console.error('Failed to get flow node:', error);
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get flow node by id',
    );
  }
}

export async function updateFlowNodePosition({
  id,
  positionX,
  positionY,
}: {
  id: string;
  positionX: string;
  positionY: string;
}) {
  try {
    return await db
      .update(flowNode)
      .set({ positionX, positionY, updatedAt: new Date() })
      .where(eq(flowNode.id, id));
  } catch (error) {
    console.error('Failed to update flow node position:', error);
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to update flow node position',
    );
  }
}

export async function deleteFlowNode({ id }: { id: string }) {
  try {
    // Delete associated edges first
    await db
      .delete(flowEdge)
      .where(or(eq(flowEdge.source, id), eq(flowEdge.target, id)));

    // Delete the node
    return await db.delete(flowNode).where(eq(flowNode.id, id));
  } catch (error) {
    console.error('Failed to delete flow node:', error);
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to delete flow node',
    );
  }
}

export async function deleteFlowNodesByChatId({ chatId }: { chatId: string }) {
  try {
    // Edges will be cascade deleted due to foreign key constraint
    return await db.delete(flowNode).where(eq(flowNode.chatId, chatId));
  } catch (error) {
    console.error('Failed to delete flow nodes:', error);
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to delete flow nodes by chat id',
    );
  }
}

// ============================================
// FLOW EDGE CRUD OPERATIONS
// ============================================

export async function saveFlowEdge({
  id,
  chatId,
  source,
  target,
  type = 'smoothstep',
  animated = false,
  style,
}: {
  id: string;
  chatId: string;
  source: string;
  target: string;
  type?: string;
  animated?: boolean;
  style?: any;
}) {
  try {
    return await db
      .insert(flowEdge)
      .values({
        id,
        chatId,
        source,
        target,
        type,
        animated,
        style,
        createdAt: new Date(),
      })
      .onConflictDoUpdate({
        target: flowEdge.id,
        set: {
          source,
          target,
          type,
          animated,
          style,
        },
      });
  } catch (error) {
    console.error('Failed to save flow edge:', error);
    throw new ChatSDKError('bad_request:database', 'Failed to save flow edge');
  }
}

export async function saveFlowEdges({
  edges,
  chatId,
}: {
  edges: Array<{
    id: string;
    source: string;
    target: string;
    type?: string;
    animated?: boolean;
    style?: any;
  }>;
  chatId: string;
}) {
  try {
    if (edges.length === 0) return;

    const values = edges.map((edge) => ({
      id: edge.id,
      chatId,
      source: edge.source,
      target: edge.target,
      type: edge.type || 'smoothstep',
      animated: edge.animated || false,
      style: edge.style,
      createdAt: new Date(),
    }));

    return await db
      .insert(flowEdge)
      .values(values)
      .onConflictDoUpdate({
        target: flowEdge.id,
        set: {
          source: values[0].source,
          target: values[0].target,
          type: values[0].type,
          animated: values[0].animated,
          style: values[0].style,
        },
      });
  } catch (error) {
    console.error('Failed to save flow edges:', error);
    throw new ChatSDKError('bad_request:database', 'Failed to save flow edges');
  }
}

export async function getFlowEdgesByChatId({ chatId }: { chatId: string }) {
  try {
    return await db
      .select()
      .from(flowEdge)
      .where(eq(flowEdge.chatId, chatId))
      .orderBy(flowEdge.createdAt);
  } catch (error) {
    console.error('Failed to get flow edges:', error);
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get flow edges by chat id',
    );
  }
}

export async function deleteFlowEdge({ id }: { id: string }) {
  try {
    return await db.delete(flowEdge).where(eq(flowEdge.id, id));
  } catch (error) {
    console.error('Failed to delete flow edge:', error);
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to delete flow edge',
    );
  }
}

export async function deleteFlowEdgesByChatId({ chatId }: { chatId: string }) {
  try {
    return await db.delete(flowEdge).where(eq(flowEdge.chatId, chatId));
  } catch (error) {
    console.error('Failed to delete flow edges:', error);
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to delete flow edges by chat id',
    );
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Convert ReactFlow nodes to database format
 */
export function reactFlowNodeToDb(
  node: Node,
  chatId: string,
  userMessageId?: string,
  assistantMessageId?: string,
): Parameters<typeof saveFlowNode>[0] {
  return {
    id: node.id,
    chatId,
    type: node.type || 'default',
    positionX: node.position.x.toString(),
    positionY: node.position.y.toString(),
    data: node.data,
    parentNodeId: (node.data as any)?.parentNodeId,
    userMessageId,
    assistantMessageId,
  };
}

/**
 * Convert database node to ReactFlow format
 */
export function dbNodeToReactFlow(dbNode: FlowNode): Node {
  return {
    id: dbNode.id,
    type: dbNode.type,
    position: {
      x: parseFloat(dbNode.positionX),
      y: parseFloat(dbNode.positionY),
    },
    data: dbNode.data as any,
    draggable: true,
  };
}

/**
 * Convert ReactFlow edge to database format
 */
export function reactFlowEdgeToDb(
  edge: Edge,
  chatId: string,
): Parameters<typeof saveFlowEdge>[0] {
  return {
    id: edge.id,
    chatId,
    source: edge.source,
    target: edge.target,
    type: edge.type,
    animated: edge.animated,
    style: edge.style,
  };
}

/**
 * Convert database edge to ReactFlow format
 */
export function dbEdgeToReactFlow(dbEdge: FlowEdge): Edge {
  return {
    id: dbEdge.id,
    source: dbEdge.source,
    target: dbEdge.target,
    type: dbEdge.type || 'smoothstep',
    animated: dbEdge.animated || false,
    style: (dbEdge.style as any) || undefined,
  };
}
