ALTER TABLE "meeting_recording" ADD COLUMN "transcription" text;--> statement-breakpoint
ALTER TABLE "meeting" DROP COLUMN "transcription";