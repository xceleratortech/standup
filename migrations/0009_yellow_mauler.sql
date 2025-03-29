CREATE TABLE "recording_group" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid NOT NULL,
	"group_name" text NOT NULL,
	"total_duration" integer,
	"formatted_total_duration" text,
	"created_by_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "meeting_recording" ADD COLUMN "group_id" uuid;--> statement-breakpoint
ALTER TABLE "meeting_recording" ADD COLUMN "segment_index" integer;--> statement-breakpoint
ALTER TABLE "meeting_recording" ADD COLUMN "is_segmented" boolean;--> statement-breakpoint
ALTER TABLE "meeting_recording" ADD COLUMN "total_segments" integer;--> statement-breakpoint
ALTER TABLE "recording_group" ADD CONSTRAINT "recording_group_meeting_id_meeting_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meeting"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recording_group" ADD CONSTRAINT "recording_group_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;