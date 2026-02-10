import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';

const API_URL = process.env.API_URL || 'http://localhost:3001';
const isDev = process.env.NODE_ENV === 'development';

/** Decode a JWT payload to read its `exp` claim (seconds since epoch). */
function getTokenExp(token: string): number | null {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1]!, 'base64').toString());
    return payload.exp ?? null;
  } catch {
    return null;
  }
}

/** Call NestJS /auth/refresh with the current token to get a new one. */
async function refreshAccessToken(currentToken: string): Promise<string | null> {
  try {
    const res = await fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${currentToken}`,
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.accessToken ?? null;
  } catch {
    return null;
  }
}

// Refresh the NestJS token when it's within this window of expiry
const REFRESH_BUFFER_MS = 60 * 60 * 1000; // 1 hour

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      authorize: async (credentials) => {
        if (isDev) console.log('[auth] authorize →', credentials?.email);
        try {
          const response = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: credentials?.email,
              password: credentials?.password,
            }),
          });

          if (isDev) console.log('[auth] API status:', response.status);
          if (!response.ok) return null;

          const data = await response.json();
          if (isDev) console.log('[auth] Login OK:', data.player?.displayName);
          return {
            id: data.player.id,
            name: data.player.displayName,
            email: credentials?.email as string,
            accessToken: data.accessToken,
            race: data.player.race,
            playerClass: data.player.class,
            colorScheme: data.player.colorScheme,
            permissions: data.player.permissions ?? [],
          };
        } catch (err) {
          if (isDev) console.error('[auth] authorize error:', err);
          return null;
        }
      },
    }),
  ],
  session: { strategy: 'jwt', maxAge: 7 * 24 * 60 * 60 },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    authorized({ auth }) {
      // Returning false redirects unauthenticated users to pages.signIn
      return !!auth?.user;
    },
    async jwt({ token, user }) {
      // Initial sign-in — store everything from the authorize result
      if (user) {
        token.id = user.id;
        token.accessToken = (user as any).accessToken;
        token.race = (user as any).race;
        token.playerClass = (user as any).playerClass;
        token.colorScheme = (user as any).colorScheme;
        token.permissions = (user as any).permissions;
        return token;
      }

      // Subsequent requests — check if the NestJS token needs refresh
      const accessToken = token.accessToken as string | undefined;
      if (accessToken) {
        const exp = getTokenExp(accessToken);
        if (exp) {
          const nowMs = Date.now();
          const expiresMs = exp * 1000;

          if (nowMs >= expiresMs) {
            // Token already expired — force re-login
            if (isDev) console.log('[auth] NestJS token expired, invalidating session');
            return {} as typeof token;
          }

          if (expiresMs - nowMs < REFRESH_BUFFER_MS) {
            // Token expiring soon — refresh it
            if (isDev) console.log('[auth] NestJS token expiring soon, refreshing...');
            const newToken = await refreshAccessToken(accessToken);
            if (newToken) {
              token.accessToken = newToken;
              if (isDev) console.log('[auth] Token refreshed successfully');
            } else {
              if (isDev) console.log('[auth] Token refresh failed');
            }
          }
        }
      }

      return token;
    },
    async session({ session, token }) {
      // If token was invalidated (expired NestJS JWT), clear the session
      if (!token.id) {
        return {} as typeof session;
      }

      session.user.id = token.id as string;
      (session as any).accessToken = token.accessToken;
      (session as any).race = token.race;
      (session as any).playerClass = token.playerClass;
      (session as any).colorScheme = token.colorScheme;
      (session as any).permissions = token.permissions;
      return session;
    },
  },
});
