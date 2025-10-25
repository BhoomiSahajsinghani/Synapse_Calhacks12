import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';

const connectionString = process.env.POSTGRES_URL!;
const client = postgres(connectionString);
const db = drizzle(client);

async function migrate() {
  console.log('Starting migration...');

  try {
    // Create FlowNode table
    await db.execute(sql`
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
      )
    `);
    console.log('✓ FlowNode table created');

    // Create FlowEdge table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "FlowEdge" (
        "id" VARCHAR(255) PRIMARY KEY NOT NULL,
        "chatId" UUID NOT NULL REFERENCES "Chat"("id") ON DELETE CASCADE,
        "source" VARCHAR(255) NOT NULL REFERENCES "FlowNode"("id") ON DELETE CASCADE,
        "target" VARCHAR(255) NOT NULL REFERENCES "FlowNode"("id") ON DELETE CASCADE,
        "type" VARCHAR(50) NOT NULL DEFAULT 'smoothstep',
        "animated" BOOLEAN NOT NULL DEFAULT FALSE,
        "style" JSONB,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log('✓ FlowEdge table created');

    // Create indexes
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "FlowNode_chatId_idx" ON "FlowNode"("chatId")`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "FlowNode_parentNodeId_idx" ON "FlowNode"("parentNodeId")`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "FlowNode_userMessageId_idx" ON "FlowNode"("userMessageId")`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "FlowNode_assistantMessageId_idx" ON "FlowNode"("assistantMessageId")`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "FlowEdge_chatId_idx" ON "FlowEdge"("chatId")`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "FlowEdge_source_idx" ON "FlowEdge"("source")`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "FlowEdge_target_idx" ON "FlowEdge"("target")`);
    console.log('✓ Indexes created');

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await client.end();
  }
}

migrate();
