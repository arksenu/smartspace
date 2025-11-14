import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function GET(request: NextRequest) {
  try {
    // Create Supabase client with request cookies (same pattern as middleware)
    const response = NextResponse.next({ request });
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              request.cookies.set(name, value);
              response.cookies.set(name, value, options);
            });
          },
        },
      }
    );
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { data: documents, error } = await supabase
      .from("documents")
      .select("id, title")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch documents: ${error.message}`);
    }

    // Return response with updated cookies
    const jsonResponse = NextResponse.json({ documents: documents || [] });
    response.cookies.getAll().forEach((cookie) => {
      jsonResponse.cookies.set(cookie.name, cookie.value);
    });
    return jsonResponse;
  } catch (error) {
    console.error("Documents API error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to fetch documents",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Use the same createClient helper that server actions use
    const supabase = await createClient();
    
    // Get user and ensure session is valid
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error("Auth error:", authError);
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "No file provided or invalid file" },
        { status: 400 }
      );
    }

    if (file.size === 0) {
      return NextResponse.json(
        { error: "File is empty" },
        { status: 400 }
      );
    }

    // Generate unique filename
    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `${user.id}/${fileName}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(filePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json(
        { error: `Failed to upload file: ${uploadError.message}` },
        { status: 500 }
      );
    }

    // Create document record using service role client to bypass RLS
    // We've already validated the user above, so this is safe
    const insertData = {
      user_id: user.id,
      title: file.name,
      file_name: file.name,
      file_type: fileExt === "pdf" ? "pdf" : fileExt === "txt" ? "txt" : "unknown",
      file_size: file.size,
      storage_path: filePath,
      status: "pending" as const,
    };
    
    // Use service role client for insert to avoid RLS issues in API routes
    const serviceClient = createServiceRoleClient();
    const { data: document, error: dbError } = await serviceClient
      .from("documents")
      .insert(insertData)
      .select()
      .single();

    if (dbError) {
      console.error("Database insert error:", dbError);
      // Clean up uploaded file if DB insert fails
      await supabase.storage.from("documents").remove([filePath]);
      return NextResponse.json(
        { error: `Failed to create document record: ${dbError.message}` },
        { status: 500 }
      );
    }

    revalidatePath("/documents");

    // Trigger ingestion pipeline automatically (non-blocking)
    // Use dynamic import to avoid loading PDF parsing libraries during module initialization
    import("@/lib/ingestion/pipeline").then(({ processDocument }) => {
      processDocument(document.id, user.id).catch((error) => {
        // Don't fail upload if ingestion fails - it can be retried manually
        console.error("Failed to process document:", error);
      });
    });

    return NextResponse.json({ document }, { status: 200 });
  } catch (error) {
    console.error("Upload API error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to upload file",
      },
      { status: 500 }
    );
  }
}

