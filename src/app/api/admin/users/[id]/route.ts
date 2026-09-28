import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { audit, hashPassword } from "@/lib/auth";
import { grantPacks, grantStarterDeck } from "@/lib/packs";
import { guard, bad, notFound, readJson, str, int } from "../../_lib";
import { EMAIL_RE, safeUser, sendResetLinkEmail, sendWelcomeEmail } from "../_lib";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const g = await guard(); if (g instanceof NextResponse) return g;
  const { id } = await ctx.params;
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      addresses: true,
      orders: { orderBy: { createdAt: "desc" }, take: 50, select: { id: true, number: true, status: true, totalCents: true, currency: true, createdAt: true } },
      subscriptions: { orderBy: { startedAt: "desc" }, include: { invoices: { orderBy: { createdAt: "desc" }, take: 12 } } },
      creditLedger: { orderBy: { createdAt: "desc" }, take: 50 },
      packs: { include: { product: { select: { name: true } }, set: { select: { name: true } } } },
      _count: { select: { cards: true, openings: true, hostedRooms: true, guestRooms: true } },
    },
  });
  if (!user) return notFound();
  const collection = await prisma.userCard.aggregate({ where: { userId: id }, _sum: { qty: true } });
  const products = await prisma.product.findMany({ where: { kind: "digital_pack", active: true }, select: { id: true, name: true, packSize: true } });
  return NextResponse.json({ user: safeUser(user), isSelf: user.id === g.id, collectionQty: collection._sum.qty ?? 0, digitalProducts: products });
}

export async function POST(req: Request, ctx: Ctx) {
  const g = await guard(); if (g instanceof NextResponse) return g;
  const { id } = await ctx.params;
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return notFound();
  const b = await readJson<{ action?: string; password?: string; productId?: string; qty?: number; name?: string; email?: string; marketingOptIn?: boolean; isAdmin?: boolean; ageVerified?: boolean }>(req);
  switch (b.action) {
    case "toggle_admin": {
      if (user.id === g.id) return bad("You cannot change your own admin flag.");
      const row = await prisma.user.update({ where: { id }, data: { isAdmin: !user.isAdmin } });
      await audit(g.id, "user.toggle_admin", "user", id, { isAdmin: user.isAdmin }, { isAdmin: row.isAdmin });
      return NextResponse.json({ ok: true, isAdmin: row.isAdmin });
    }
    case "reset_password": {
      const pw = str(b.password, 200);
      if (pw.length < 8) return bad("Password must be at least 8 characters.");
      await prisma.user.update({ where: { id }, data: { passwordHash: await hashPassword(pw), resetToken: null, resetExpiry: null } });
      await audit(g.id, "user.reset_password", "user", id);
      return NextResponse.json({ ok: true });
    }
    case "update": {
      const email = str(b.email, 200).trim().toLowerCase() || user.email;
      if (!EMAIL_RE.test(email)) return bad("Enter a valid email address.");
      const dupe = await prisma.user.findUnique({ where: { email } });
      if (dupe && dupe.id !== id) return bad("Email already in use.");
      const isAdmin = b.isAdmin === undefined ? user.isAdmin : !!b.isAdmin;
      if (user.id === g.id && isAdmin !== user.isAdmin) return bad("You cannot change your own admin flag.");
      const ageVerifiedAt = b.ageVerified === undefined ? user.ageVerifiedAt : (b.ageVerified ? (user.ageVerifiedAt ?? new Date()) : null);
      const before = { email: user.email, name: user.name, isAdmin: user.isAdmin, ageVerified: !!user.ageVerifiedAt, marketingOptIn: user.marketingOptIn };
      const row = await prisma.user.update({ where: { id }, data: {
        email, name: str(b.name, 120).trim() || user.name, isAdmin, ageVerifiedAt,
        marketingOptIn: b.marketingOptIn === undefined ? user.marketingOptIn : !!b.marketingOptIn,
      } });
      const after = { email: row.email, name: row.name, isAdmin: row.isAdmin, ageVerified: !!row.ageVerifiedAt, marketingOptIn: row.marketingOptIn };
      await audit(g.id, "user.update", "user", id, before, after);
      return NextResponse.json({ ok: true, user: safeUser(row) });
    }
    case "send_reset_link": {
      const r = await sendResetLinkEmail(user);
      await audit(g.id, "user.send_reset_link", "user", id, undefined, { ok: r.ok, error: r.error ?? null });
      if (!r.ok) return bad(r.error || "Email could not be sent.", 502);
      return NextResponse.json({ ok: true });
    }
    case "send_welcome": {
      const r = await sendWelcomeEmail(user);
      await audit(g.id, "user.send_welcome", "user", id, undefined, { ok: r.ok, error: r.error ?? null });
      if (!r.ok) return bad(r.error || "Email could not be sent.", 502);
      return NextResponse.json({ ok: true });
    }
    case "comp_online_play": {
      const existing = await prisma.subscription.findFirst({ where: { userId: id, plan: "online_play", status: "active" } });
      if (existing) return bad("User already has an active online-play subscription.");
      const end = new Date(); end.setFullYear(end.getFullYear() + 1);
      const sub = await prisma.subscription.create({ data: { userId: id, plan: "online_play", status: "active", priceCents: 0, interval: "year", providerRef: null, currentPeriodEnd: end } });
      const granted = await grantStarterDeck(id);
      await audit(g.id, "user.comp_online_play", "user", id, undefined, { subscriptionId: sub.id, granted });
      return NextResponse.json({ ok: true, granted, subscriptionId: sub.id });
    }
    case "grant_packs": {
      const productId = str(b.productId, 40);
      const qty = Math.max(1, Math.min(100, int(b.qty, 1)));
      const p = await prisma.product.findUnique({ where: { id: productId } });
      if (!p || !p.cardSetId) return bad("Pick a digital pack product with a card set.");
      await grantPacks(id, productId, qty);
      await audit(g.id, "user.grant_packs", "user", id, undefined, { productId, qty });
      return NextResponse.json({ ok: true });
    }
    default: return bad("Unknown action");
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const g = await guard(); if (g instanceof NextResponse) return g;
  const { id } = await ctx.params;
  if (id === g.id) return bad("You cannot delete yourself.");
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return notFound();
  await prisma.user.delete({ where: { id } });
  await audit(g.id, "user.delete", "user", id, { email: user.email, name: user.name }, undefined);
  return NextResponse.json({ ok: true });
}
