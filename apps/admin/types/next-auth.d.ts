import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
      role?: string;
    } & DefaultSession["user"];
  }

  interface User {
    role?: string;
  }
}

// Note: augmenting the JWT interface (from @auth/core/jwt, which
// next-auth/jwt re-exports via `export *`) doesn't reliably merge through
// this beta SDK's type exports, so `token.id`/`token.role` are read with an
// explicit cast at the point of use in auth.ts instead of via this file.
