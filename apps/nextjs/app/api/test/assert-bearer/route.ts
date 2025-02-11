import { NextResponse } from "next/server";
import { ALLOWED_TEST_BEARER } from "@/lib/constants";
import { getBearerToken } from "@/lib/utils-server";

/**
 * Asserts that the bearer token is present in the request
 * If yes, returns the request body
 */
export async function POST(req: Request) {
  const token = getBearerToken(req);

  if (!token || token !== ALLOWED_TEST_BEARER) {
    return NextResponse.json(
      { message: "Bearer token is missing in cookies" },
      { status: 401 },
    );
  }

  try {
    const body = await req.json();
    return NextResponse.json(body);
  } catch {
    return NextResponse.json(
      { message: "Invalid request body" },
      { status: 400 },
    );
  }
}
