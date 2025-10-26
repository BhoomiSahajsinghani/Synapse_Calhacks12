import { Node, Edge } from '@xyflow/react';

export type LayoutType = 'tree' | 'grid' | 'radial' | 'horizontal' | 'vertical' | 'dagre';

interface LayoutOptions {
  nodeWidth?: number;
  nodeHeight?: number;
  horizontalSpacing?: number;
  verticalSpacing?: number;
  centerX?: number;
  centerY?: number;
}

const DEFAULT_OPTIONS: LayoutOptions = {
  nodeWidth: 500,
  nodeHeight: 200,
  horizontalSpacing: 150,
  verticalSpacing: 150,
  centerX: 400,
  centerY: 300,
};

/**
 * Tree Layout - Hierarchical tree structure
 */
export function treeLayout(
  nodes: Node[],
  edges: Edge[],
  options: LayoutOptions = {}
): Node[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { nodeWidth, nodeHeight, horizontalSpacing, verticalSpacing, centerX, centerY } = opts;

  // Build adjacency list
  const adjacency = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  nodes.forEach(node => {
    adjacency.set(node.id, []);
    inDegree.set(node.id, 0);
  });

  edges.forEach(edge => {
    const children = adjacency.get(edge.source) || [];
    children.push(edge.target);
    adjacency.set(edge.source, children);
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
  });

  // Find root nodes (nodes with no incoming edges)
  const roots = nodes.filter(node => inDegree.get(node.id) === 0);

  // If no roots found, use the first node
  if (roots.length === 0 && nodes.length > 0) {
    roots.push(nodes[0]);
  }

  // Position nodes level by level
  const positioned = new Map<string, { x: number; y: number }>();
  const visited = new Set<string>();

  function positionSubtree(
    nodeId: string,
    x: number,
    y: number,
    level: number
  ): number {
    if (visited.has(nodeId)) return x;
    visited.add(nodeId);

    const children = adjacency.get(nodeId) || [];
    const childCount = children.length;

    if (childCount === 0) {
      // Leaf node
      positioned.set(nodeId, { x, y });
      return x + nodeWidth + horizontalSpacing;
    }

    // Calculate subtree width
    let subtreeStart = x;
    let currentX = x;

    // Position children
    children.forEach(childId => {
      currentX = positionSubtree(
        childId,
        currentX,
        y + nodeHeight + verticalSpacing,
        level + 1
      );
    });

    // Center parent over children
    const subtreeEnd = currentX - horizontalSpacing;
    const parentX = (subtreeStart + subtreeEnd - nodeWidth) / 2;
    positioned.set(nodeId, { x: parentX, y });

    return currentX;
  }

  // Position each root and its subtree
  let currentX = centerX!;
  roots.forEach(root => {
    currentX = positionSubtree(root.id, currentX, centerY!, 0);
  });

  // Apply positions to nodes
  return nodes.map(node => ({
    ...node,
    position: positioned.get(node.id) || { x: centerX!, y: centerY! },
  }));
}

/**
 * Grid Layout - Arrange nodes in a grid pattern
 */
export function gridLayout(
  nodes: Node[],
  edges: Edge[],
  options: LayoutOptions = {}
): Node[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { nodeWidth, nodeHeight, horizontalSpacing, verticalSpacing, centerX, centerY } = opts;

  const count = nodes.length;
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);

  // Calculate starting position to center the grid
  const gridWidth = cols * (nodeWidth + horizontalSpacing) - horizontalSpacing;
  const gridHeight = rows * (nodeHeight + verticalSpacing) - verticalSpacing;
  const startX = centerX! - gridWidth / 2;
  const startY = centerY! - gridHeight / 2;

  return nodes.map((node, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);

    return {
      ...node,
      position: {
        x: startX + col * (nodeWidth + horizontalSpacing),
        y: startY + row * (nodeHeight + verticalSpacing),
      },
    };
  });
}

/**
 * Radial Layout - Arrange nodes in concentric circles
 */
export function radialLayout(
  nodes: Node[],
  edges: Edge[],
  options: LayoutOptions = {}
): Node[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { centerX, centerY } = opts;

  if (nodes.length === 0) return [];

  // Build adjacency for finding center nodes
  const adjacency = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  nodes.forEach(node => {
    adjacency.set(node.id, []);
    inDegree.set(node.id, 0);
  });

  edges.forEach(edge => {
    const children = adjacency.get(edge.source) || [];
    children.push(edge.target);
    adjacency.set(edge.source, children);
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
  });

  // Find root nodes for center
  const roots = nodes.filter(node => inDegree.get(node.id) === 0);
  const centerNodes = roots.length > 0 ? roots : [nodes[0]];

  // Arrange nodes in layers
  const layers: string[][] = [];
  const visited = new Set<string>();

  // BFS to create layers
  let currentLayer = centerNodes.map(n => n.id);
  while (currentLayer.length > 0 && visited.size < nodes.length) {
    layers.push(currentLayer);
    currentLayer.forEach(id => visited.add(id));

    const nextLayer = new Set<string>();
    currentLayer.forEach(nodeId => {
      const children = adjacency.get(nodeId) || [];
      children.forEach(childId => {
        if (!visited.has(childId)) {
          nextLayer.add(childId);
        }
      });
    });

    currentLayer = Array.from(nextLayer);
  }

  // Add any remaining unconnected nodes
  const remainingNodes = nodes.filter(n => !visited.has(n.id));
  if (remainingNodes.length > 0) {
    layers.push(remainingNodes.map(n => n.id));
  }

  // Position nodes
  const positioned = new Map<string, { x: number; y: number }>();
  const radiusIncrement = 200;

  layers.forEach((layer, layerIndex) => {
    if (layerIndex === 0) {
      // Center node(s)
      if (layer.length === 1) {
        positioned.set(layer[0], { x: centerX!, y: centerY! });
      } else {
        // Multiple center nodes - arrange in small circle
        layer.forEach((nodeId, i) => {
          const angle = (2 * Math.PI * i) / layer.length;
          positioned.set(nodeId, {
            x: centerX! + 50 * Math.cos(angle),
            y: centerY! + 50 * Math.sin(angle),
          });
        });
      }
    } else {
      // Outer layers
      const radius = layerIndex * radiusIncrement;
      layer.forEach((nodeId, i) => {
        const angle = (2 * Math.PI * i) / layer.length - Math.PI / 2;
        positioned.set(nodeId, {
          x: centerX! + radius * Math.cos(angle),
          y: centerY! + radius * Math.sin(angle),
        });
      });
    }
  });

  return nodes.map(node => ({
    ...node,
    position: positioned.get(node.id) || { x: centerX!, y: centerY! },
  }));
}

/**
 * Horizontal Layout - Arrange nodes horizontally
 */
export function horizontalLayout(
  nodes: Node[],
  edges: Edge[],
  options: LayoutOptions = {}
): Node[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { nodeWidth, horizontalSpacing, centerY } = opts;

  // Try to order by connections
  const ordered = topologicalSort(nodes, edges);

  return ordered.map((node, index) => ({
    ...node,
    position: {
      x: 100 + index * (nodeWidth + horizontalSpacing),
      y: centerY!,
    },
  }));
}

/**
 * Vertical Layout - Arrange nodes vertically
 */
export function verticalLayout(
  nodes: Node[],
  edges: Edge[],
  options: LayoutOptions = {}
): Node[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { nodeHeight, verticalSpacing, centerX } = opts;

  // Try to order by connections
  const ordered = topologicalSort(nodes, edges);

  return ordered.map((node, index) => ({
    ...node,
    position: {
      x: centerX!,
      y: 100 + index * (nodeHeight + verticalSpacing),
    },
  }));
}

/**
 * Dagre Layout - Directed Acyclic Graph layout
 * This is a simplified version - for full dagre, we'd need the dagre library
 */
export function dagreLayout(
  nodes: Node[],
  edges: Edge[],
  options: LayoutOptions = {}
): Node[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { nodeWidth, nodeHeight, horizontalSpacing, verticalSpacing, centerX, centerY } = opts;

  // Build levels using BFS
  const adjacency = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  nodes.forEach(node => {
    adjacency.set(node.id, []);
    inDegree.set(node.id, 0);
  });

  edges.forEach(edge => {
    const children = adjacency.get(edge.source) || [];
    children.push(edge.target);
    adjacency.set(edge.source, children);
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
  });

  // Assign levels to nodes
  const levels = new Map<string, number>();
  const queue: string[] = [];

  // Start with nodes that have no incoming edges
  nodes.forEach(node => {
    if (inDegree.get(node.id) === 0) {
      queue.push(node.id);
      levels.set(node.id, 0);
    }
  });

  // If no roots, start with first node
  if (queue.length === 0 && nodes.length > 0) {
    queue.push(nodes[0].id);
    levels.set(nodes[0].id, 0);
  }

  // BFS to assign levels
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    const level = levels.get(nodeId)!;
    const children = adjacency.get(nodeId) || [];

    children.forEach(childId => {
      if (!levels.has(childId)) {
        levels.set(childId, level + 1);
        queue.push(childId);
      }
    });
  }

  // Group nodes by level
  const nodesByLevel = new Map<number, string[]>();
  nodes.forEach(node => {
    const level = levels.get(node.id) ?? 0;
    const nodesAtLevel = nodesByLevel.get(level) || [];
    nodesAtLevel.push(node.id);
    nodesByLevel.set(level, nodesAtLevel);
  });

  // Position nodes
  const positioned = new Map<string, { x: number; y: number }>();
  const maxLevel = Math.max(...Array.from(nodesByLevel.keys()));

  nodesByLevel.forEach((nodesAtLevel, level) => {
    const count = nodesAtLevel.length;
    const levelWidth = count * (nodeWidth + horizontalSpacing) - horizontalSpacing;
    const startX = centerX! - levelWidth / 2;

    nodesAtLevel.forEach((nodeId, index) => {
      positioned.set(nodeId, {
        x: startX + index * (nodeWidth + horizontalSpacing),
        y: centerY! - (maxLevel * (nodeHeight + verticalSpacing)) / 2 + level * (nodeHeight + verticalSpacing),
      });
    });
  });

  return nodes.map(node => ({
    ...node,
    position: positioned.get(node.id) || { x: centerX!, y: centerY! },
  }));
}

/**
 * Helper function for topological sorting
 */
function topologicalSort(nodes: Node[], edges: Edge[]): Node[] {
  const adjacency = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  nodes.forEach(node => {
    adjacency.set(node.id, []);
    inDegree.set(node.id, 0);
  });

  edges.forEach(edge => {
    const children = adjacency.get(edge.source) || [];
    children.push(edge.target);
    adjacency.set(edge.source, children);
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
  });

  const queue: string[] = [];
  const result: Node[] = [];

  nodes.forEach(node => {
    if (inDegree.get(node.id) === 0) {
      queue.push(node.id);
    }
  });

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    const node = nodes.find(n => n.id === nodeId)!;
    result.push(node);

    const children = adjacency.get(nodeId) || [];
    children.forEach(childId => {
      const degree = inDegree.get(childId)! - 1;
      inDegree.set(childId, degree);
      if (degree === 0) {
        queue.push(childId);
      }
    });
  }

  // Add any remaining nodes not in the graph
  nodes.forEach(node => {
    if (!result.find(n => n.id === node.id)) {
      result.push(node);
    }
  });

  return result;
}

/**
 * Apply layout to nodes
 */
export function applyLayout(
  nodes: Node[],
  edges: Edge[],
  layoutType: LayoutType,
  options: LayoutOptions = {}
): Node[] {
  switch (layoutType) {
    case 'tree':
      return treeLayout(nodes, edges, options);
    case 'grid':
      return gridLayout(nodes, edges, options);
    case 'radial':
      return radialLayout(nodes, edges, options);
    case 'horizontal':
      return horizontalLayout(nodes, edges, options);
    case 'vertical':
      return verticalLayout(nodes, edges, options);
    case 'dagre':
      return dagreLayout(nodes, edges, options);
    default:
      return nodes;
  }
}