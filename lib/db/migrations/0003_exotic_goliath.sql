CREATE UNIQUE INDEX IF NOT EXISTS "user_github_id_idx" ON "repos" USING btree ("user_id","github_id");