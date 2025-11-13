import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { processDocument } from "@/lib/ingestion/pipeline";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { documentId } = await request.json();

    if (!documentId) {
      return NextResponse.json(
        { error: "Document ID is required" },
        { status: 400 }
      );
    }

    await processDocument(documentId, user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Ingestion error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to process document",
      },
      { status: 500 }
    );
  }
}

