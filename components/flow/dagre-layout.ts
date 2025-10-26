import dagre from '@dagrejs/dagre';
import type { Node, Edge } from '@xyflow/react';
import { applyLayout as applySmartLayout, type LayoutType as SmartLayoutType } from '@/lib/layout-algorithms';

type LayoutType = 'horizontal' | 'vertical' | 'radial' | 'tree' | 'grid' | 'dagre' | 'auto';

export const getLayoutedElements = <T extends Record<string, unknown> = any>(
  nodes: Node<T>[],
  edges: Edge[],
  direction = 'LR', // LR for horizontal, TB for vertical
  layoutType: LayoutType = 'horizontal'
) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  const nodeWidth = 520;
  const nodeHeight = 200;

  // Improved layout options based on graph size and complexity
  const nodeCount = nodes.length;
  const isLargeGraph = nodeCount > 10;
  const isComplexGraph = edges.length > nodeCount * 1.5;

  // Dynamic spacing based on graph size
  const baseNodeSep = isLargeGraph ? 200 : 150;
  const baseRankSep = isLargeGraph ? 250 : 200;

  // Set graph layout options with improved spacing
  dagreGraph.setGraph({
    rankdir: direction,
    align: 'DL', // Down-Left alignment for better tree structure
    nodesep: baseNodeSep,
    ranksep: baseRankSep,
    marginx: 150,
    marginy: 150,
    ranker: isComplexGraph ? 'network-simplex' : 'tight-tree', // Better algorithm for complex graphs
    acyclicer: 'greedy', // Handle cycles better
  });

  // Add nodes to dagre
  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  // Add edges to dagre with weight for better layout
  edges.forEach((edge) => {
    // Add weight to edges to influence layout (shorter edges for connected conversations)
    const weight = edge.data?.isReply ? 2 : 1;
    dagreGraph.setEdge(edge.source, edge.target, { weight });
  });

  // Calculate the layout
  dagre.layout(dagreGraph);

  // Apply the calculated positions to nodes with centering
  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    } as Node<T>;
  });

  return { nodes: layoutedNodes, edges };
};

// Alternative radial layout for branching conversations
export const getRadialLayout = <T extends Record<string, unknown> = any>(
  nodes: Node<T>[],
  edges: Edge[],
  centerNodeId?: string
) => {
  if (nodes.length === 0) return { nodes, edges };

  const nodeWidth = 520;
  const nodeHeight = 200;
  const radius = 400;

  // Find center node (root of conversation)
  const centerNode = centerNodeId
    ? nodes.find(n => n.id === centerNodeId)
    : nodes.find(n => !edges.some(e => e.target === n.id)) || nodes[0];

  if (!centerNode) return { nodes, edges };

  // Build adjacency list
  const adjacencyList = new Map<string, string[]>();
  edges.forEach(edge => {
    if (!adjacencyList.has(edge.source)) {
      adjacencyList.set(edge.source, []);
    }
    adjacencyList.get(edge.source)?.push(edge.target);
  });

  // BFS to assign levels
  const levels = new Map<string, number>();
  const queue = [{ id: centerNode.id, level: 0 }];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const { id, level } = queue.shift()!;
    if (visited.has(id)) continue;

    visited.add(id);
    levels.set(id, level);

    const neighbors = adjacencyList.get(id) || [];
    neighbors.forEach(neighbor => {
      if (!visited.has(neighbor)) {
        queue.push({ id: neighbor, level: level + 1 });
      }
    });
  }

  // Calculate positions based on levels
  const levelGroups = new Map<number, string[]>();
  levels.forEach((level, nodeId) => {
    if (!levelGroups.has(level)) {
      levelGroups.set(level, []);
    }
    levelGroups.get(level)?.push(nodeId);
  });

  const layoutedNodes = nodes.map(node => {
    const level = levels.get(node.id) || 0;
    const levelNodes = levelGroups.get(level) || [];
    const indexInLevel = levelNodes.indexOf(node.id);
    const totalInLevel = levelNodes.length;

    if (level === 0) {
      // Center node
      return {
        ...node,
        position: { x: 0, y: 0 }
      } as Node<T>;
    }

    // Calculate angle for this node
    const angleStep = (2 * Math.PI) / totalInLevel;
    const angle = indexInLevel * angleStep;
    const currentRadius = radius * level;

    return {
      ...node,
      position: {
        x: Math.cos(angle) * currentRadius - nodeWidth / 2,
        y: Math.sin(angle) * currentRadius - nodeHeight / 2,
      }
    } as Node<T>;
  });

  return { nodes: layoutedNodes, edges };
};

// Tree layout for hierarchical conversations
export const getTreeLayout = <T extends Record<string, unknown> = any>(
  nodes: Node<T>[],
  edges: Edge[],
  direction: 'horizontal' | 'vertical' = 'vertical'
) => {
  const nodeWidth = 520;
  const nodeHeight = 200;
  const levelHeight = direction === 'vertical' ? 300 : 250;
  const levelWidth = direction === 'horizontal' ? 400 : 350;

  // Build parent-child relationships
  const childrenMap = new Map<string, string[]>();
  const parentMap = new Map<string, string>();

  edges.forEach(edge => {
    if (!childrenMap.has(edge.source)) {
      childrenMap.set(edge.source, []);
    }
    childrenMap.get(edge.source)?.push(edge.target);
    parentMap.set(edge.target, edge.source);
  });

  // Find root nodes (nodes with no parents)
  const roots = nodes.filter(node => !parentMap.has(node.id));
  if (roots.length === 0 && nodes.length > 0) {
    roots.push(nodes[0]); // Fallback to first node
  }

  const positionedNodes = new Map<string, { x: number; y: number }>();

  // Recursive function to position nodes
  const positionNode = (nodeId: string, x: number, y: number, siblingIndex = 0, totalSiblings = 1) => {
    const children = childrenMap.get(nodeId) || [];
    const childWidth = levelWidth * Math.max(1, children.length);

    // Position current node
    if (direction === 'vertical') {
      const xOffset = totalSiblings > 1
        ? (siblingIndex - (totalSiblings - 1) / 2) * levelWidth
        : 0;
      positionedNodes.set(nodeId, { x: x + xOffset, y });
    } else {
      const yOffset = totalSiblings > 1
        ? (siblingIndex - (totalSiblings - 1) / 2) * levelHeight / 2
        : 0;
      positionedNodes.set(nodeId, { x, y: y + yOffset });
    }

    // Position children
    children.forEach((childId, index) => {
      if (direction === 'vertical') {
        positionNode(childId, x, y + levelHeight, index, children.length);
      } else {
        positionNode(childId, x + levelWidth, y, index, children.length);
      }
    });
  };

  // Position all trees
  let currentX = 0;
  let currentY = 0;

  roots.forEach((root, index) => {
    positionNode(root.id, currentX, currentY);
    if (direction === 'vertical') {
      currentX += levelWidth * 3; // Space between separate trees
    } else {
      currentY += levelHeight * 2; // Space between separate trees
    }
  });

  // Apply positions to nodes
  const layoutedNodes = nodes.map(node => {
    const position = positionedNodes.get(node.id) || { x: 0, y: 0 };
    return {
      ...node,
      position: {
        x: position.x - nodeWidth / 2,
        y: position.y - nodeHeight / 2,
      }
    } as Node<T>;
  });

  return { nodes: layoutedNodes, edges };
};