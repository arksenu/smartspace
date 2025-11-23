import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const origin = requestUrl.origin;
  const isElectron = request.headers.get("user-agent")?.includes("Electron") ||
    requestUrl.searchParams.get("electron") === "true";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    // Handle errors first
    if (error) {
      if (isElectron) {
        // Return error response for Electron to handle
        return NextResponse.json(
          {
            success: false,
            error: error.message || 'Authentication failed',
          },
          { status: 400 }
        );
      }
      // For web, redirect to login with error
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
    }

    // Check if we have a valid session - if not, treat as authentication failure
    if (!data?.session) {
      const errorMessage = 'Authentication failed: No session created';
      if (isElectron) {
        return NextResponse.json(
          {
            success: false,
            error: errorMessage,
          },
          { status: 400 }
        );
      }
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(errorMessage)}`);
    }

    // In Electron, we need to pass tokens back via protocol handler
    if (isElectron) {
      // Return JSON response for Electron to handle
      return NextResponse.json({
        success: true,
        session: {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        },
      });
    }

    // If we have a session but not in Electron, redirect to dashboard
    return NextResponse.redirect(`${origin}/dashboard`);
  }

  // URL to redirect to after sign in process completes
  if (isElectron) {
    // For Electron, return a simple success page (fallback if no code)
    return new NextResponse(
      '<html><body><h1>Authentication successful!</h1><p>You can close this window.</p><script>window.close();</script></body></html>',
      {
        headers: { 'Content-Type': 'text/html' },
      }
    );
  }

  return NextResponse.redirect(`${origin}/dashboard`);
}

