import { NextResponse } from "next/server";
import { getSessionUser, clientIp, userAgent } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { divinitycoin, divinityConfigured } from "@/lib/divinitycoin";

/* 5 attempts / minute per IP (matches the CreatorCredits redeem limiter) */
const attempts = new Map<string, { n: number; t: number }>();

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!(await divinityConfigured())) return NextResponse.json({ error: "DivinityCoin credits aren’t enabled yet." }, { status: 400 });
  const ip = await clientIp();
  const a = attempts.get(ip);
  const now = Date.now();
  if (a && now - a.t < 60_000 && a.n >= 5) return NextResponse.json({ error: "Too many attempts. Please wait a minute." }, { status: 429 });
  attempts.set(ip, a && now - a.t < 60_000 ? { n: a.n + 1, t: a.t } : { n: 1, t: now });
  try {
    const { code } = await req.json();
    const clean = String(code || "").toUpperCase().replace(/-/g, "");
    if (!/^[0-9A-F]{16}$/.test(clean)) return NextResponse.json({ error: "Invalid code format." }, { status: 400 });
    const r = await divinitycoin.redeemCode(clean, user.id, ip, await userAgent());
    if (!r.success) return NextResponse.json({ success: false, error: r.error || "Invalid code." }, { status: 400 });
    await prisma.creditLedger.create({
      data: { userId: user.id, type: "redemption", amountCents: Math.round((r.amount ?? 0) * 100), balanceAfterCents: r.balanceAfter !== undefined ? Math.round(r.balanceAfter * 100) : null, reference: `••••${clean.slice(-4)}`, description: `Redeemed code ending ${clean.slice(-4)}` },
    });
    return NextResponse.json({ success: true, amount: r.amount, balanceAfter: r.balanceAfter });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not reach DivinityCoin." }, { status: 502 });
  }
}
