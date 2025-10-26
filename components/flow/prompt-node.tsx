'use client';

import { memo, useState, useRef, useEffect } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { motion } from 'framer-motion';
import { Send, X, ChevronDown, Brain, Sparkles } from 'lucide-react';
import type { UseChatHelpers } from '@ai-sdk/react';
import type { ChatMessage } from '@/lib/types';
import { chatModels, DEFAULT_CHAT_MODEL } from '@/lib/ai/models';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export type PromptNodeData = {
  sendMessage: UseChatHelpers<ChatMessage>['sendMessage'];
  status: UseChatHelpers<ChatMessage>['status'];
  onCancel?: () => void;
  parentNodeId?: string;
  creatorId?: string;
  creatorName?: string;
  creatorColor?: string;
  isBeingTyped?: boolean;
  typedBy?: string;
  selectedModel?: string;
  onModelChange?: (modelId: string) => void;
  memoryEnabled?: boolean;
  onMemoryToggle?: (enabled: boolean) => void;
};

export const PromptNode = memo((props: NodeProps) => {
  const { id, selected } = props;
  const data = props.data as PromptNodeData;
  const {
    sendMessage,
    status,
    onCancel,
    creatorName,
    creatorColor,
    isBeingTyped,
    typedBy,
    selectedModel = DEFAULT_CHAT_MODEL,
    onModelChange,
    memoryEnabled = false,
    onMemoryToggle
  } = data;
  const [input, setInput] = useState('');
  const [currentModel, setCurrentModel] = useState(selectedModel);
  const [isMemoryEnabled, setIsMemoryEnabled] = useState(memoryEnabled);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isDisabled = status === 'streaming' || status === 'submitted';
  const [hoveredHandle, setHoveredHandle] = useState<string | null>(null);

  // Debug log to check if node is properly configured
  useEffect(() => {
    if (!sendMessage) {
      console.warn(`PromptNode ${id}: sendMessage is not defined`);
    }
    if (isDisabled) {
      console.warn(`PromptNode ${id}: input is disabled (status: ${status})`);
    }
  }, [id, sendMessage, status, isDisabled]);

  useEffect(() => {
    // Auto-focus on mount
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  const handleModelChange = (modelId: string) => {
    setCurrentModel(modelId);
    onModelChange?.(modelId);
  };

  const handleMemoryToggle = (enabled: boolean) => {
    setIsMemoryEnabled(enabled);
    onMemoryToggle?.(enabled);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isDisabled) return;

    if (!sendMessage) {
      return;
    }

    console.log('📤 Submitting prompt from node:', id, 'with text:', input, 'using model:', currentModel, 'memory:', isMemoryEnabled);

    // Send the message with the selected model and memory settings
    sendMessage({
      role: 'user',
      parts: [{ type: 'text', text: input }],
      model: currentModel,
      memoryEnabled: isMemoryEnabled,
    } as any);

    // Clear input immediately for better UX
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
    if (e.key === 'Escape') {
      onCancel?.();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      className="group/prompt relative"
    >
      {/* Top Handles */}
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

      {/* Left Handles */}
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

      {/* Right Handles */}
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
        } ${isBeingTyped ? 'ring-2 ring-yellow-400' : ''}`}
        style={{
          borderColor: selected ? creatorColor || '#6b7280' : '#e5e7eb',
          ringColor: selected ? creatorColor || '#6b7280' : undefined,
        }}
      >
        {/* Creator/Typing Indicator */}
        {(creatorName || isBeingTyped) && (
          <div
            className="flex items-center gap-2 px-3 py-1.5 text-xs"
            style={{ backgroundColor: isBeingTyped ? '#fef3c7' : `${creatorColor}20` }}
          >
            {creatorName && (
              <div
                className="flex h-5 w-5 items-center justify-center rounded-full text-white text-[10px] font-medium"
                style={{ backgroundColor: creatorColor || '#6b7280' }}
              >
                {creatorName.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="text-gray-600 dark:text-gray-400">
              {isBeingTyped && typedBy ? (
                <span className="flex items-center gap-1">
                  <span>{typedBy} is typing</span>
                  <span className="flex gap-0.5">
                    <motion.span
                      className="inline-block h-1 w-1 rounded-full bg-yellow-600"
                      animate={{ y: [0, -3, 0] }}
                      transition={{ duration: 0.5, repeat: Infinity }}
                    />
                    <motion.span
                      className="inline-block h-1 w-1 rounded-full bg-yellow-600"
                      animate={{ y: [0, -3, 0] }}
                      transition={{ duration: 0.5, repeat: Infinity, delay: 0.1 }}
                    />
                    <motion.span
                      className="inline-block h-1 w-1 rounded-full bg-yellow-600"
                      animate={{ y: [0, -3, 0] }}
                      transition={{ duration: 0.5, repeat: Infinity, delay: 0.2 }}
                    />
                  </span>
                </span>
              ) : (
                creatorName
              )}
            </span>
          </div>
        )}

        {/* Header - minimal */}
        <div className='flex items-center justify-between border-b border-gray-100 px-3 py-2 dark:border-gray-800'>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Prompt
          </span>
          {onCancel && (
            <button
              onClick={onCancel}
              className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
              type="button"
              aria-label="Cancel"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="p-3">
          {/* Model Selector and Memory Toggle */}
          <div className="mb-2 space-y-2">
            <Select
              value={currentModel}
              onValueChange={handleModelChange}
              disabled={isDisabled}
            >
              <SelectTrigger className="w-full h-8 text-xs border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                <SelectValue placeholder="Select a model" />
              </SelectTrigger>
              <SelectContent className="z-[9999]">
                {chatModels.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    <div className="flex flex-col">
                      <span className="font-medium">{model.name}</span>
                      {model.provider && (
                        <span className="text-[10px] text-muted-foreground">
                          {model.provider === 'anthropic' ? 'Anthropic' : 'Google'}
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Memory Toggle */}
            <div className="flex items-center justify-between p-2 rounded bg-gray-50 dark:bg-gray-900">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Label
                      htmlFor={`memory-toggle-${id}`}
                      className="text-xs flex items-center gap-2 cursor-pointer"
                    >
                      <Brain className="h-3 w-3 text-gray-500" />
                      <span>Use Memory</span>
                    </Label>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Enable to use memory system for context and learning</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Switch
                id={`memory-toggle-${id}`}
                checked={isMemoryEnabled}
                onCheckedChange={handleMemoryToggle}
                disabled={isDisabled}
                className="scale-75"
              />
            </div>

            {/* Reasoning Indicator */}
            {currentModel === 'chat-model-reasoning' && (
              <div className="px-2 py-1 rounded bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800/50">
                <div className="flex items-center gap-1.5 text-[10px] text-purple-600 dark:text-purple-400">
                  <Sparkles className="h-3 w-3" />
                  <span className="font-medium">Reasoning Mode Active</span>
                  <span className="text-[9px] opacity-70">• Shows chain of thought</span>
                </div>
              </div>
            )}
          </div>

          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            disabled={isDisabled}
            placeholder="Type your message..."
            rows={3}
            className="w-full resize-none border-0 bg-transparent px-0 py-0 text-sm outline-none placeholder:text-gray-400 focus:ring-0 disabled:cursor-not-allowed disabled:opacity-50 dark:placeholder:text-gray-500"
            style={{ maxHeight: '200px', minHeight: '60px' }}
          />

          <div className="mt-2 flex items-center justify-between">
            <div className="text-[10px] text-gray-400">
              {chatModels.find(m => m.id === currentModel)?.name || 'Unknown Model'}
            </div>
            <button
              type="submit"
              disabled={isDisabled || !input.trim()}
              className='rounded px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-30 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200'
            >
              Send →
            </button>
          </div>
        </form>
      </div>

      {/* Bottom Handles */}
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

PromptNode.displayName = 'PromptNode';
