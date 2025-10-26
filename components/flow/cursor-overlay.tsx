'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOthersMapped } from '@/liveblocks.config';

interface CursorOverlayProps {
  containerRef: React.RefObject<HTMLElement>;
}

function Cursor({
  x,
  y,
  color,
  name,
  avatar,
}: {
  x: number;
  y: number;
  color: string;
  name: string;
  avatar?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.5 }}
      transition={{ duration: 0.2 }}
      className='pointer-events-none absolute z-50'
      style={{
        left: `${x}px`,
        top: `${y}px`,
        transform: 'translate(-50%, -50%)',
      }}
    >
      {/* Cursor pointer */}
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ filter: `drop-shadow(0 2px 4px rgba(0,0,0,0.2))` }}
      >
        <path
          d="M3 3L10.07 19.97L12.58 12.58L19.97 10.07L3 3Z"
          fill={color}
          stroke="white"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>

      {/* User label */}
      <div
        className='absolute top-0 left-6 flex items-center gap-1.5 rounded-full px-2 py-1 shadow-sm'
        style={{
          backgroundColor: color,
          color: 'white',
          fontSize: '12px',
          fontWeight: 500,
          whiteSpace: 'nowrap',
        }}
      >
        {avatar ? (
          <img
            src={avatar}
            alt={name}
            className='h-4 w-4 rounded-full border border-white/20'
          />
        ) : (
          <div className='flex h-4 w-4 items-center justify-center rounded-full bg-white/20 text-[10px]'>
            {name.charAt(0).toUpperCase()}
          </div>
        )}
        <span>{name}</span>
      </div>
    </motion.div>
  );
}

export function CursorOverlay({ containerRef }: CursorOverlayProps) {
  const others = useOthersMapped((other) => ({
    cursor: other.presence?.cursor,
    user: other.presence?.user,
  }));

  const [containerBounds, setContainerBounds] = React.useState<DOMRect | null>(null);

  React.useEffect(() => {
    const updateBounds = () => {
      if (containerRef.current) {
        setContainerBounds(containerRef.current.getBoundingClientRect());
      }
    };

    updateBounds();
    window.addEventListener('resize', updateBounds);
    window.addEventListener('scroll', updateBounds);

    // Also update on container changes
    const observer = new ResizeObserver(updateBounds);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', updateBounds);
      window.removeEventListener('scroll', updateBounds);
      observer.disconnect();
    };
  }, [containerRef]);

  if (!containerBounds) return null;

  return (
    <div
      className='pointer-events-none absolute inset-0 overflow-hidden'
      style={{ zIndex: 9999 }}
    >
      <AnimatePresence>
        {others.map(([connectionId, { cursor, user }]) => {
          if (!cursor || !user) return null;

          // Check if cursor is within bounds
          if (
            cursor.x < 0 ||
            cursor.y < 0 ||
            cursor.x > containerBounds.width ||
            cursor.y > containerBounds.height
          ) {
            return null;
          }

          return (
            <Cursor
              key={connectionId}
              x={cursor.x}
              y={cursor.y}
              color={user.color}
              name={user.name}
              avatar={user.avatar}
            />
          );
        })}
      </AnimatePresence>
    </div>
  );
}