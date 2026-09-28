import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSession, hashPassword } from "@/lib/auth";
import { sendTemplate } from "@/lib/sendgrid";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  try {
    const { email, name, password, marketing, ageConfirmed } = await req.json();
    const e = String(email || "").trim().toLowerCase();
    if (!EMAIL.test(e)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    if (!name || String(name).trim().length < 1) return NextResponse.json({ error: "Tell us what to call you." }, { status: 400 });
    if (!password || String(password).length < 8) return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    if (!ageConfirmed) return NextResponse.json({ error: "You must confirm you are 18 or older." }, { status: 400 });
    if (await prisma.user.findUnique({ where: { email: e } })) return NextResponse.json({ error: "An account with that email already exists. Sign in instead." }, { status: 409 });
    const user = await prisma.user.create({
      data: { email: e, name: String(name).trim().slice(0, 80), passwordHash: await hashPassword(String(password)), marketingOptIn: !!marketing, ageVerifiedAt: new Date() },
    });
    await createSession(user.id, user.passwordHash);
    sendTemplate("welcome", user.email, { subject: "Welcome to Play Time", fallbackText: "Your account is ready.", name: user.name }, { userId: user.id }).catch(() => {});
    return NextResponse.json({ ok: true, user: { id: user.id, email: user.email, name: user.name, isAdmin: user.isAdmin } });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Something went wrong — please try again." }, { status: 500 });
  }
}
