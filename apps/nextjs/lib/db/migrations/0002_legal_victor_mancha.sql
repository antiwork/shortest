DROP INDEX IF EXISTS "unique_email";--> statement-breakpoint
ALTER TABLE "repos" ADD COLUMN "is_monitoring" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "email";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "password_hash";