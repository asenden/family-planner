import "next-auth";

declare module "next-auth" {
  interface Session {
    user: { id: string; name: string; email: string; familyId: string; role: string; memberId: string; };
  }
  interface User { familyId: string; role: string; }
}
declare module "next-auth/jwt" {
  interface JWT { familyId: string; role: string; memberId: string; }
}
