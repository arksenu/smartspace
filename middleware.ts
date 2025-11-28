import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

import { apiRateLimiter } from "@/lib/security/rate-limit";
import { NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  // Rate limiting for API routes
  if (request.nextUrl.pathname.startsWith('/api')) {
    const identifier = request.ip ?? '127.0.0.1';
    const { success, limit, remaining, reset } = await apiRateLimiter.limit(identifier);

    if (!success) {
      return NextResponse.json(
        {
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests',
            details: { limit, reset },
          },
        },
        { status: 429 }
      );
    }

    const response = await updateSession(request);
    response.headers.set('X-RateLimit-Limit', limit.toString());
    response.headers.set('X-RateLimit-Remaining', remaining.toString());
    response.headers.set('X-RateLimit-Reset', reset.toString());
    return response;
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

