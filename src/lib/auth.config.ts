import type { NextAuthConfig } from "next-auth";

// Edge-safe config (no Mongoose/bcrypt imports) shared by middleware and the
// full auth.ts. Middleware only needs to read/refresh the JWT, never to run
// the Credentials provider's authorize() — that stays in auth.ts.
export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  trustHost: true,
  providers: [],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = (user as { id: string }).id;
        token.role = (user as { role: "admin" | "employee" }).role;
      }
      if (trigger === "update" && session?.name) {
        token.name = session.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as "admin" | "employee";
      }
      return session;
    },
  },
};
