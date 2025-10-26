'use client';

import React, { memo } from 'react';
import { useOthers, useSelf } from '@/liveblocks.config';
import { motion, AnimatePresence } from 'framer-motion';

export const CollaboratorList = memo(() => {
  const others = useOthers();
  const self = useSelf();

  const allUsers = React.useMemo(() => {
    const users = [
      ...(self ? [{
        id: self.id ? `self-${self.id}` : `self-${Math.random().toString(36).substring(7)}`,
        name: self.info?.name || 'You',
        color: self.info?.color || '#888',
        isCurrentUser: true
      }] : []),
      ...others.map((other, index) => ({
        id: other.id ? `other-${other.id}` : `other-${index}-${Math.random().toString(36).substring(7)}`,
        name: other.info?.name || 'Anonymous',
        color: other.info?.color || '#888',
        isCurrentUser: false
      }))
    ].filter(user => user.id && user.id.length > 0); // Filter out any users with empty IDs

    // Debug: Check for duplicate keys
    const ids = users.map(u => u.id);
    const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
    if (duplicates.length > 0) {
      console.warn('Duplicate IDs in CollaboratorList:', duplicates);
    }

    return users;
  }, [self, others]);

  if (allUsers.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="absolute top-4 left-4 z-10 rounded-lg border border-gray-200 bg-white/90 p-3 shadow-sm backdrop-blur-sm dark:border-gray-700 dark:bg-gray-900/90"
    >
      <div className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">
        Collaborators ({allUsers.length})
      </div>

      <div className="space-y-2">
        <AnimatePresence mode="wait">
          {allUsers.map((user) => (
            <motion.div
              key={user.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="flex items-center gap-2"
            >
              {/* Color indicator */}
              <div
                className="h-3 w-3 rounded-full border border-gray-200 dark:border-gray-600"
                style={{ backgroundColor: user.color }}
              />

              {/* User name */}
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {user.name}
                {user.isCurrentUser && (
                  <span className="ml-1 text-xs text-gray-400 dark:text-gray-500">
                    (You)
                  </span>
                )}
              </span>

              {/* Edge count (if we want to show it) */}
              <div className="ml-auto">
                <div
                  className="h-1 w-12 rounded"
                  style={{
                    background: `linear-gradient(90deg, ${user.color} 0%, ${user.color}80 100%)`,
                  }}
                  title="Edge color"
                />
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Collaboration info */}
      <div className="mt-3 border-t border-gray-100 pt-2 dark:border-gray-800">
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Edges show each user&apos;s color
        </p>
      </div>
    </motion.div>
  );
});

CollaboratorList.displayName = 'CollaboratorList';