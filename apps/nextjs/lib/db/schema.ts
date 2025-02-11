import {
  pgTable,
  serial,
  timestamp,
  uniqueIndex,
  varchar,
  integer,
} from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    clerkId: varchar("clerk_id", { length: 255 }).notNull(),
    stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
    stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }),
    stripeProductId: varchar("stripe_product_id", { length: 255 }),
    planName: varchar("plan_name", { length: 100 }),
    subscriptionStatus: varchar("subscription_status", { length: 20 }),
    name: varchar("name", { length: 100 }),
    role: varchar("role", { length: 20 }).notNull().default("member"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    deletedAt: timestamp("deleted_at"),
  },
  (users) => ({
    uniqueClerkId: uniqueIndex("unique_clerk_id").on(users.clerkId),
  }),
);

export const pullRequests = pgTable(
  "pull_requests",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    githubId: integer("github_id").notNull(),
    number: integer("number").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    state: varchar("state", { length: 20 }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    owner: varchar("owner", { length: 255 }).notNull(),
    repo: varchar("repo", { length: 255 }).notNull(),
  },
  (table) => ({
    userGithubIdIdx: uniqueIndex("user_github_id_idx").on(
      table.userId,
      table.githubId,
    ),
  }),
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type PullRequest = typeof pullRequests.$inferSelect;
export type NewPullRequest = typeof pullRequests.$inferInsert;

export interface ExtendedPullRequest extends PullRequest {
  repository: {
    owner: string;
    repo: string;
  };
}
