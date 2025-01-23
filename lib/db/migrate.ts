import path from "path";
import dotenv from "dotenv";
import { migrate } from "drizzle-orm/postgres-js/migrator";

import { client, db } from "@/lib/db/drizzle";

dotenv.config({ path: ".env.local" });

async function main() {
  await migrate(db, {
    migrationsFolder: path.join(process.cwd(), "/lib/db/migrations"),
  });
  console.log(`Migrations complete`);
  await client.end();
}

main();
