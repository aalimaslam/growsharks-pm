import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "admin" | "employee";
      isContentTeam: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    role: "admin" | "employee";
    isContentTeam: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: "admin" | "employee";
    isContentTeam: boolean;
  }
}
