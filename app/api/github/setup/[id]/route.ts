import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { deleteProject } from "@/lib/db/queries";

export const DELETE = async (
  request: NextRequest,
  { params }: { params: { id: string } },
) => {
  const { userId } = auth();

  if (!userId) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json(
        { error: "Invalid automation ID" },
        { status: 400 },
      );
    }

    await deleteProject(id);
    return NextResponse.json({ message: "Automation removed successfully" });
  } catch (error) {
    console.error("Error deleting automation:", error);
    const message =
      error instanceof Error ? error.message : "Failed to delete automation";
    return NextResponse.json(
      { error: message },
      {
        status:
          error instanceof Error && error.message.includes("not found")
            ? 404
            : 500,
      },
    );
  }
};
