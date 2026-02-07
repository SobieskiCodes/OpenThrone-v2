import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';

const API_URL = process.env.API_URL || 'http://localhost:3001';

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      authorize: async (credentials) => {
        try {
          const response = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: credentials?.email,
              password: credentials?.password,
            }),
          });

          if (!response.ok) return null;

          const data = await response.json();
          return {
            id: data.player.id,
            name: data.player.displayName,
            email: credentials?.email as string,
            accessToken: data.accessToken,
            race: data.player.race,
            playerClass: data.player.class,
            colorScheme: data.player.colorScheme,
          };
        } catch {
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
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.accessToken = (user as any).accessToken;
        token.race = (user as any).race;
        token.playerClass = (user as any).playerClass;
        token.colorScheme = (user as any).colorScheme;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id as string;
      (session as any).accessToken = token.accessToken;
      (session as any).race = token.race;
      (session as any).playerClass = token.playerClass;
      (session as any).colorScheme = token.colorScheme;
      return session;
    },
  },
});
