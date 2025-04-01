"use server";

import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createCheckoutSession, createCustomerPortalSession } from "./stripe";
import { getUserByClerkId } from "@/lib/db/queries";
import { User } from "@/lib/db/schema";

export const checkoutAction = async (formData: FormData) => {
  const clerkUser = await currentUser();
  if (!clerkUser) {
    throw new Error("User not found");
  }
  const user: User | null = await getUserByClerkId(clerkUser.id);
  if (!user) {
    throw new Error("User not found in database");
  }
  const priceId = formData.get("priceId") as string;
  await createCheckoutSession({ user, priceId });
};

export const customerPortalAction = async () => {
  const clerkUser = await currentUser();
  if (!clerkUser) {
    throw new Error("User not found");
  }
  const user: User | null = await getUserByClerkId(clerkUser.id);
  if (!user) {
    throw new Error("User not found in database");
  }
  const portalSession = await createCustomerPortalSession(user);
  redirect(portalSession.url);
};
