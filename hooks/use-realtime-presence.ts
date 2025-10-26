import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  useMyPresence,
  useOthers,
  useOthersMapped,
  useUpdateMyPresence,
  useBroadcastEvent,
  useEventListener,
  useSelf,
} from '@/liveblocks.config';
import { generateUserColor } from '@/liveblocks.config';
import { throttle } from '@/lib/utils';

interface Cursor {
  x: number;
  y: number;
}

interface User {
  id: string;
  name: string;
  avatar?: string;
  color: string;
}

interface UseRealtimePresenceProps {
  containerRef?: React.RefObject<HTMLElement>;
  userId?: string;
  userName?: string;
  userAvatar?: string;
}

export function useRealtimePresence({
  containerRef,
  userId = 'anonymous',
  userName = 'Anonymous',
  userAvatar,
}: UseRealtimePresenceProps = {}) {
  const [myPresence, updateMyPresence] = useMyPresence();
  const others = useOthers();
  const self = useSelf();
  const broadcastEvent = useBroadcastEvent();

  // Generate consistent user color - memoize to prevent regeneration
  const userColor = React.useMemo(() => generateUserColor(userId), [userId]);

  // Initialize user presence - only on mount or when critical props change
  useEffect(() => {
    updateMyPresence({
      user: {
        id: userId,
        name: userName,
        avatar: userAvatar,
        color: userColor,
      },
      cursor: null,
      selectedNodeId: null,
      isTyping: false,
      viewportPosition: null,
      followingUserId: null,
    });
    // Only re-run if user identity changes, not updateMyPresence
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, userName, userAvatar, userColor]);

  // Update cursor position with throttling
  const updateCursorPosition = useRef(
    throttle((cursor: Cursor | null) => {
      updateMyPresence({ cursor });
    }, 16) // ~60fps
  ).current;

  // Handle mouse move for cursor tracking
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!containerRef?.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    updateCursorPosition({ x, y });
  }, [containerRef, updateCursorPosition]);

  // Handle mouse leave
  const handleMouseLeave = useCallback(() => {
    updateCursorPosition(null);
  }, [updateCursorPosition]);

  // Set up mouse event listeners
  useEffect(() => {
    const container = containerRef?.current;
    if (!container) return;

    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [containerRef, handleMouseMove, handleMouseLeave]);

  // Update selected node
  const setSelectedNode = useCallback((nodeId: string | null) => {
    updateMyPresence({ selectedNodeId: nodeId });
  }, [updateMyPresence]);

  // Update typing status
  const setIsTyping = useCallback((isTyping: boolean, nodeId?: string) => {
    updateMyPresence({ isTyping });
    if (nodeId) {
      broadcastEvent({
        type: 'user-typing',
        nodeId,
        userId,
        isTyping,
      });
    }
  }, [updateMyPresence, broadcastEvent, userId]);

  // Typing indicator with auto-stop
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  const handleTyping = useCallback((nodeId: string) => {
    setIsTyping(true, nodeId);

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false, nodeId);
    }, 3000); // Stop after 3 seconds of no typing
  }, [setIsTyping]);

  // Update viewport position
  const updateViewport = useCallback((position: { x: number; y: number; zoom: number } | null) => {
    updateMyPresence({ viewportPosition: position });
  }, [updateMyPresence]);

  // Follow another user
  const [followingUser, setFollowingUser] = useState<string | null>(null);

  const followUser = useCallback((targetUserId: string | null) => {
    setFollowingUser(targetUserId);
    updateMyPresence({ followingUserId: targetUserId });
  }, [updateMyPresence]);

  // Get other users' presence data
  const otherUsers = useOthersMapped((other) => ({
    id: other.connectionId.toString(),
    user: other.presence?.user,
    cursor: other.presence?.cursor,
    selectedNodeId: other.presence?.selectedNodeId,
    isTyping: other.presence?.isTyping,
    viewportPosition: other.presence?.viewportPosition,
    followingUserId: other.presence?.followingUserId,
  }));

  // Get users who are following the current user
  const followers = otherUsers.filter(
    ([_, user]) => user.followingUserId === userId
  );

  // Get the user being followed
  const followedUser = followingUser
    ? otherUsers.find(([_, user]) => user.user?.id === followingUser)?.[1]
    : null;

  // Listen for typing events
  useEventListener(({ event }) => {
    if (event.type === 'user-typing') {
      // Handle typing event if needed for UI updates
    }
  });

  // Count of active users
  const activeUserCount = others.length + 1; // +1 for self

  // Get users by their activity
  const getUsersOnNode = useCallback((nodeId: string) => {
    return otherUsers
      .filter(([_, user]) => user.selectedNodeId === nodeId)
      .map(([_, user]) => user.user)
      .filter(Boolean);
  }, [otherUsers]);

  const getTypingUsers = useCallback(() => {
    return otherUsers
      .filter(([_, user]) => user.isTyping)
      .map(([_, user]) => user.user)
      .filter(Boolean);
  }, [otherUsers]);

  return {
    // Current user
    myPresence,
    userColor,

    // Presence updates
    setSelectedNode,
    setIsTyping,
    handleTyping,
    updateViewport,
    updateCursorPosition,

    // Following
    followUser,
    followingUser,
    followedUser,
    followers,

    // Other users
    otherUsers,
    activeUserCount,
    getUsersOnNode,
    getTypingUsers,
  };
}