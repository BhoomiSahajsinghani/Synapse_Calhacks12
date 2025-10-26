'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOthers, useSelf } from '@/liveblocks.config';
import { cn } from '@/lib/utils';

interface PresenceAvatarsProps {
  className?: string;
  maxAvatars?: number;
  size?: 'sm' | 'md' | 'lg';
}

function Avatar({
  name,
  avatar,
  color,
  size = 'md',
  isTyping = false,
}: {
  name: string;
  avatar?: string;
  color: string;
  size?: 'sm' | 'md' | 'lg';
  isTyping?: boolean;
}) {
  const sizeClasses = {
    sm: 'w-6 h-6 text-[10px]',
    md: 'w-8 h-8 text-xs',
    lg: 'w-10 h-10 text-sm',
  };

  return (
    <div className="relative group">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        whileHover={{ scale: 1.1 }}
        transition={{ duration: 0.2 }}
        className={cn(
          'relative rounded-full flex items-center justify-center font-medium text-white shadow-sm ring-2 ring-background',
          sizeClasses[size]
        )}
        style={{
          backgroundColor: color,
          borderColor: color,
        }}
      >
        {avatar ? (
          <img
            src={avatar}
            alt={name}
            className="w-full h-full rounded-full object-cover"
          />
        ) : (
          <span>{name.charAt(0).toUpperCase()}</span>
        )}

        {/* Typing indicator */}
        {isTyping && (
          <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-1 shadow-sm">
            <div className="flex gap-0.5">
              <motion.div
                className="w-1 h-1 bg-gray-500 rounded-full"
                animate={{ y: [0, -3, 0] }}
                transition={{
                  duration: 0.5,
                  repeat: Infinity,
                  delay: 0,
                }}
              />
              <motion.div
                className="w-1 h-1 bg-gray-500 rounded-full"
                animate={{ y: [0, -3, 0] }}
                transition={{
                  duration: 0.5,
                  repeat: Infinity,
                  delay: 0.1,
                }}
              />
              <motion.div
                className="w-1 h-1 bg-gray-500 rounded-full"
                animate={{ y: [0, -3, 0] }}
                transition={{
                  duration: 0.5,
                  repeat: Infinity,
                  delay: 0.2,
                }}
              />
            </div>
          </div>
        )}
      </motion.div>

      {/* Tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <div className="bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
          {name}
          {isTyping && ' (typing...)'}
        </div>
      </div>
    </div>
  );
}

export function PresenceAvatars({
  className,
  maxAvatars = 5,
  size = 'md',
}: PresenceAvatarsProps) {
  const others = useOthers();
  const self = useSelf();

  // Filter and map users
  const allUsers = React.useMemo(() => {
    const users = [];

    // Add self
    if (self?.presence?.user) {
      users.push({
        ...self.presence.user,
        connectionId: self.connectionId ? `self-${self.connectionId}` : `self-${Math.random().toString(36).substring(7)}`,
        isTyping: self.presence.isTyping,
        isSelf: true,
      });
    }

    // Add others
    others.forEach((other, index) => {
      if (other.presence?.user) {
        users.push({
          ...other.presence.user,
          connectionId: other.connectionId ? other.connectionId.toString() : `other-${index}-${Math.random().toString(36).substring(7)}`,
          isTyping: other.presence.isTyping,
          isSelf: false,
        });
      }
    });

    return users;
  }, [others, self]);

  const visibleUsers = allUsers.slice(0, maxAvatars);
  const remainingCount = allUsers.length - maxAvatars;

  return (
    <div className={cn('flex items-center', className)}>
      {/* Avatar stack */}
      <div className="flex -space-x-2">
        <AnimatePresence mode="popLayout">
          {visibleUsers.map((user) => (
            <Avatar
              key={user.connectionId}
              name={user.name}
              avatar={user.avatar}
              color={user.color}
              size={size}
              isTyping={user.isTyping}
            />
          ))}

          {/* Overflow indicator */}
          {remainingCount > 0 && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className={cn(
                'relative rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center font-medium text-gray-600 dark:text-gray-300 shadow-sm ring-2 ring-background',
                size === 'sm' ? 'w-6 h-6 text-[10px]' : '',
                size === 'md' ? 'w-8 h-8 text-xs' : '',
                size === 'lg' ? 'w-10 h-10 text-sm' : ''
              )}
            >
              +{remainingCount}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}