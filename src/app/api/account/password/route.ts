import { NextResponse } from "next/server";
import { getSessionUser, hashPassword, verifyPassword, createSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { current, password } = await req.json();
  if (!(await verifyPassword(String(current || ""), user.passwordHash))) return NextResponse.json({ error: "Current password is wrong." }, { status: 400 });
  if (!password || String(password).length < 8) return NextResponse.json({ error: "New password must be at least 8 characters." }, { status: 400 });
  const passwordHash = await hashPassword(String(password));
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  await createSession(user.id, passwordHash); /* other sessions are signed out */
  return NextResponse.json({ ok: true });
}
