import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const SESSION_TIMEOUT_IN_MINUTES = 30;
const SESSION_TIMEOUT_MS = SESSION_TIMEOUT_IN_MINUTES * 60 * 1000;
const LAST_ACTIVITY_COOKIE = 'last-activity';

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
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthenticated = !!user;
  const isAuthRoute = req.nextUrl.pathname.startsWith('/login');

  // 1. Handle redirects for unauthenticated users trying to access protected routes
  if (!isAuthenticated && !isAuthRoute) {
    let from = req.nextUrl.pathname;
    if (req.nextUrl.search) {
      from += req.nextUrl.search;
    }
    const redirectUrl = new URL(`/login?from=${encodeURIComponent(from)}`, req.url);
    const redirectResponse = NextResponse.redirect(redirectUrl);
    // Ensure last-activity cookie is cleared on redirect
    redirectResponse.cookies.set({
      name: LAST_ACTIVITY_COOKIE,
      value: '',
      path: '/',
      expires: new Date(0),
    });
    return redirectResponse;
  }

  // 2. Handle redirects for authenticated users trying to access auth routes
  if (isAuthenticated && (isAuthRoute || req.nextUrl.pathname === '/')) {
    const redirectResponse = NextResponse.redirect(new URL('/dashboard', req.url));
    const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // Expire in 1 year
    // Set activity cookie on redirect to ensure session starts immediately
    redirectResponse.cookies.set(LAST_ACTIVITY_COOKIE, Date.now().toString(), {
      path: '/',
      httpOnly: true,
      expires,
    });
    return redirectResponse;
  }

  // 3. Handle session timeout for authenticated users on protected routes
  if (isAuthenticated) {
    const lastActivity = req.cookies.get(LAST_ACTIVITY_COOKIE)?.value;
    const now = Date.now();

    if (lastActivity && now - parseInt(lastActivity, 10) > SESSION_TIMEOUT_MS) {
      await supabase.auth.signOut();
      const redirectResponse = NextResponse.redirect(
        new URL('/login?reason=session-expired', req.url)
      );
      
      // Copy Supabase auth cookies to the redirect response
      response.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie);
      });

      // Clear the activity cookie on the timeout redirect
      redirectResponse.cookies.set({
        name: LAST_ACTIVITY_COOKIE,
        value: '',
        path: '/',
        expires: new Date(0),
      });
      return redirectResponse;
    }

    const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // Expire in 1 year
    // If active, update the session cookie on the ongoing response
    response.cookies.set(LAST_ACTIVITY_COOKIE, now.toString(), {
      path: '/',
      httpOnly: true,
      expires,
    });
  }

  // 4. Return the original response (with updated cookie if user is active)
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