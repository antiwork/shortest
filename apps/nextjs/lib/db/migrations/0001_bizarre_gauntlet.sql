ALTER TABLE "pull_requests" DROP CONSTRAINT "pull_requests_github_id_unique";--> statement-breakpoint
ALTER TABLE "repos" DROP CONSTRAINT "repos_github_id_unique";--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_clerk_id_unique";--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_email_unique";--> statement-breakpoint
ALTER TABLE "pull_requests" DROP CONSTRAINT "pull_requests_repo_id_repos_id_fk";
--> statement-breakpoint
ALTER TABLE "repos" DROP CONSTRAINT "repos_user_id_users_id_fk";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "unique_clerk_id" ON "users" USING btree ("clerk_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "unique_email" ON "users" USING btree ("email");