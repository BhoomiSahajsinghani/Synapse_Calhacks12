ALTER TABLE "FlowEdge" DROP CONSTRAINT "FlowEdge_source_FlowNode_id_fk";
--> statement-breakpoint
ALTER TABLE "FlowEdge" DROP CONSTRAINT "FlowEdge_target_FlowNode_id_fk";
--> statement-breakpoint
ALTER TABLE "FlowNode" DROP CONSTRAINT "FlowNode_userMessageId_Message_v2_id_fk";
--> statement-breakpoint
ALTER TABLE "FlowNode" DROP CONSTRAINT "FlowNode_assistantMessageId_Message_v2_id_fk";
--> statement-breakpoint
ALTER TABLE "FlowNode" DROP COLUMN IF EXISTS "userMessageId";--> statement-breakpoint
ALTER TABLE "FlowNode" DROP COLUMN IF EXISTS "assistantMessageId";