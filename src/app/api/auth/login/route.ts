import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSession, verifyPassword, clientIp } from "@/lib/auth";

/* simple in-memory throttle: 10 attempts / 15 min per IP+email */
const attempts = new Map<string, { n: number; t: number }>();
function throttled(key: string): boolean {
  const now = Date.now();
  const a = attempts.get(key);
  if (!a || now - a.t > 15 * 60_000) { attempts.set(key, { n: 1, t: now }); return false; }
  a.n++;
  return a.n > 10;
}

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();
    const e = String(email || "").trim().toLowerCase();
    if (throttled(`${await clientIp()}:${e}`)) return NextResponse.json({ error: "Too many attempts. Try again in a few minutes." }, { status: 429 });
    const user = await prisma.user.findUnique({ where: { email: e } });
    if (!user || !(await verifyPassword(String(password || ""), user.passwordHash))) {
      return NextResponse.json({ error: "Wrong email or password." }, { status: 401 });
    }
    await createSession(user.id, user.passwordHash);
    return NextResponse.json({ ok: true, user: { id: user.id, email: user.email, name: user.name, isAdmin: user.isAdmin } });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Something went wrong — please try again." }, { status: 500 });
  }
}
