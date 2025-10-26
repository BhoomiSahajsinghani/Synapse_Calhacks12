'use client';

import { memo, useState, useEffect } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { motion, AnimatePresence } from 'framer-motion';
import { SparklesIcon } from '../icons';
import { Response } from '../elements/response';
import { MessageContent } from '../elements/message';
import { sanitizeText } from '@/lib/utils';
import type { ChatMessage } from '@/lib/types';
import { User, Plus, ChevronDown, ChevronUp, Bot, Brain, Sparkles } from 'lucide-react';
import { chatModels } from '@/lib/ai/models';

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
  isStorageReady?: boolean;
  modelUsed?: string;
  memoryUsed?: boolean;
  memoriesAdded?: number;
  memoriesSearched?: number;
  reasoning?: string;
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
    editedBy,
    isStorageReady = true,
    modelUsed,
    memoryUsed = false,
    memoriesAdded = 0,
    memoriesSearched = 0,
    reasoning
  } = data;
  const [isResponseExpanded, setIsResponseExpanded] = useState(true);
  const [isReasoningExpanded, setIsReasoningExpanded] = useState(false);
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
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Response
              </span>
              {modelUsed && (
                <span className="flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-500">
                  <Bot size={10} />
                  {chatModels.find(m => m.id === modelUsed)?.name || modelUsed}
                  {reasoning && (
                    <>
                      <span className="text-gray-300 dark:text-gray-600">•</span>
                      <Sparkles size={10} className="text-purple-500" />
                    </>
                  )}
                </span>
              )}
              {memoryUsed && (
                <span className="flex items-center gap-1 text-[10px] text-blue-500 dark:text-blue-400">
                  <Brain size={10} />
                  Memory
                  {(memoriesAdded > 0 || memoriesSearched > 0) && (
                    <span className="text-[9px]">
                      ({memoriesSearched > 0 && `${memoriesSearched} recalled`}
                      {memoriesSearched > 0 && memoriesAdded > 0 && ', '}
                      {memoriesAdded > 0 && `${memoriesAdded} saved`})
                    </span>
                  )}
                </span>
              )}
            </div>
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

          {/* Reasoning Section - Enhanced Dropdown */}
          {reasoning && !showSkeleton && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="mt-3 border-t border-gray-100 dark:border-gray-800 pt-3"
            >
              <button
                onClick={() => setIsReasoningExpanded(!isReasoningExpanded)}
                className="group flex items-center justify-between w-full px-2 py-1.5 rounded-md text-xs transition-all hover:bg-purple-50 dark:hover:bg-purple-950/30"
                type="button"
              >
                <div className="flex items-center gap-2">
                  <motion.div
                    animate={{ rotate: isReasoningExpanded ? 360 : 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Sparkles
                      size={14}
                      className="text-purple-500 dark:text-purple-400"
                    />
                  </motion.div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    Chain of Thought
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-600 dark:bg-purple-900/50 dark:text-purple-400">
                    Reasoning
                  </span>
                </div>
                <motion.div
                  animate={{ rotate: isReasoningExpanded ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                  className="text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300"
                >
                  <ChevronDown size={14} />
                </motion.div>
              </button>

              <AnimatePresence mode="wait">
                {isReasoningExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{
                      height: {
                        duration: 0.3,
                        ease: [0.4, 0.0, 0.2, 1]
                      },
                      opacity: {
                        duration: 0.2
                      }
                    }}
                    className="overflow-hidden"
                  >
                    <div className="mt-2 mx-2">
                      <div className="relative rounded-lg bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/30 border border-purple-200 dark:border-purple-800/50 p-3">
                        {/* Decorative element */}
                        <div className="absolute top-2 right-2 opacity-20">
                          <Brain size={20} className="text-purple-600 dark:text-purple-400" />
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center gap-1.5 mb-2">
                            <div className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-pulse" />
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                              Model Reasoning Process
                            </span>
                          </div>

                          <div className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono leading-relaxed max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-purple-300 dark:scrollbar-thumb-purple-700 scrollbar-track-transparent">
                            {reasoning.split('\n').map((line, idx) => (
                              <div key={idx} className="py-0.5">
                                {line}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
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
              disabled={!isStorageReady}
              className={`flex w-full items-center justify-center gap-1 rounded px-2 py-1 text-xs ${
                isStorageReady
                  ? 'text-gray-500 hover:bg-gray-50 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200'
                  : 'text-gray-400 cursor-not-allowed opacity-50'
              }`}
              type="button"
              title={!isStorageReady ? 'Waiting for connection...' : undefined}
            >
              <Plus size={14} />
              {isStorageReady ? 'Add Follow-up' : 'Connecting...'}
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