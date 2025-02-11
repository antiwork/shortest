"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "./drizzle";
import { users, User, NewUser, pullRequests, PullRequest } from "./schema";

export async function updateUserSubscription(
  clerkId: string,
  subscriptionData: {
    stripeSubscriptionId: string | null;
    stripeProductId: string | null;
    planName: string | null;
    subscriptionStatus: string;
  },
) {
  await db
    .update(users)
    .set({
      ...subscriptionData,
      updatedAt: new Date(),
    })
    .where(eq(users.clerkId, clerkId));
}

async function createUser(clerkId: string): Promise<User> {
  const clerkUser = await clerkClient.users.getUser(clerkId);
  const newUser: NewUser = {
    clerkId,
    role: "member",
    name:
      clerkUser.firstName && clerkUser.lastName
        ? `${clerkUser.firstName} ${clerkUser.lastName}`
        : clerkUser.username || "",
  };

  const [createdUser] = await db.insert(users).values(newUser).returning();
  return createdUser;
}

export async function getUserByClerkId(clerkId: string): Promise<User> {
  const [existingUser] = await db
    .select()
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);

  if (existingUser) {
    return existingUser;
  }

  return createUser(clerkId);
}

export async function getPullRequests(): Promise<PullRequest[]> {
  const { userId } = auth();
  if (!userId) {
    throw new Error("User not authenticated");
  }

  const user = await getUserByClerkId(userId);
  return db.select().from(pullRequests).where(eq(pullRequests.userId, user.id));
}
