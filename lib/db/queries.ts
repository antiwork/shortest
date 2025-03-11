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
  projects,
  Project,
  NewProject,
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

export const getProject = async (
  userId: number,
  owner: string,
  repo: string,
): Promise<Project | null> => {
  const project = await db.query.projects.findFirst({
    where: and(
      eq(projects.userId, userId),
      eq(projects.owner, owner),
      eq(projects.repo, repo),
    ),
  });

  return project || null;
};

export const getUserProjects = async (): Promise<Project[]> => {
  const { userId } = auth();
  if (!userId) {
    throw new Error("User not authenticated");
  }

  const user = await getUserByClerkId(userId);
  return db.select().from(projects).where(eq(projects.userId, user.id));
};

export const createOrUpdateProject = async (
  projectData: Omit<NewProject, "userId" | "createdAt" | "updatedAt">,
): Promise<Project> => {
  const { userId } = auth();
  if (!userId) {
    throw new Error("User not authenticated");
  }

  const user = await getUserByClerkId(userId);
  const existingProject = await getProject(
    user.id,
    projectData.owner,
    projectData.repo,
  );

  if (existingProject) {
    const [updatedProject] = await db
      .update(projects)
      .set({
        ...projectData,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, existingProject.id))
      .returning();

    return updatedProject;
  }

  const [newProject] = await db
    .insert(projects)
    .values({
      ...projectData,
      userId: user.id,
    })
    .returning();

  return newProject;
};

export const deleteProject = async (id: number): Promise<void> => {
  const { userId } = auth();
  if (!userId) {
    throw new Error("User not authenticated");
  }

  const user = await getUserByClerkId(userId);
  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, id), eq(projects.userId, user.id)),
  });

  if (!project) {
    throw new Error("Project not found or access denied");
  }

  await db.delete(projects).where(eq(projects.id, id));
};
