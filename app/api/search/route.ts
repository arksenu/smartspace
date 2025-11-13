import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { vectorSearch } from "@/lib/vector/search";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { query, topK = 10 } = await request.json();

    if (!query) {
      return NextResponse.json(
        { error: "Query is required" },
        { status: 400 }
      );
    }

    const results = await vectorSearch(query, user.id, topK);

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to perform search",
      },
      { status: 500 }
    );
  }
}

