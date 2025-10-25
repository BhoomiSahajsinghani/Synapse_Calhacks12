-- Add FlowNode table
CREATE TABLE IF NOT EXISTS "FlowNode" (
    "id" VARCHAR(255) PRIMARY KEY NOT NULL,
    "chatId" UUID NOT NULL REFERENCES "Chat"("id") ON DELETE CASCADE,
    "type" VARCHAR(50) NOT NULL,
    "positionX" VARCHAR(50) NOT NULL,
    "positionY" VARCHAR(50) NOT NULL,
    "data" JSONB NOT NULL,
    "parentNodeId" VARCHAR(255),
    "userMessageId" UUID REFERENCES "Message_v2"("id"),
    "assistantMessageId" UUID REFERENCES "Message_v2"("id"),
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Add FlowEdge table
CREATE TABLE IF NOT EXISTS "FlowEdge" (
    "id" VARCHAR(255) PRIMARY KEY NOT NULL,
    "chatId" UUID NOT NULL REFERENCES "Chat"("id") ON DELETE CASCADE,
    "source" VARCHAR(255) NOT NULL REFERENCES "FlowNode"("id") ON DELETE CASCADE,
    "target" VARCHAR(255) NOT NULL REFERENCES "FlowNode"("id") ON DELETE CASCADE,
    "type" VARCHAR(50) NOT NULL DEFAULT 'smoothstep',
    "animated" BOOLEAN NOT NULL DEFAULT FALSE,
    "style" JSONB,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS "FlowNode_chatId_idx" ON "FlowNode"("chatId");
CREATE INDEX IF NOT EXISTS "FlowNode_parentNodeId_idx" ON "FlowNode"("parentNodeId");
CREATE INDEX IF NOT EXISTS "FlowNode_userMessageId_idx" ON "FlowNode"("userMessageId");
CREATE INDEX IF NOT EXISTS "FlowNode_assistantMessageId_idx" ON "FlowNode"("assistantMessageId");
CREATE INDEX IF NOT EXISTS "FlowEdge_chatId_idx" ON "FlowEdge"("chatId");
CREATE INDEX IF NOT EXISTS "FlowEdge_source_idx" ON "FlowEdge"("source");
CREATE INDEX IF NOT EXISTS "FlowEdge_target_idx" ON "FlowEdge"("target");
