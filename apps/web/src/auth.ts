import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';

const API_URL = process.env.API_URL || 'http://localhost:3001';
const isDev = process.env.NODE_ENV === 'development';

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
      if (user) {
        token.id = user.id;
        token.accessToken = (user as any).accessToken;
        token.race = (user as any).race;
        token.playerClass = (user as any).playerClass;
        token.colorScheme = (user as any).colorScheme;
        token.permissions = (user as any).permissions;
      }
      return token;
    },
    async session({ session, token }) {
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
