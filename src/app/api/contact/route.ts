import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { sendMail } from "@/lib/sendgrid";

/* Contact form intake: validate, drop honeypot hits silently, rate-limit per
   IP (5 an hour, in-process), store an inbound Message for Admin → Inbox, then
   try to forward it to SUPPORT_EMAIL. Send failures never fail the request. */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const WINDOW_MS = 60 * 60 * 1000;
const LIMIT = 5;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= LIMIT) { hits.set(ip, recent); return true; }
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < WINDOW_MS)) hits.delete(k);
  return false;
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; } catch { return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 }); }

  const name = str(body.name, 120);
  const email = str(body.email, 200);
  const orderNumber = str(body.orderNumber, 40);
  const message = str(body.message, 5000);
  const website = str(body.website, 200);

  if (website) return NextResponse.json({ ok: true });
  if (!name) return NextResponse.json({ ok: false, error: "Please tell us your name." }, { status: 400 });
  if (!EMAIL_RE.test(email)) return NextResponse.json({ ok: false, error: "That email address doesn’t look right." }, { status: 400 });
  if (message.length < 10) return NextResponse.json({ ok: false, error: "Your message needs at least 10 characters." }, { status: 400 });

  const ip = (req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "").split(",")[0].trim() || "0.0.0.0";
  if (rateLimited(ip)) return NextResponse.json({ ok: false, error: "Too many messages from this connection. Please try again in an hour." }, { status: 429 });

  const supportEmail = (await getSetting("SUPPORT_EMAIL")) || null;
  const subject = `Contact form: ${name}${orderNumber ? ` (order #${orderNumber})` : ""}`;

  try {
    await prisma.message.create({
      data: {
        direction: "in", channel: "contact",
        fromEmail: email, fromName: name, toEmail: supportEmail,
        subject, text: message, html: null,
      },
    });
  } catch (err) {
    console.error("contact: message.create", err);
    return NextResponse.json({ ok: false, error: "We couldn’t save your message. Please try again in a moment." }, { status: 500 });
  }

  if (supportEmail) {
    try {
      await sendMail({
        to: supportEmail, replyTo: email, channel: "system", subject,
        text: `From: ${name} <${email}>${orderNumber ? `\nOrder: #${orderNumber}` : ""}\n\n${message}`,
      });
    } catch (err) { console.error("contact: sendMail", err); }
  }

  return NextResponse.json({ ok: true });
}
