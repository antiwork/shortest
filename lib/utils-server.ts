import { headers } from "next/headers";

export const baseUrl = async () => {
  const headersList = await headers();
  const host = headersList.get("host");
  const protocol = process.env.NODE_ENV === "development" ? "http" : "https";
  return `${protocol}://${host}`;
};

/**
 * Get the bearer token from the Authorization header
 */
export const getBearerToken = (req: Request): string | null => {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;

  const [bearer, token] = authHeader.split(" ");
  if (bearer !== "Bearer" || !token) return null;

  return token;
};
