DROP TABLE "repos";--> statement-breakpoint
ALTER TABLE "pull_requests" ADD COLUMN "user_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "pull_requests" ADD COLUMN "owner" varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE "pull_requests" ADD COLUMN "repo" varchar(255) NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_github_id_idx" ON "pull_requests" USING btree ("user_id","github_id");--> statement-breakpoint
ALTER TABLE "pull_requests" DROP COLUMN IF EXISTS "repo_id";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "github_access_token";