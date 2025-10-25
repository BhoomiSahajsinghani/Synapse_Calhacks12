'use client';

import { memo, useState, useRef, useEffect } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { motion } from 'framer-motion';
import { Send, X } from 'lucide-react';
import type { UseChatHelpers } from '@ai-sdk/react';
import type { ChatMessage } from '@/lib/types';

export type PromptNodeData = {
  sendMessage: UseChatHelpers<ChatMessage>['sendMessage'];
  status: UseChatHelpers<ChatMessage>['status'];
  onCancel?: () => void;
  parentNodeId?: string;
};

export const PromptNode = memo(({ id, data }: NodeProps<PromptNodeData>) => {
  const { sendMessage, status, onCancel } = data;
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isDisabled = status === 'streaming' || status === 'submitted';

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isDisabled) return;

    sendMessage({
      role: 'user',
      parts: [{ type: 'text', text: input }],
    });

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
      className="group/prompt"
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!h-3 !w-3 !border-2 !border-green-500 !bg-green-500/20"
      />

      <div className="min-w-[400px] max-w-[600px] overflow-hidden rounded-xl border-2 border-green-500/50 bg-background shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-gradient-to-br from-green-50/50 to-emerald-50/50 px-4 py-2 dark:from-green-950/20 dark:to-emerald-950/20">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
            <span className="font-semibold text-green-900 text-xs uppercase tracking-wide dark:text-green-300">
              New Prompt
            </span>
          </div>
          {onCancel && (
            <button
              onClick={onCancel}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-950"
              type="button"
              aria-label="Cancel"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="p-4">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            disabled={isDisabled}
            placeholder="Type your message here..."
            rows={3}
            className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-green-500 focus:ring-2 focus:ring-green-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            style={{ maxHeight: '300px', minHeight: '80px' }}
          />

          <div className="mt-3 flex items-center justify-between">
            <div className="text-muted-foreground text-xs">
              <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">Enter</kbd> to send •{' '}
              <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">Shift+Enter</kbd> for new line •{' '}
              <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">Esc</kbd> to cancel
            </div>
            <button
              type="submit"
              disabled={isDisabled || !input.trim()}
              className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 font-medium text-white text-sm transition-all hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-green-600"
            >
              <Send size={16} />
              Send
            </button>
          </div>
        </form>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-3 !w-3 !border-2 !border-green-500 !bg-green-500/20"
      />
    </motion.div>
  );
});

PromptNode.displayName = 'PromptNode';
