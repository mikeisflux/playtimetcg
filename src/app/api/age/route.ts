import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AGE_COOKIE, getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

/* Sets the first-party age cookie (30 days) server-side so it is HttpOnly-safe
   for SSR, and stamps the logged-in user's record. */
export async function POST() {
  const jar = await cookies();
  jar.set(AGE_COOKIE, "1", { path: "/", maxAge: 60 * 60 * 24 * 30, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
  const u = await getSessionUser();
  if (u && !u.ageVerifiedAt) {
    await prisma.user.update({ where: { id: u.id }, data: { ageVerifiedAt: new Date() } }).catch(() => {});
  }
  return NextResponse.json({ ok: true });
}
