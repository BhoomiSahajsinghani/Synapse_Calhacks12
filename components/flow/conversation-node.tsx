'use client';

import { memo, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { motion, AnimatePresence } from 'framer-motion';
import { SparklesIcon } from '../icons';
import { Response } from '../elements/response';
import { MessageContent } from '../elements/message';
import { sanitizeText } from '@/lib/utils';
import type { ChatMessage } from '@/lib/types';
import { User, ChevronDown, ChevronUp } from 'lucide-react';

export type ConversationNodeData = {
  userMessage: ChatMessage;
  assistantMessage?: ChatMessage;
  isLoading?: boolean;
};

export const ConversationNode = memo(({ data }: NodeProps<ConversationNodeData>) => {
  const { userMessage, assistantMessage, isLoading } = data;
  const [isResponseExpanded, setIsResponseExpanded] = useState(true);

  const userTextPart = userMessage.parts.find((part) => part.type === 'text');
  const assistantTextPart = assistantMessage?.parts.find((part) => part.type === 'text');
  const hasAssistantContent = assistantTextPart?.type === 'text' && assistantTextPart.text;

  const toggleResponse = () => {
    setIsResponseExpanded(!isResponseExpanded);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="group/conversation"
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!h-3 !w-3 !border-2 !border-purple-500 !bg-purple-500/20"
      />

      <div className="min-w-[500px] max-w-[700px] overflow-hidden rounded-xl border border-border bg-background shadow-lg transition-shadow hover:shadow-xl">
        {/* User Prompt Section */}
        <div className="border-b border-border bg-gradient-to-br from-amber-50/50 to-orange-50/50 p-4 dark:from-amber-950/20 dark:to-orange-950/20">
          <div className="flex items-start gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-600 text-white shadow-sm">
              <User size={16} />
            </div>
            <div className="flex-1">
              <div className="mb-1.5 font-semibold text-amber-900 text-xs uppercase tracking-wide dark:text-amber-300">
                Prompt
              </div>
              <MessageContent className="break-words text-foreground text-sm leading-relaxed">
                <Response>
                  {sanitizeText(userTextPart?.type === 'text' ? userTextPart.text : '')}
                </Response>
              </MessageContent>
            </div>
          </div>
        </div>

        {/* Assistant Response Section */}
        <div className="bg-gradient-to-br from-blue-50/30 to-purple-50/30 dark:from-blue-950/10 dark:to-purple-950/10">
          {/* Response Header - Always visible */}
          <button
            onClick={toggleResponse}
            className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-blue-100/50 dark:hover:bg-blue-900/20"
            type="button"
          >
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-sm">
              <SparklesIcon size={16} />
            </div>
            <div className="flex-1">
              <div className="font-semibold text-blue-900 text-xs uppercase tracking-wide dark:text-blue-300">
                Response
              </div>
              {!isResponseExpanded && hasAssistantContent && (
                <div className="mt-1 truncate text-muted-foreground text-xs">
                  {sanitizeText(assistantTextPart?.type === 'text' ? assistantTextPart.text.substring(0, 60) + '...' : '')}
                </div>
              )}
            </div>
            <div className="shrink-0 text-blue-900 dark:text-blue-300">
              {isResponseExpanded ? (
                <ChevronUp size={20} className="transition-transform" />
              ) : (
                <ChevronDown size={20} className="transition-transform" />
              )}
            </div>
          </button>

          {/* Collapsible Response Content */}
          <AnimatePresence initial={false}>
            {isResponseExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <div className="border-t border-blue-200/50 px-4 pb-4 pt-3 dark:border-blue-800/30">
                  {isLoading && !hasAssistantContent ? (
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 animate-bounce rounded-full bg-blue-500" style={{ animationDelay: '0ms' }} />
                        <div className="h-2 w-2 animate-bounce rounded-full bg-purple-500" style={{ animationDelay: '150ms' }} />
                        <div className="h-2 w-2 animate-bounce rounded-full bg-indigo-500" style={{ animationDelay: '300ms' }} />
                        <span className="ml-2 text-muted-foreground text-xs">Thinking...</span>
                      </div>
                      <div className="space-y-2">
                        <div className="h-3 w-full animate-pulse rounded bg-muted/60" />
                        <div className="h-3 w-5/6 animate-pulse rounded bg-muted/60" style={{ animationDelay: '100ms' }} />
                        <div className="h-3 w-4/6 animate-pulse rounded bg-muted/60" style={{ animationDelay: '200ms' }} />
                      </div>
                    </div>
                  ) : assistantMessage ? (
                    <MessageContent className="break-words text-foreground text-sm leading-relaxed">
                      <Response>
                        {sanitizeText(assistantTextPart?.type === 'text' ? assistantTextPart.text : '')}
                      </Response>
                    </MessageContent>
                  ) : (
                    <div className="text-muted-foreground text-sm italic">
                      Waiting for response...
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-3 !w-3 !border-2 !border-purple-500 !bg-purple-500/20"
      />
    </motion.div>
  );
});

ConversationNode.displayName = 'ConversationNode';
