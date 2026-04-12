import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "./db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const member = await db.familyMember.findUnique({
          where: { email: credentials.email as string },
          include: { family: true },
        });
        if (!member || !member.password) return null;
        if (member.password !== credentials.password) return null;
        return {
          id: member.id,
          name: member.name,
          email: member.email,
          familyId: member.familyId,
          role: member.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.familyId = (user as { familyId: string }).familyId;
        token.role = (user as { role: string }).role;
        token.memberId = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.familyId = token.familyId as string;
        session.user.role = token.role as string;
        session.user.memberId = token.memberId as string;
      }
      return session;
    },
  },
  pages: { signIn: "/setup" },
  session: { strategy: "jwt" },
});
