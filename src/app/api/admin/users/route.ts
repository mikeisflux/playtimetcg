import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { audit, hashPassword } from "@/lib/auth";
import { guard, bad, pageParams, paged, readJson, str, bool } from "../_lib";
import { EMAIL_RE, generatePassword, safeUser, sendWelcomeEmail } from "./_lib";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const g = await guard(); if (g instanceof NextResponse) return g;
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  const filter = url.searchParams.get("filter") || "";
  const where: Prisma.UserWhereInput = {
    ...(q ? { OR: [{ email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }, { id: q }] } : {}),
    ...(filter === "admins" ? { isAdmin: true } : {}),
    ...(filter === "subscribers" ? { subscriptions: { some: { status: "active" } } } : {}),
  };
  const { page, size, skip, take } = pageParams(url);
  const [total, rows] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where, skip, take, orderBy: { createdAt: "desc" },
      select: {
        id: true, email: true, name: true, isAdmin: true, createdAt: true, ageVerifiedAt: true, marketingOptIn: true,
        _count: { select: { orders: true, cards: true } },
        subscriptions: { where: { status: { in: ["active", "past_due"] } }, select: { plan: true, status: true } },
      },
    }),
  ]);
  return NextResponse.json(paged(rows, total, page, size));
}

/* Manual account creation from Admin → Users. Body:
   { email, name, password?, isAdmin?, ageVerified?, marketingOptIn?, sendWelcome? }
   A blank password gets a generated one, returned exactly once as `generatedPassword`. */
export async function POST(req: Request) {
  const g = await guard(); if (g instanceof NextResponse) return g;
  const b = await readJson<{ email?: string; name?: string; password?: string; isAdmin?: boolean; ageVerified?: boolean; marketingOptIn?: boolean; sendWelcome?: boolean }>(req);
  const email = str(b.email, 200).trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return bad("Enter a valid email address.");
  const name = str(b.name, 120).trim();
  if (!name) return bad("Name is required.");
  let password = str(b.password, 200);
  if (password && password.length < 8) return bad("Password must be at least 8 characters (or leave it blank to generate one).");
  const generated = !password;
  if (generated) password = generatePassword();

  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) return bad("A user with that email already exists.", 409);
  const isAdmin = bool(b.isAdmin), ageVerified = bool(b.ageVerified), marketingOptIn = bool(b.marketingOptIn), sendWelcome = bool(b.sendWelcome);
  let user;
  try {
    user = await prisma.user.create({
      data: { email, name, passwordHash: await hashPassword(password), isAdmin, marketingOptIn, ageVerifiedAt: ageVerified ? new Date() : null },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return bad("A user with that email already exists.", 409);
    throw err;
  }
  await audit(g.id, "user.create", "user", user.id, undefined, { email, name, isAdmin, ageVerified, marketingOptIn, sendWelcome, generatedPassword: generated });

  let mail: { ok: boolean; error?: string } | null = null;
  if (sendWelcome) {
    const r = await sendWelcomeEmail(user);
    mail = { ok: r.ok, ...(r.error ? { error: r.error } : {}) };
  }
  return NextResponse.json({ user: safeUser(user), mail, ...(generated ? { generatedPassword: password } : {}) }, { status: 201 });
}
