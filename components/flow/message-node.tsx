'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { motion } from 'framer-motion';
import { SparklesIcon } from '../icons';
import { Response } from '../elements/response';
import { MessageContent } from '../elements/message';
import { cn, sanitizeText } from '@/lib/utils';
import type { ChatMessage } from '@/lib/types';
import { User } from 'lucide-react';

export type MessageNodeData = {
  message: ChatMessage;
  isLoading?: boolean;
};

export const UserMessageNode = memo((props: NodeProps) => {
  const data = props.data as MessageNodeData;
  const { message } = data;
  const textPart = message?.parts?.find((part) => part.type === 'text');

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="group/message"
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!h-3 !w-3 !border-2 !border-amber-600 !bg-amber-600/20"
      />

      <div className="flex min-w-[300px] max-w-[500px] items-start gap-3 rounded-lg border border-border bg-background p-4 shadow-md transition-shadow hover:shadow-lg">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-amber-600 text-white">
          <User size={16} />
        </div>

        <div className="flex-1">
          <div className="mb-1 font-medium text-muted-foreground text-xs">
            You
          </div>
          <MessageContent className="break-words text-foreground text-sm leading-relaxed">
            <Response>
              {sanitizeText(textPart?.type === 'text' ? textPart.text : '')}
            </Response>
          </MessageContent>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-3 !w-3 !border-2 !border-amber-600 !bg-amber-600/20"
      />
    </motion.div>
  );
});

UserMessageNode.displayName = 'UserMessageNode';

export const AssistantMessageNode = memo(
  (props: NodeProps) => {
    const data = props.data as MessageNodeData;
    const { message, isLoading } = data;
    const textPart = message?.parts?.find((part) => part.type === 'text');
    const hasContent = textPart?.type === 'text' && textPart.text;

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="group/message"
      >
        <Handle
          type="target"
          position={Position.Top}
          className="!h-3 !w-3 !border-2 !border-blue-500 !bg-blue-500/20"
        />

        <div className="flex min-w-[300px] max-w-[500px] items-start gap-3 rounded-lg border border-border bg-background p-4 shadow-md transition-shadow hover:shadow-lg">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-blue-500 to-purple-600 text-white ring-1 ring-border">
            <SparklesIcon size={16} />
          </div>

          <div className="flex-1">
            <div className="mb-1 font-medium text-muted-foreground text-xs">
              Assistant
            </div>
            {isLoading && !hasContent ? (
              <div className="space-y-2">
                <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
                <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
              </div>
            ) : (
              <MessageContent className="break-words text-foreground text-sm leading-relaxed">
                <Response>
                  {sanitizeText(textPart?.type === 'text' ? textPart.text : '')}
                </Response>
              </MessageContent>
            )}
          </div>
        </div>

        <Handle
          type="source"
          position={Position.Bottom}
          className="!h-3 !w-3 !border-2 !border-blue-500 !bg-blue-500/20"
        />
      </motion.div>
    );
  }
);

AssistantMessageNode.displayName = 'AssistantMessageNode';
