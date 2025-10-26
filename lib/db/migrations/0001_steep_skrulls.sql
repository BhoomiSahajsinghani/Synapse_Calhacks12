CREATE TABLE IF NOT EXISTS "FlowEdge" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"chatId" uuid NOT NULL,
	"source" varchar(255) NOT NULL,
	"target" varchar(255) NOT NULL,
	"type" varchar(50) DEFAULT 'smoothstep' NOT NULL,
	"animated" boolean DEFAULT false NOT NULL,
	"style" jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "FlowNode" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"chatId" uuid NOT NULL,
	"type" varchar(50) NOT NULL,
	"positionX" varchar(50) NOT NULL,
	"positionY" varchar(50) NOT NULL,
	"data" jsonb NOT NULL,
	"parentNodeId" varchar(255),
	"userMessageId" uuid,
	"assistantMessageId" uuid,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "FlowEdge" ADD CONSTRAINT "FlowEdge_chatId_Chat_id_fk" FOREIGN KEY ("chatId") REFERENCES "public"."Chat"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "FlowEdge" ADD CONSTRAINT "FlowEdge_source_FlowNode_id_fk" FOREIGN KEY ("source") REFERENCES "public"."FlowNode"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "FlowEdge" ADD CONSTRAINT "FlowEdge_target_FlowNode_id_fk" FOREIGN KEY ("target") REFERENCES "public"."FlowNode"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "FlowNode" ADD CONSTRAINT "FlowNode_chatId_Chat_id_fk" FOREIGN KEY ("chatId") REFERENCES "public"."Chat"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "FlowNode" ADD CONSTRAINT "FlowNode_userMessageId_Message_v2_id_fk" FOREIGN KEY ("userMessageId") REFERENCES "public"."Message_v2"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "FlowNode" ADD CONSTRAINT "FlowNode_assistantMessageId_Message_v2_id_fk" FOREIGN KEY ("assistantMessageId") REFERENCES "public"."Message_v2"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
