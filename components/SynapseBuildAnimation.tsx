import React, { useEffect, useRef, useState, useMemo } from 'react';

interface SynapseBuildAnimationProps {
  width?: number;
  height?: number;
  maxNodes?: number;
  showControls?: boolean;
}

const SynapseBuildAnimation: React.FC<SynapseBuildAnimationProps> = ({
  width,
  height,
  maxNodes = 15,
  showControls = true
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationIdRef = useRef<number | null>(null);
  const hasTriggeredComplete = useRef(false);
  const fallbackTimeoutRef = useRef<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [canvasSize, setCanvasSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  });

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setCanvasSize({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // // Draw the logo on canvas initially (before animation starts)
  // useEffect(() => {
  //   if (isAnimating) return; // Don't redraw if animation is running

  //   const canvas = canvasRef.current;
  //   if (!canvas) return;

  //   const ctx = canvas.getContext('2d');
  //   if (!ctx) return;

  //   const canvasWidth = canvasSize.width;
  //   const canvasHeight = canvasSize.height;
  //   const logoWidth = 500 * 2;
  //   const logoHeight = 151 * 2;
  //   const logoX = (canvasWidth - logoWidth) / 2;
  //   const logoY = (canvasHeight - logoHeight) / 2;

  //   const logoImage = new Image();
  //   logoImage.src = 'Synapse.svg';

  //   logoImage.onload = () => {
  //     ctx.clearRect(0, 0, canvas.width, canvas.height);
  //     ctx.drawImage(logoImage, logoX, logoY, logoWidth, logoHeight);
  //   };
  // }, [canvasSize, isAnimating]);

  useEffect(() => {
    if (!isAnimating) return;

    // Reset completion tracking when animation starts
    hasTriggeredComplete.current = false;
    setIsComplete(false);

    // Set fallback timeout - trigger slide-up after max duration if not completed
    const maxAnimationDuration = 4000; // 10 seconds
    fallbackTimeoutRef.current = window.setTimeout(() => {
      if (!hasTriggeredComplete.current) {
        console.log('Fallback timeout triggered - forcing slide-up');
        hasTriggeredComplete.current = true;
        setIsComplete(true);
      }
    }, maxAnimationDuration);

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const canvasWidth = canvasSize.width;
    const canvasHeight = canvasSize.height;
    // Logo position and size
    const logoWidth = 500 * 2;
    const logoHeight = 151 * 2;
    const logoX = (canvasWidth - logoWidth) / 2;
    const logoY = (canvasHeight - logoHeight) / 2;

    // Button position (center of button)
    const buttonSize = 140;
    const buttonCenterX = logoX + (logoWidth / 2) + 358;
    const buttonCenterY = logoY + (logoHeight / 2);

    // Load Synapse logo SVG
    const logoImage = new Image();
    logoImage.src = 'Component 1 (1).svg';

    // Load node SVG images
    const nodeImages = {
      green: new Image(),
      blue: new Image(),
      pink: new Image(),
      magenta: new Image()
    };
    nodeImages.green.src = 'green.svg';
    nodeImages.blue.src = 'blue.svg';
    nodeImages.pink.src = 'pink.svg';
    nodeImages.magenta.src = 'magenta.svg';

    // Color palette with SVG mapping
    const colorMap: Record<string, { name: string; image: HTMLImageElement }> = {
      '#eaf2d7': { name: 'green', image: nodeImages.green },
      '#b3dee2': { name: 'blue', image: nodeImages.blue },
      '#efcfe3': { name: 'magenta', image: nodeImages.magenta },
      '#e27396': { name: 'pink', image: nodeImages.pink },
    };
    const colors = Object.keys(colorMap);

    // Initial nodes from the image
    // Initial nodes with spawn angle limits ±45° from their current angles
const initialNodes = [
  { 
    relX: 0.76,
    relY: 0.22,
    x: 0.652, 
    y: 0.4, 
    color: '#efcfe3', 
    radius: 48, 
    angle: (5 * Math.PI / 4),
  },
  { 
    relX: 0.95,
    relY: 0.22,
    x: 0.76, 
    y: 0.4, 
    color: '#b3dee2', 
    radius: 48, 
    angle: (7 * Math.PI / 4),
  },
  { 
    relX: 0.76,
    relY: 0.84,
    x: 0.652, 
    y: 0.6, 
    color: '#e27396', 
    radius: 48, 
    angle: (3 * Math.PI / 4),
  },
  { 
    relX: 0.95,
    relY: 0.84,
    x: 0.76, 
    y: 0.6, 
    color: '#eaf2d7', 
    radius: 48, 
    angle: (Math.PI / 4),
  },
];


    class Node {
  x: number;
  y: number;
  offsetX: number; // Offset from button center
  offsetY: number; // Offset from button center
  angle: number;
  minAngle: number; // spawn cone min
  maxAngle: number; // spawn cone max
  color: string;
  targetRadius: number;
  radius: number;
  opacity: number;
  generation: number;
  startTime: number | null;
  isAnimating: boolean;
  isComplete: boolean;
  hasSpawned: boolean;

  constructor(
    x: number,
    y: number,
    color: string,
    radius: number,
    generation = 0,
    angle: number,
    minAngle?: number,
    maxAngle?: number
  ) {
    this.x = x;
    this.y = y;
    // Store offset from button center
    this.offsetX = x - buttonCenterX;
    this.offsetY = y - buttonCenterY;
    this.color = color;
    this.targetRadius = radius;
    this.radius = 0;
    this.opacity = 0;
    this.generation = generation;
    this.startTime = null;
    this.isAnimating = false;
    this.isComplete = false;
    this.hasSpawned = false;
    this.angle = angle;
    this.minAngle = minAngle ?? angle - Math.PI / 4; // default ±45°
    this.maxAngle = maxAngle ?? angle + Math.PI / 4;
  }

  updatePosition(newButtonCenterX: number, newButtonCenterY: number) {
    this.x = newButtonCenterX + this.offsetX;
    this.y = newButtonCenterY + this.offsetY;
  }

      start(currentTime: number) {
        if (!this.startTime) {
          this.startTime = currentTime;
          this.isAnimating = true;
        }
      }

      update(currentTime: number) {
        if (!this.isAnimating || this.isComplete) return;

        const elapsed = currentTime - this.startTime!;
        const duration = 600;

        if (elapsed < duration) {
          const progress = elapsed / duration;
          const eased = this.easeOutBack(progress);

          this.radius = this.targetRadius * eased;
          this.opacity = Math.min(progress * 1.5, 1);
        } else {
          this.radius = this.targetRadius;
          this.opacity = 1;
          this.isComplete = true;
          this.isAnimating = false;
        }
      }

      easeOutBack(t: number): number {
        const c1 = 1.70158;
        const c3 = c1 + 1;
        return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
      }

      draw() {
        if (this.radius === 0) return;

        const colorInfo = colorMap[this.color];
        const nodeImage = colorInfo ? colorInfo.image : null;

        ctx.save();
        ctx.globalAlpha = this.opacity;

        if (nodeImage && nodeImage.complete) {
          // Draw SVG image
          const size = this.radius * 2;
          ctx.drawImage(
            nodeImage,
            this.x - this.radius,
            this.y - this.radius,
            size,
            size
          );
        } else {
          // Fallback to colored circle if image not loaded
          ctx.shadowBlur = 20;
          ctx.shadowColor = this.color;
          ctx.fillStyle = this.color;
          ctx.beginPath();
          ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      }
    }

    class Connection {
      node1: Node;
      node2: Node;
      progress: number;
      opacity: number;
      startTime: number | null;
      isAnimating: boolean;
      isComplete: boolean;

      constructor(node1: Node, node2: Node) {
        this.node1 = node1;
        this.node2 = node2;
        this.progress = 0;
        this.opacity = 0;
        this.startTime = null;
        this.isAnimating = false;
        this.isComplete = false;
      }

      start(currentTime: number) {
        if (!this.startTime) {
          this.startTime = currentTime;
          this.isAnimating = true;
        }
      }

      update(currentTime: number) {
        if (!this.isAnimating || this.isComplete) return;

        const elapsed = currentTime - this.startTime!;
        const duration = 500;

        if (elapsed < duration) {
          const t = elapsed / duration;
          this.progress = t;
          this.opacity = Math.min(t * 1.5, 0.5);
        } else {
          this.progress = 1;
          this.opacity = 0.5;
          this.isComplete = true;
          this.isAnimating = false;
        }
      }

      draw() {
        if (this.progress === 0) return;

        const currentX = this.node1.x + (this.node2.x - this.node1.x) * this.progress;
        const currentY = this.node1.y + (this.node2.y - this.node1.y) * this.progress;

        ctx.save();
        ctx.globalAlpha = 1;

        // Create gradient along the line
        // const gradient = ctx.createLinearGradient(
        //   this.node1.x, this.node1.y,
        //   this.node2.x, this.node2.y
        // );
        // gradient.addColorStop(0, this.node1.color);
        // gradient.addColorStop(1, this.node2.color);

        ctx.strokeStyle = "#FFFAF1";
        ctx.lineWidth = 8;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(this.node1.x, this.node1.y);
        ctx.lineTo(currentX, currentY);
        ctx.stroke();

        ctx.restore();
      }
    }

    let nodes: Node[] = [];
    let connections: Connection[] = [];
    let pendingConnections: Array<{ connection?: Connection; fromIndex?: number; toIndex?: number; delay: number }> = [];
    let pendingNodes: Array<{ node: Node; delay: number }> = [];
    let animationStartTime: number | null = null;
    let lastSpawnTime = 0;
    const spawnInterval = 200;

    function init() {
      nodes = [];
      connections = [];
      pendingConnections = [];
      pendingNodes = [];
      animationStartTime = null;
      lastSpawnTime = 0;

      // Create center node at button position
      const centerNode = new Node(
        buttonCenterX,
        buttonCenterY,
        '#FFFAF1', // White/cream color
        30, // Smaller radius for center
        0,
        0
      );
      centerNode.hasSpawned = true; // Prevent it from spawning more nodes
      pendingNodes.push({ node: centerNode, delay: 0 });

      // Create initial nodes around the button
      initialNodes.forEach((def) => {
  // Position nodes relative to button center
  const distance = 150; // Distance from button center
  const absX = buttonCenterX + Math.cos(def.angle) * distance;
  const absY = buttonCenterY + Math.sin(def.angle) * distance;

  const node = new Node(
    absX,
    absY,
    def.color,
    def.radius,
    0,
    def.angle
  );
  pendingNodes.push({ node, delay: 200 }); // Slight delay for initial nodes

  // Create connection from center to this node
  pendingConnections.push({
    connection: new Connection(centerNode, node),
    delay: 50
  });
});
    }

    function linesIntersect(a1: {x:number,y:number}, a2:{x:number,y:number}, b1:{x:number,y:number}, b2:{x:number,y:number}) {
      const det = (a2.x - a1.x) * (b2.y - b1.y) - (b2.x - b1.x) * (a2.y - a1.y);
      if (det === 0) return false; // parallel lines
      const lambda = ((b2.y - b1.y) * (b2.x - a1.x) + (b1.x - b2.x) * (b2.y - a1.y)) / det;
      const gamma = ((a1.y - a2.y) * (b2.x - a1.x) + (a2.x - a1.x) * (b2.y - a1.y)) / det;
      return (0 < lambda && lambda < 1) && (0 < gamma && gamma < 1);
    }

function spawnNewNodesFromNode(sourceNode: Node, currentTime: number) {
  if (!sourceNode.isComplete || sourceNode.hasSpawned || nodes.length + pendingNodes.length >= maxNodes) return;

  sourceNode.hasSpawned = true;
  const numNewNodes = Math.floor(Math.random() * 2) + 1;

  for (let i = 0; i < numNewNodes; i++) {
    let attempts = 0;
    let newX = 0;
    let newY = 0;
    let placementAngle = 0;
    let validPosition = false;

    while (!validPosition && attempts < 50) {
      attempts++;

      // Pick a random angle within the parent's spawn limits
      placementAngle = sourceNode.minAngle + (Math.random() * (sourceNode.maxAngle - sourceNode.minAngle) * (i+1)/numNewNodes);

      // Pick a random distance
      const distance = 150+ Math.random() * 300;
      newX = sourceNode.x + Math.cos(placementAngle) * distance;
      newY = sourceNode.y + Math.sin(placementAngle) * distance;

      // Check bounds
      if (newX < -50 || newX > canvasSize.width + 50 || newY < -50 || newY > canvasSize.height + 50) continue;

      validPosition = true;

      // Check distance to existing nodes
      for (let node of nodes) {
        const dx = node.x - newX;
        const dy = node.y - newY;
        if (Math.sqrt(dx * dx + dy * dy) < 100) {
          validPosition = false;
          break;
        }
      }

      // Check distance to pending nodes
      if (validPosition) {
        for (let pending of pendingNodes) {
          const node = pending.node;
          const dx = node.x - newX;
          const dy = node.y - newY;
          if (Math.sqrt(dx * dx + dy * dy) < 100) {
            validPosition = false;
            break;
          }
        }
      }

      // Check intersection with existing connections
      if (validPosition) {
        for (let conn of connections) {
          if (linesIntersect(
            { x: sourceNode.x, y: sourceNode.y },
            { x: newX, y: newY },
            { x: conn.node1.x, y: conn.node1.y },
            { x: conn.node2.x, y: conn.node2.y }
          )) {
            validPosition = false;
            break;
          }
        }
      }

      // Check intersection with pending connections
      if (validPosition) {
        for (let pending of pendingConnections) {
          if (!pending.connection) continue;
          const conn = pending.connection;
          if (linesIntersect(
            { x: sourceNode.x, y: sourceNode.y },
            { x: newX, y: newY },
            { x: conn.node1.x, y: conn.node1.y },
            { x: conn.node2.x, y: conn.node2.y }
          )) {
            validPosition = false;
            break;
          }
        }
      }
    }

    if (validPosition) {
  const newColor = colors[Math.floor(Math.random() * colors.length)];

  // Child node spawn limits ±45° around its placement angle
  let childMinAngle = placementAngle - Math.PI / 4;
  let childMaxAngle = placementAngle + Math.PI / 4;

  // Clamp child angles to parent range
  childMinAngle = Math.max(childMinAngle, sourceNode.minAngle);
  childMaxAngle = Math.min(childMaxAngle, sourceNode.maxAngle);

  const newNode = new Node(newX, newY, newColor, 48, sourceNode.generation + 1, placementAngle);

  newNode.minAngle = childMinAngle;
  newNode.maxAngle = childMaxAngle;

  pendingNodes.push({ node: newNode, delay: 0 });
  pendingConnections.push({ connection: new Connection(sourceNode, newNode), delay: 0 });
}

  }
}



    function animate(currentTime: number) {
      if (!animationStartTime) {
        animationStartTime = currentTime;
      }

      const elapsed = currentTime - animationStartTime;

      // Update all node positions based on current button center
      nodes.forEach(node => node.updatePosition(buttonCenterX, buttonCenterY));
      pendingNodes.forEach(pending => pending.node.updatePosition(buttonCenterX, buttonCenterY));

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // // Draw "Synapse" logo SVG
      // if (logoImage && logoImage.complete) {
      //   ctx.save();
      //   ctx.globalAlpha = 1;
      //   ctx.drawImage(logoImage, logoX, logoY, logoWidth, logoHeight);
      //   ctx.restore();
      // }

      // Process pending nodes
      for (let i = pendingNodes.length - 1; i >= 0; i--) {
        const pending = pendingNodes[i];
        if (elapsed >= pending.delay) {
          nodes.push(pending.node);
          pending.node.start(currentTime);
          pendingNodes.splice(i, 1);
        }
      }

      // Process pending connections
      for (let i = pendingConnections.length - 1; i >= 0; i--) {
        const pending = pendingConnections[i];
        if (elapsed >= pending.delay) {
          if (pending.connection) {
            connections.push(pending.connection);
            pending.connection.start(currentTime);
          } else {
            // Old format for initial connections
            const node1 = nodes[pending.fromIndex!];
            const node2 = nodes[pending.toIndex!];
            if (node1 && node2) {
              const conn = new Connection(node1, node2);
              connections.push(conn);
              conn.start(currentTime);
            }
          }
          pendingConnections.splice(i, 1);
        }
      }

      // Spawn new nodes from all existing nodes
      if (currentTime - lastSpawnTime > spawnInterval && nodes.length < maxNodes) {
        const completedNodes = nodes.filter(node => node.isComplete && !node.hasSpawned);
        completedNodes.forEach(node => spawnNewNodesFromNode(node, currentTime));
        lastSpawnTime = currentTime;
      }


      // Update all nodes
      nodes.forEach(node => node.update(currentTime));

      // Update all connections
      connections.forEach(connection => connection.update(currentTime));

      // Draw connections first (behind nodes)
      connections.forEach(connection => connection.draw());

      // Draw nodes on top
      nodes.forEach(node => node.draw());

      // Update progress
      const progressValue = Math.min(Math.round((nodes.length / maxNodes) * 100), 100);
      setProgress(progressValue);

      // Check if animation is complete
      if (progressValue >= 100 && nodes.length >= maxNodes && !hasTriggeredComplete.current) {
        const allNodesComplete = nodes.every(node => node.isComplete);

        console.log('Checking completion:', {
          allNodesComplete,
          nodesLength: nodes.length,
          connectionsLength: connections.length
        });

        if (allNodesComplete) {
          console.log('All nodes complete! Triggering slide-up...');
          hasTriggeredComplete.current = true;
          // Clear fallback timeout since we're completing normally
          if (fallbackTimeoutRef.current) {
            clearTimeout(fallbackTimeoutRef.current);
            fallbackTimeoutRef.current = null;
          }
          console.log('Setting isComplete to true');
          setIsComplete(true);
        }
      }

      // Continue animation until triggered
      if (!hasTriggeredComplete.current) {
        animationIdRef.current = requestAnimationFrame(animate);
      }
    }

    // Initialize and start
    init();
    animationIdRef.current = requestAnimationFrame(animate);

    // Cleanup
    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      if (fallbackTimeoutRef.current) {
        clearTimeout(fallbackTimeoutRef.current);
      }
    };
  }, [width, height, maxNodes, isAnimating]);

  // Calculate button position to center it in the logo
  const { buttonLeft, buttonTop, buttonSize } = useMemo(() => {
    const logoWidth = 500 * 2;
    const logoHeight = 151 * 2;
    const logoX = (canvasSize.width - logoWidth) / 2;
    const logoY = (canvasSize.height - logoHeight) / 2;

    // Position button in the center of the logo
    const size = 140;
    const left = logoX + (logoWidth / 2) - (size / 2) + 358;
    const top = logoY + (logoHeight / 2) - (size / 2);

    return { buttonLeft: left, buttonTop: top, buttonSize: size };
  }, [canvasSize]);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100vh',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      background: 'rgba(0, 0, 0, 0.9)',
      transform: isComplete ? 'translateY(-100vh)' : 'translateY(0)',
      transition: 'transform 1.2s ease-in-out, opacity 1.2s ease-in-out',
      opacity: isComplete ? 0 : 1,
      zIndex: 9999
    }}>
      <img src="Synapse.svg" alt="Synapse" style={{ position: 'absolute', zIndex: 1, width:500, height:100 }} />
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        style={{
          display: 'block',
          maxWidth: '100%',
          maxHeight: '100vh'
        }}
      />
      {(
        <button
          onClick={() => !isAnimating ? setIsAnimating(true) : null}
          style={{
            position: 'absolute',
            left: `${buttonLeft}px`,
            top: `${buttonTop}px`,
            width: `${buttonSize}px`,
            height: `${buttonSize}px`,
            fontSize: '16px',
            fontWeight: 'bold',
            color: '#FFFAF1',
            backgroundImage: 'url(button.svg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            border: 'none',
            borderRadius: '50%',
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(36, 34, 35, 0.4)',
            transition: 'transform 0.2s, box-shadow 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.05)';
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(226, 115, 150, 0.6)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 4px 16px rgba(226, 115, 150, 0.4)';
          }}
        >
        </button>
      )}
    </div>
  );
};

export default SynapseBuildAnimation;
