import type { NodeLock } from '@/liveblocks.config';
import { LOCK_TIMEOUT_MS, isLockExpired } from '@/liveblocks.config';

export interface LockRequest {
  nodeId: string;
  userId: string;
  userName: string;
  timestamp: number;
}

class NodeLockManager {
  private lockRequests: Map<string, LockRequest[]> = new Map();
  private lockCallbacks: Map<string, (granted: boolean) => void> = new Map();

  /**
   * Request a lock for a node
   */
  requestLock(
    nodeId: string,
    userId: string,
    userName: string,
    currentLock: NodeLock | null,
    acquireLockFn: (nodeId: string) => boolean,
    callback?: (granted: boolean) => void
  ): boolean {
    // If no current lock or lock is expired, grant immediately
    if (!currentLock || isLockExpired(currentLock)) {
      const granted = acquireLockFn(nodeId);
      callback?.(granted);
      return granted;
    }

    // If current user already has the lock, renew it
    if (currentLock.userId === userId) {
      const granted = acquireLockFn(nodeId);
      callback?.(granted);
      return granted;
    }

    // Add to request queue
    const request: LockRequest = {
      nodeId,
      userId,
      userName,
      timestamp: Date.now(),
    };

    const requests = this.lockRequests.get(nodeId) || [];
    requests.push(request);
    this.lockRequests.set(nodeId, requests);

    // Store callback
    if (callback) {
      this.lockCallbacks.set(`${nodeId}-${userId}`, callback);
    }

    return false;
  }

  /**
   * Process queued lock requests when a lock is released
   */
  processLockQueue(
    nodeId: string,
    acquireLockFn: (nodeId: string) => boolean
  ): void {
    const requests = this.lockRequests.get(nodeId);
    if (!requests || requests.length === 0) return;

    // Get the oldest request
    const nextRequest = requests.shift();
    if (!nextRequest) return;

    // Try to grant the lock
    const granted = acquireLockFn(nodeId);

    // Execute callback if exists
    const callbackKey = `${nodeId}-${nextRequest.userId}`;
    const callback = this.lockCallbacks.get(callbackKey);
    if (callback) {
      callback(granted);
      this.lockCallbacks.delete(callbackKey);
    }

    // Update the queue
    if (requests.length === 0) {
      this.lockRequests.delete(nodeId);
    } else {
      this.lockRequests.set(nodeId, requests);
    }
  }

  /**
   * Cancel a lock request
   */
  cancelLockRequest(nodeId: string, userId: string): void {
    const requests = this.lockRequests.get(nodeId);
    if (!requests) return;

    const filtered = requests.filter(r => r.userId !== userId);
    if (filtered.length === 0) {
      this.lockRequests.delete(nodeId);
    } else {
      this.lockRequests.set(nodeId, filtered);
    }

    // Remove callback
    this.lockCallbacks.delete(`${nodeId}-${userId}`);
  }

  /**
   * Get pending lock requests for a node
   */
  getPendingRequests(nodeId: string): LockRequest[] {
    return this.lockRequests.get(nodeId) || [];
  }

  /**
   * Clear all requests for a node
   */
  clearNodeRequests(nodeId: string): void {
    const requests = this.lockRequests.get(nodeId) || [];

    // Call all callbacks with false
    requests.forEach(request => {
      const callbackKey = `${nodeId}-${request.userId}`;
      const callback = this.lockCallbacks.get(callbackKey);
      if (callback) {
        callback(false);
        this.lockCallbacks.delete(callbackKey);
      }
    });

    this.lockRequests.delete(nodeId);
  }

  /**
   * Clean up expired requests
   */
  cleanupExpiredRequests(maxAge: number = LOCK_TIMEOUT_MS): void {
    const now = Date.now();

    this.lockRequests.forEach((requests, nodeId) => {
      const filtered = requests.filter(r => now - r.timestamp < maxAge);

      // Call callbacks for expired requests
      requests.forEach(request => {
        if (now - request.timestamp >= maxAge) {
          const callbackKey = `${nodeId}-${request.userId}`;
          const callback = this.lockCallbacks.get(callbackKey);
          if (callback) {
            callback(false);
            this.lockCallbacks.delete(callbackKey);
          }
        }
      });

      if (filtered.length === 0) {
        this.lockRequests.delete(nodeId);
      } else {
        this.lockRequests.set(nodeId, filtered);
      }
    });
  }
}

// Singleton instance
export const lockManager = new NodeLockManager();

/**
 * Helper function to format lock status for UI
 */
export function formatLockStatus(lock: NodeLock | null, currentUserId: string): {
  isLocked: boolean;
  isOwnLock: boolean;
  lockedBy: string | null;
  expiresIn: number | null;
} {
  if (!lock || isLockExpired(lock)) {
    return {
      isLocked: false,
      isOwnLock: false,
      lockedBy: null,
      expiresIn: null,
    };
  }

  const expiresIn = Math.max(0, lock.expiresAt - Date.now());

  return {
    isLocked: true,
    isOwnLock: lock.userId === currentUserId,
    lockedBy: lock.userName,
    expiresIn,
  };
}

/**
 * Format time remaining for lock expiry
 */
export function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return 'Expired';

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);

  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}