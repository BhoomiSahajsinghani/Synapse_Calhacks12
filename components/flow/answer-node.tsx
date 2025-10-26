'use client';

import { memo, useState, useEffect } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { motion, AnimatePresence } from 'framer-motion';
import { SparklesIcon } from '../icons';
import { Response } from '../elements/response';
import { MessageContent } from '../elements/message';
import { sanitizeText } from '@/lib/utils';
import type { ChatMessage } from '@/lib/types';
import { User, Plus, ChevronDown, ChevronUp } from 'lucide-react';

export type AnswerNodeData = {
  userMessage: ChatMessage;
  assistantMessage?: ChatMessage;
  isLoading?: boolean;
  onAddNewNode?: (parentId: string) => void;
  creatorId?: string;
  creatorName?: string;
  creatorColor?: string;
  isBeingEdited?: boolean;
  editedBy?: string;
};

export const AnswerNode = memo((props: NodeProps) => {
  const { id, selected } = props;
  const data = props.data as AnswerNodeData;
  const {
    userMessage,
    assistantMessage,
    isLoading,
    onAddNewNode,
    creatorName,
    creatorColor,
    isBeingEdited,
    editedBy
  } = data;
  const [isResponseExpanded, setIsResponseExpanded] = useState(true);
  const [showSkeleton, setShowSkeleton] = useState(isLoading);

  useEffect(() => {
    if (isLoading) {
      setShowSkeleton(true);
    } else if (assistantMessage) {
      // Add a small delay before hiding skeleton for smooth transition
      const timer = setTimeout(() => setShowSkeleton(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isLoading, assistantMessage]);

  const userTextPart = userMessage?.parts?.find((part: any) => part.type === 'text');
  const assistantTextPart = assistantMessage?.parts?.find((part: any) => part.type === 'text');
  const hasAssistantContent = assistantTextPart?.type === 'text' && assistantTextPart.text;

  const toggleResponse = () => {
    setIsResponseExpanded(!isResponseExpanded);
  };

  const handleAddNewNode = () => {
    onAddNewNode?.(id);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="group/answer relative"
    >
      {/* Top Handle */}
      <Handle
        type="target"
        position={Position.Top}
        className="!h-2 !w-2 !border !border-gray-300 !bg-white dark:!border-gray-600 dark:!bg-gray-800"
        id="top"
      />
      <Handle
        type="source"
        position={Position.Top}
        className="!h-2 !w-2 !border !border-gray-300 !bg-white dark:!border-gray-600 dark:!bg-gray-800 !left-[55%]"
        id="top-source"
      />

      {/* Left Handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2 !w-2 !border !border-gray-300 !bg-white dark:!border-gray-600 dark:!bg-gray-800"
        id="left"
      />
      <Handle
        type="source"
        position={Position.Left}
        className="!h-2 !w-2 !border !border-gray-300 !bg-white dark:!border-gray-600 dark:!bg-gray-800 !top-[55%]"
        id="left-source"
      />

      {/* Right Handle */}
      <Handle
        type="target"
        position={Position.Right}
        className="!h-2 !w-2 !border !border-gray-300 !bg-white dark:!border-gray-600 dark:!bg-gray-800 !top-[45%]"
        id="right"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!h-2 !w-2 !border !border-gray-300 !bg-white dark:!border-gray-600 dark:!bg-gray-800"
        id="right-source"
      />

      <div
        className={`w-[500px] overflow-hidden rounded-lg bg-white shadow-sm dark:bg-gray-900 transition-all duration-200 ${
          selected ? 'ring-2' : 'border'
        } ${isBeingEdited ? 'ring-2 ring-orange-400 animate-pulse' : ''}`}
        style={{
          borderColor: selected ? creatorColor || '#6b7280' : '#e5e7eb',
          ringColor: selected ? creatorColor || '#6b7280' : undefined,
        }}
      >
        {/* Creator Indicator */}
        {creatorName && (
          <div
            className="flex items-center gap-2 px-3 py-1.5 text-xs"
            style={{ backgroundColor: `${creatorColor}20` }}
          >
            <div
              className="flex h-5 w-5 items-center justify-center rounded-full text-white text-[10px] font-medium"
              style={{ backgroundColor: creatorColor || '#6b7280' }}
            >
              {creatorName.charAt(0).toUpperCase()}
            </div>
            <span className="text-gray-600 dark:text-gray-400">
              {creatorName}
              {isBeingEdited && editedBy && editedBy !== creatorName && (
                <span className="ml-2 text-orange-600 dark:text-orange-400">
                  (editing: {editedBy})
                </span>
              )}
            </span>
          </div>
        )}

        {/* User Prompt Section - minimal */}
        <div className='border-b border-gray-100 p-3 dark:border-gray-800'>
          <div className="mb-1 text-xs text-gray-500 dark:text-gray-400">
            Prompt
          </div>
          <div className="text-sm text-gray-700 dark:text-gray-300">
            {sanitizeText(userTextPart?.type === 'text' ? userTextPart.text : '')}
          </div>
        </div>

        {/* Assistant Response Section - minimal */}
        <div className="p-3">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Response
            </span>
            {!showSkeleton && hasAssistantContent && (
              <button
                onClick={toggleResponse}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                type="button"
              >
                {isResponseExpanded ? (
                  <ChevronUp size={14} />
                ) : (
                  <ChevronDown size={14} />
                )}
              </button>
            )}
          </div>

          {/* Response Content */}
          <AnimatePresence mode="wait">
            {isResponseExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className='pt-1'>
                  {showSkeleton ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1">
                        <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-gray-400" />
                        <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-gray-400" style={{ animationDelay: '150ms' }} />
                        <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-gray-400" style={{ animationDelay: '300ms' }} />
                      </div>
                      <div className="space-y-1">
                        <div className="h-2 w-full animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                        <div className="h-2 w-5/6 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                        <div className="h-2 w-4/6 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                      </div>
                    </div>
                  ) : assistantMessage ? (
                    <div className="text-sm text-gray-700 dark:text-gray-300">
                      {sanitizeText(assistantTextPart?.type === 'text' ? assistantTextPart.text : '')}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-400 dark:text-gray-500 italic">
                      Waiting for response...
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* New Node Button - minimal */}
        {!showSkeleton && assistantMessage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="border-t border-gray-100 p-2 dark:border-gray-800"
          >
            <button
              onClick={handleAddNewNode}
              className="flex w-full items-center justify-center gap-1 rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-50 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
              type="button"
            >
              <Plus size={14} />
              Add Follow-up
            </button>
          </motion.div>
        )}
      </div>

      {/* Bottom Handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-2 !w-2 !border !border-gray-300 !bg-white dark:!border-gray-600 dark:!bg-gray-800"
        id="bottom"
      />
      <Handle
        type="target"
        position={Position.Bottom}
        className="!h-2 !w-2 !border !border-gray-300 !bg-white dark:!border-gray-600 dark:!bg-gray-800 !left-[45%]"
        id="bottom-target"
      />
    </motion.div>
  );
});

AnswerNode.displayName = 'AnswerNode';