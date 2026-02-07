export { auth as middleware } from '@/auth';

export const config = {
  matcher: [
    '/home',
    '/battle/:path*',
    '/structures/:path*',
    '/social/:path*',
    '/community/:path*',
    '/recruitment/:path*',
    '/profile/:path*',
    '/admin/:path*',
  ],
};
