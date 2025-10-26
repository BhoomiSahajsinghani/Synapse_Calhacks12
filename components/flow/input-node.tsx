'use client';

import { memo, useState, useRef, useEffect } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { motion } from 'framer-motion';
import { Send, Loader2 } from 'lucide-react';
import type { UseChatHelpers } from '@ai-sdk/react';
import type { ChatMessage } from '@/lib/types';

export type InputNodeData = {
  sendMessage: UseChatHelpers<ChatMessage>['sendMessage'];
  status: UseChatHelpers<ChatMessage>['status'];
  onInputChange?: (value: string) => void;
};

export const InputNode = memo((props: NodeProps) => {
  const data = props.data as InputNodeData;
  const { sendMessage, status, onInputChange } = data;
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isDisabled = status === 'streaming' || status === 'submitted';

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
    onInputChange?.('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInput(value);
    onInputChange?.(value);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="group/input"
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!h-3 !w-3 !border-2 !border-green-500 !bg-green-500/20"
      />

      <form
        onSubmit={handleSubmit}
        className="flex min-w-[400px] max-w-[600px] items-end gap-2 rounded-lg border-2 border-dashed border-border bg-background/95 p-4 shadow-lg backdrop-blur-sm transition-all hover:border-green-500/50 hover:shadow-xl"
      >
        <div className="flex-1">
          <label
            htmlFor="flow-input"
            className="mb-2 block font-medium text-muted-foreground text-xs"
          >
            Type your message
          </label>
          <textarea
            id="flow-input"
            ref={textareaRef}
            value={input}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            disabled={isDisabled}
            placeholder="Ask anything..."
            rows={1}
            className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-green-500 focus:ring-1 focus:ring-green-500 disabled:cursor-not-allowed disabled:opacity-50"
            style={{ maxHeight: '200px' }}
          />
        </div>

        <button
          type="submit"
          disabled={isDisabled || !input.trim()}
          className="flex size-10 shrink-0 items-center justify-center rounded-md bg-green-600 text-white transition-all hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-green-600"
          aria-label="Send message"
        >
          {isDisabled ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Send size={18} />
          )}
        </button>
      </form>

      <div className="mt-2 text-center text-muted-foreground text-xs">
        Press Enter to send • Shift+Enter for new line
      </div>
    </motion.div>
  );
});

InputNode.displayName = 'InputNode';
