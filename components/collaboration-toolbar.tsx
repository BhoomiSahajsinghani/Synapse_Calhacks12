'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOthers, useSelf, useStatus } from '@/liveblocks.config';
import { cn } from '@/lib/utils';
import { PresenceAvatars } from '@/components/flow/presence-avatars';
import { Users, Wifi, WifiOff, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface CollaborationToolbarProps {
  className?: string;
  followingUser?: string | null;
  onFollowUser?: (userId: string | null) => void;
  onTogglePresence?: () => void;
  showPresence?: boolean;
}

export function CollaborationToolbar({
  className,
  followingUser,
  onFollowUser,
  onTogglePresence,
  showPresence = true,
}: CollaborationToolbarProps) {
  const others = useOthers();
  const self = useSelf();
  const roomStatus = useStatus();
  const [isExpanded, setIsExpanded] = React.useState(false);

  // Connection status
  const isConnected = roomStatus === 'connected';
  const isConnecting = roomStatus === 'connecting';
  const isReconnecting = roomStatus === 'reconnecting';

  // Get list of other users
  const otherUsers = React.useMemo(() => {
    return others.map(other => ({
      id: other.connectionId.toString(),
      name: other.presence?.user?.name || 'Anonymous',
      avatar: other.presence?.user?.avatar,
      color: other.presence?.user?.color || '#666',
      isTyping: other.presence?.isTyping || false,
    }));
  }, [others]);

  // Total user count including self
  const totalUsers = others.length + 1;

  return (
    <TooltipProvider>
      <div
        className={cn(
          'flex items-center gap-2 p-2 bg-background/80 backdrop-blur-sm border rounded-lg shadow-sm',
          className
        )}
      >
        {/* Connection Status */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5">
              {isConnected && (
                <>
                  <Wifi className="h-4 w-4 text-green-500" />
                  <span className="text-xs text-green-500 font-medium">Live</span>
                </>
              )}
              {isConnecting && (
                <>
                  <motion.div
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    <Wifi className="h-4 w-4 text-yellow-500" />
                  </motion.div>
                  <span className="text-xs text-yellow-500 font-medium">Connecting...</span>
                </>
              )}
              {isReconnecting && (
                <>
                  <motion.div
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    <Wifi className="h-4 w-4 text-orange-500" />
                  </motion.div>
                  <span className="text-xs text-orange-500 font-medium">Reconnecting...</span>
                </>
              )}
              {!isConnected && !isConnecting && !isReconnecting && (
                <>
                  <WifiOff className="h-4 w-4 text-gray-500" />
                  <span className="text-xs text-gray-500 font-medium">Offline</span>
                </>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{isConnected ? 'Connected to collaboration server' : 'Connection lost'}</p>
          </TooltipContent>
        </Tooltip>

        {/* Separator */}
        <div className="h-4 w-px bg-border" />

        {/* User Count */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 gap-1"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              <Users className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">{totalUsers}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{totalUsers} {totalUsers === 1 ? 'user' : 'users'} online</p>
          </TooltipContent>
        </Tooltip>


        {/* Follow User Dropdown */}
        {otherUsers.length > 0 && (
          <>
            <div className="h-4 w-px bg-border" />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={followingUser ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 px-2 gap-1"
                  onClick={() => {
                    // Toggle follow mode
                    if (followingUser) {
                      onFollowUser?.(null);
                    } else if (otherUsers.length > 0) {
                      // Follow first available user
                      onFollowUser?.(otherUsers[0].id);
                    }
                  }}
                >
                  <Eye className="h-3.5 w-3.5" />
                  {followingUser && (
                    <span className="text-xs">
                      Following {otherUsers.find(u => u.id === followingUser)?.name || 'User'}
                    </span>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{followingUser ? 'Stop following' : 'Follow a user'}</p>
              </TooltipContent>
            </Tooltip>
          </>
        )}

        {/* Toggle Presence Visibility */}
        <div className="h-4 w-px bg-border" />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={onTogglePresence}
            >
              {showPresence ? (
                <Eye className="h-3.5 w-3.5" />
              ) : (
                <EyeOff className="h-3.5 w-3.5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{showPresence ? 'Hide cursors' : 'Show cursors'}</p>
          </TooltipContent>
        </Tooltip>

        {/* User List Popover */}
        {isExpanded && otherUsers.length > 0 && (
          <div className="absolute top-full mt-2 right-0 z-50 w-64 p-2 bg-background border rounded-lg shadow-lg">
            <div className="text-xs font-medium text-muted-foreground mb-2">
              Online Users ({totalUsers})
            </div>

            {/* Current User */}
            <div className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium text-white"
                style={{ backgroundColor: self?.presence?.user?.color || '#666' }}
              >
                {self?.presence?.user?.name?.charAt(0).toUpperCase() || '?'}
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium">
                  {self?.presence?.user?.name || 'You'} (You)
                </div>
                {self?.presence?.isTyping && (
                  <div className="text-xs text-muted-foreground">Typing...</div>
                )}
              </div>
            </div>

            {/* Other Users */}
            {otherUsers.map(user => (
              <div
                key={user.id}
                className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50 cursor-pointer"
                onClick={() => onFollowUser?.(user.id)}
              >
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium text-white"
                  style={{ backgroundColor: user.color }}
                >
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium">{user.name}</div>
                  {user.isTyping && (
                    <div className="text-xs text-muted-foreground">Typing...</div>
                  )}
                </div>
                {followingUser === user.id && (
                  <Eye className="h-3 w-3 text-primary" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}