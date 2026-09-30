/* Session auth: scrypt password hashing + HMAC-signed cookie tokens.
   Uses only node:crypto — no extra dependencies. */
import { createHash, createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { cookies, headers } from "next/headers";
import { prisma } from "./db";
import type { User } from "@/generated/prisma/client";

const scrypt = promisify(scryptCb) as (p: string, s: string, n: number) => Promise<Buffer>;
export const SESSION_COOKIE = "pt_session";
export const AGE_COOKIE = "pt-site-age-ok";
export const INTRO_COOKIE = "pt-intro-seen";
const WEEK = 60 * 60 * 24 * 7;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = await scrypt(password, salt, 64);
  return `${salt}:${buf.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const buf = await scrypt(password, salt, 64);
  const other = Buffer.from(hash, "hex");
  return buf.length === other.length && timingSafeEqual(buf, other);
}

/* Password-reset tokens: only the sha256 hash is stored. */
export function newResetToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("hex");
  return { token, hash: createHash("sha256").update(token).digest("hex") };
}
export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

let cachedSecret: string | null = null;
async function authSecret(): Promise<string> {
  if (cachedSecret) return cachedSecret;
  if (process.env.AUTH_SECRET) { cachedSecret = process.env.AUTH_SECRET; return cachedSecret; }
  const row = await prisma.setting.findUnique({ where: { key: "AUTH_SECRET" } });
  if (row?.value) { cachedSecret = row.value; return cachedSecret; }
  const secret = randomBytes(32).toString("hex");
  await prisma.setting.upsert({ where: { key: "AUTH_SECRET" }, update: {}, create: { key: "AUTH_SECRET", value: secret } });
  /* cluster-safe: two workers can race this bootstrap — re-read the winner */
  const winner = await prisma.setting.findUnique({ where: { key: "AUTH_SECRET" } });
  cachedSecret = winner?.value || secret;
  return cachedSecret;
}

const b64u = (s: string) => Buffer.from(s).toString("base64url");
/* the session is bound to the CURRENT password: a reset logs other sessions out */
const pwVersion = (passwordHash: string) => passwordHash.slice(0, 16);

export async function signToken(uid: string, passwordHash?: string): Promise<string> {
  const payload = b64u(JSON.stringify({
    uid, exp: Math.floor(Date.now() / 1000) + WEEK,
    ...(passwordHash ? { pv: pwVersion(passwordHash) } : {}),
  }));
  const sig = createHmac("sha256", await authSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export async function verifyToken(token: string): Promise<{ uid: string; pv?: string; exp: number } | null> {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expect = createHmac("sha256", await authSecret()).update(payload).digest("base64url");
  const a = Buffer.from(sig), b = Buffer.from(expect);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof data.uid !== "string" || data.exp < Date.now() / 1000) return null;
    return { uid: data.uid, pv: typeof data.pv === "string" ? data.pv : undefined, exp: Number(data.exp) };
  } catch { return null; }
}

export async function createSession(uid: string, passwordHash?: string) {
  if (!passwordHash) {
    const u = await prisma.user.findUnique({ where: { id: uid }, select: { passwordHash: true } });
    passwordHash = u?.passwordHash;
  }
  const token = await signToken(uid, passwordHash);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true, sameSite: "lax", path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: WEEK,
  });
}

export async function destroySession() {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
}

export async function getSessionUser(): Promise<User | null> {
  try {
    const jar = await cookies();
    const token = jar.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    const t = await verifyToken(token);
    if (!t) return null;
    const u = await prisma.user.findUnique({ where: { id: t.uid } });
    if (!u) return null;
    if (t.pv && t.pv !== pwVersion(u.passwordHash)) return null;
    return u;
  } catch { return null; }
}

export async function requireAdmin(): Promise<User | null> {
  const u = await getSessionUser();
  return u?.isAdmin ? u : null;
}

export async function clientIp(): Promise<string> {
  try {
    const h = await headers();
    return (h.get("x-forwarded-for") || h.get("x-real-ip") || "").split(",")[0].trim() || "0.0.0.0";
  } catch { return "0.0.0.0"; }
}

export async function userAgent(): Promise<string> {
  try { return (await headers()).get("user-agent") || ""; } catch { return ""; }
}

/* The buyer's browser, as seen by the handler serving it: first entry of
   X-Forwarded-For (Caddy sets it) or X-Real-IP, plus the User-Agent. Passed
   to DivinityCoin on every charge so a fraud dispute has evidence. */
export async function requestOrigin(): Promise<{ ip: string | null; userAgent: string | null }> {
  const ip = await clientIp();
  return { ip: ip === "0.0.0.0" ? null : ip, userAgent: (await userAgent()) || null };
}

/* Age gate: a first-party cookie with a 30-day expiry so server-rendered
   pages can read it (the prototype used localStorage). */
export async function isAgeVerified(): Promise<boolean> {
  try { return (await cookies()).get(AGE_COOKIE)?.value === "1"; } catch { return false; }
}

export async function audit(adminId: string, action: string, resource: string, resourceId?: string | null, before?: unknown, after?: unknown) {
  try {
    await prisma.adminAuditLog.create({
      data: {
        adminId, action, resource, resourceId: resourceId ?? null,
        before: before === undefined ? undefined : JSON.parse(JSON.stringify(before)),
        after: after === undefined ? undefined : JSON.parse(JSON.stringify(after)),
        ip: await clientIp(),
      },
    });
  } catch (err) { console.error("audit", err); }
}
