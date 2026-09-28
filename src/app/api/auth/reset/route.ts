import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSession, hashPassword, hashResetToken } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const { token, password } = await req.json();
    if (!token || !password || String(password).length < 8) return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    const user = await prisma.user.findFirst({ where: { resetToken: hashResetToken(String(token)), resetExpiry: { gt: new Date() } } });
    if (!user) return NextResponse.json({ error: "That reset link is invalid or has expired." }, { status: 400 });
    const passwordHash = await hashPassword(String(password));
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash, resetToken: null, resetExpiry: null } });
    await createSession(user.id, passwordHash);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Something went wrong — please try again." }, { status: 500 });
  }
}
