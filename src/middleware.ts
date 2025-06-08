import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: req.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          // The cookie is set on the response so the browser knows about the session.
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: CookieOptions) {
          // The cookie is removed from the response.
          response.cookies.set({
            name,
            value: '',
            ...options,
          });
        },
      },
    }
  );

  const { data: { user }, error: userError } = await supabase.auth.getUser();

  // This logic is restored from your original middleware
  const isAuthenticated = !!user && !userError;
  const isAuthRoute = req.nextUrl.pathname.startsWith('/login');

  if (!isAuthenticated && !isAuthRoute) {
    let from = req.nextUrl.pathname;
    if (req.nextUrl.search) {
      from += req.nextUrl.search;
    }
    // Use the main response object for redirection
    response = NextResponse.redirect(new URL(`/login?from=${encodeURIComponent(from)}`, req.url));
  }

  if (isAuthenticated && (isAuthRoute || req.nextUrl.pathname === '/')) {
    // Use the main response object for redirection
    response = NextResponse.redirect(new URL('/dashboard', req.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Also, exclude public assets if you have a /public folder with static assets.
     */
    '/((?!api|_next/static|_next/image|favicon.ico|public).*)',
    // '/' // Uncomment to protect root route
  ],
}; 