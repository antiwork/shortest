"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { eq, and } from "drizzle-orm";
import { db } from "./drizzle";
import {
  users,
  User,
  NewUser,
  pullRequests,
  PullRequest,
  repositoryConfigs,
  RepositoryConfig,
  NewRepositoryConfig,
} from "./schema";

export const updateUserSubscription = async (
  clerkId: string,
  subscriptionData: {
    stripeSubscriptionId: string | null;
    stripeProductId: string | null;
    planName: string | null;
    subscriptionStatus: string;
  },
) => {
  await db
    .update(users)
    .set({
      ...subscriptionData,
      updatedAt: new Date(),
    })
    .where(eq(users.clerkId, clerkId));
};

const createUser = async (clerkId: string): Promise<User> => {
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
};

export const getUserByClerkId = async (clerkId: string): Promise<User> => {
  const [existingUser] = await db
    .select()
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);

  if (existingUser) {
    return existingUser;
  }

  return createUser(clerkId);
};

export const getPullRequests = async (): Promise<PullRequest[]> => {
  const { userId } = auth();
  if (!userId) {
    throw new Error("User not authenticated");
  }

  const user = await getUserByClerkId(userId);
  return db.select().from(pullRequests).where(eq(pullRequests.userId, user.id));
};

export const getRepositoryConfig = async (
  userId: number,
  owner: string,
  repo: string,
): Promise<RepositoryConfig | null> => {
  const config = await db.query.repositoryConfigs.findFirst({
    where: and(
      eq(repositoryConfigs.userId, userId),
      eq(repositoryConfigs.owner, owner),
      eq(repositoryConfigs.repo, repo),
    ),
  });

  return config || null;
};

export const getUserRepositoryConfigs = async (): Promise<
  RepositoryConfig[]
> => {
  const { userId } = auth();
  if (!userId) {
    throw new Error("User not authenticated");
  }

  const user = await getUserByClerkId(userId);
  return db
    .select()
    .from(repositoryConfigs)
    .where(eq(repositoryConfigs.userId, user.id));
};

export const createOrUpdateRepositoryConfig = async (
  config: Omit<NewRepositoryConfig, "userId" | "createdAt" | "updatedAt">,
): Promise<RepositoryConfig> => {
  const { userId } = auth();
  if (!userId) {
    throw new Error("User not authenticated");
  }

  const user = await getUserByClerkId(userId);
  const existingConfig = await getRepositoryConfig(
    user.id,
    config.owner,
    config.repo,
  );

  if (existingConfig) {
    const [updatedConfig] = await db
      .update(repositoryConfigs)
      .set({
        ...config,
        updatedAt: new Date(),
      })
      .where(eq(repositoryConfigs.id, existingConfig.id))
      .returning();

    return updatedConfig;
  }

  const [newConfig] = await db
    .insert(repositoryConfigs)
    .values({
      ...config,
      userId: user.id,
    })
    .returning();

  return newConfig;
};

export const deleteRepositoryConfig = async (id: number): Promise<void> => {
  const { userId } = auth();
  if (!userId) {
    throw new Error("User not authenticated");
  }

  const user = await getUserByClerkId(userId);
  const config = await db.query.repositoryConfigs.findFirst({
    where: and(
      eq(repositoryConfigs.id, id),
      eq(repositoryConfigs.userId, user.id),
    ),
  });

  if (!config) {
    throw new Error("Repository configuration not found or access denied");
  }

  await db.delete(repositoryConfigs).where(eq(repositoryConfigs.id, id));
};
