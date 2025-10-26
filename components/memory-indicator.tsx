'use client';

import { Brain, Database, Search, Plus } from 'lucide-react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface MemoryAction {
  id: string;
  type: 'add' | 'search';
  content: string;
  timestamp: Date;
  results?: any[];
}

interface MemoryIndicatorProps {
  className?: string;
  isActive?: boolean;
  onOpenMemories?: () => void;
}

export function MemoryIndicator({
  className = '',
  isActive = false,
  onOpenMemories
}: MemoryIndicatorProps) {
  const [recentActions, setRecentActions] = useState<MemoryAction[]>([]);
  const [showPulse, setShowPulse] = useState(false);

  useEffect(() => {
    if (isActive) {
      setShowPulse(true);
      const timer = setTimeout(() => setShowPulse(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [isActive]);

  // Subscribe to memory events (you can implement this based on your needs)
  useEffect(() => {
    const handleMemoryEvent = (event: CustomEvent) => {
      const action: MemoryAction = {
        id: `memory-${Date.now()}`,
        type: event.detail.type,
        content: event.detail.content,
        timestamp: new Date(),
        results: event.detail.results,
      };

      setRecentActions(prev => [action, ...prev].slice(0, 5));
    };

    window.addEventListener('memory-action' as any, handleMemoryEvent as any);
    return () => {
      window.removeEventListener('memory-action' as any, handleMemoryEvent as any);
    };
  }, []);

  const getActionIcon = (type: 'add' | 'search') => {
    switch (type) {
      case 'add':
        return <Plus className="h-3 w-3" />;
      case 'search':
        return <Search className="h-3 w-3" />;
    }
  };

  const getActionText = (action: MemoryAction) => {
    switch (action.type) {
      case 'add':
        return `Remembered: ${action.content.slice(0, 50)}${action.content.length > 50 ? '...' : ''}`;
      case 'search':
        return `Searched: ${action.content.slice(0, 50)}${action.content.length > 50 ? '...' : ''}`;
    }
  };

  return (
    <TooltipProvider>
      <div className={`relative ${className}`}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onOpenMemories}
              className="relative flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm transition-all hover:bg-gray-50 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
            >
              <Brain className={`h-4 w-4 ${isActive ? 'text-blue-500' : 'text-gray-500'}`} />
              <span className="hidden sm:inline text-gray-600 dark:text-gray-300">
                Memory
              </span>

              {/* Activity indicator */}
              {recentActions.length > 0 && (
                <span className="ml-1 flex h-2 w-2">
                  <span className="absolute inline-flex h-2 w-2 rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500"></span>
                </span>
              )}

              {/* Pulse animation when active */}
              <AnimatePresence>
                {showPulse && (
                  <motion.span
                    initial={{ scale: 1, opacity: 0.5 }}
                    animate={{ scale: 2, opacity: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1 }}
                    className="absolute inset-0 rounded-lg bg-blue-400"
                  />
                )}
              </AnimatePresence>
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <div className="space-y-2">
              <div className="flex items-center gap-2 font-medium">
                <Database className="h-3 w-3" />
                <span>Memory System</span>
              </div>
              {recentActions.length > 0 ? (
                <div className="space-y-1 text-xs">
                  <div className="text-gray-500 dark:text-gray-400">Recent activity:</div>
                  {recentActions.slice(0, 3).map((action) => (
                    <div key={action.id} className="flex items-start gap-1">
                      {getActionIcon(action.type)}
                      <span className="text-gray-600 dark:text-gray-300">
                        {getActionText(action)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  No recent memory activity
                </div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}