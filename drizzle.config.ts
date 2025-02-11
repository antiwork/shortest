import type { Config } from "drizzle-kit";

export default {
  schema: "./apps/nextjs/lib/db/schema.ts",
  out: "./apps/nextjs/lib/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.POSTGRES_URL!,
  },
} satisfies Config;
