import { NextResponse } from "next/server";
import { sendMail } from "@/lib/sendgrid";
import { audit } from "@/lib/auth";
import { guard, bad } from "../../_lib";

export const dynamic = "force-dynamic";

export async function POST() {
  const g = await guard(); if (g instanceof NextResponse) return g;
  const r = await sendMail({
    to: g.email, subject: "Play Time — SendGrid test", channel: "system",
    text: `This is a test message from the Play Time admin panel, sent at ${new Date().toISOString()}. If you are reading it, SendGrid is configured.`,
    html: `<div style="background:#0d0b10;color:#f2f0f4;padding:24px;font-family:Arial,sans-serif"><h1 style="font-size:22px;text-transform:uppercase;margin:0 0 12px">SendGrid works.</h1><p>Sent from the admin panel at ${new Date().toLocaleString()}.</p></div>`,
  });
  await audit(g.id, "setting.test_email", "setting", "SENDGRID_API_KEY", undefined, { ok: r.ok, error: r.error });
  if (!r.ok) return bad(r.error || "Send failed", 502);
  return NextResponse.json({ ok: true, to: g.email, messageId: r.messageId });
}
