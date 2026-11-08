import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe config used by middleware. No Mongoose/bcrypt here — those only
 * run in the Credentials provider's `authorize()`, defined in auth.ts, which
 * executes on the Node.js runtime (route handlers / server actions), never
 * inside middleware.
 */
export const authConfig: NextAuthConfig = {
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnLogin = nextUrl.pathname.startsWith("/login");

      if (isOnLogin) {
        if (isLoggedIn) return Response.redirect(new URL("/", nextUrl));
        return true;
      }

      return isLoggedIn;
    },
  },
  providers: [],
};
