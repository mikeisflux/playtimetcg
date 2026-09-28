/* Helpers shared by the admin users routes (not a route itself):
   generated passwords, admin-issued password-set links and the welcome mail. */
import { randomInt } from "crypto";
import { prisma } from "@/lib/db";
import { newResetToken } from "@/lib/auth";
import { escapeHtml, sendMail, sendTemplate, type MailResult } from "@/lib/sendgrid";
import { getSetting, siteUrl } from "@/lib/settings";
import type { User } from "@/generated/prisma/client";

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/* 16 chars from an alphabet without look-alikes (0/O, 1/l/I). */
const ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!#$%&*+=?@";
export function generatePassword(length = 16): string {
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

/* Strip secrets before a user row goes to the client. */
export function safeUser(user: User) {
  const { passwordHash: _ph, resetToken: _rt, ...safe } = user;
  void _ph; void _rt;
  return safe;
}

/* Same mechanism as /api/auth/forgot: only the sha256 hash is stored. Admin-issued
   links get a longer life (24h) since the person may not be at their inbox yet. */
export async function issueResetLink(userId: string, ttlMs = 24 * 60 * 60_000): Promise<string> {
  const { token, hash } = newResetToken();
  await prisma.user.update({ where: { id: userId }, data: { resetToken: hash, resetExpiry: new Date(Date.now() + ttlMs) } });
  return `${await siteUrl()}/reset?token=${token}`;
}

/* Reset link mail: reuses the stored "password_reset" template like the forgot flow. */
export async function sendResetLinkEmail(user: Pick<User, "id" | "email" | "name">): Promise<MailResult> {
  const url = await issueResetLink(user.id);
  return sendTemplate("password_reset", user.email, {
    subject: "Reset your Play Time password",
    fallbackText: `Reset your password: ${url} (valid for 24 hours)`,
    name: user.name, resetUrl: url,
  }, { userId: user.id });
}

/* Welcome mail for accounts an admin created: on-brand, flush-left, zero radius. */
export async function sendWelcomeEmail(user: Pick<User, "id" | "email" | "name">): Promise<MailResult> {
  const url = await issueResetLink(user.id);
  const site = (await getSetting("SITE_NAME")) || "Play Time";
  const first = escapeHtml(user.name.split(/\s+/)[0] || user.name);
  const subject = `Your ${site} account is ready`;
  const text = [
    `Hi ${user.name},`,
    "",
    `An account has been created for you at ${site} (${user.email}).`,
    `Set your password here (valid for 24 hours): ${url}`,
    "",
    "If you weren't expecting this, you can ignore it.",
  ].join("\n");
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#0d0b10;color:#e8e4ee;font-family:'Space Grotesk',Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0d0b10;"><tr><td style="padding:40px 24px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0;text-align:left;">
<tr><td style="font-family:'Archivo',Arial Black,Arial,sans-serif;font-weight:900;font-size:13px;letter-spacing:0.16em;text-transform:uppercase;color:#FF5C8A;padding-bottom:24px;">${escapeHtml(site)}</td></tr>
<tr><td style="font-family:'Archivo',Arial Black,Arial,sans-serif;font-weight:900;font-size:32px;line-height:1;letter-spacing:-0.01em;text-transform:uppercase;color:#ffffff;padding-bottom:20px;">Your account is ready</td></tr>
<tr><td style="font-size:15px;line-height:1.55;color:#c9c4d2;padding-bottom:12px;">Hi ${first},</td></tr>
<tr><td style="font-size:15px;line-height:1.55;color:#c9c4d2;padding-bottom:28px;">An account has been created for you at ${escapeHtml(site)} under <span style="color:#ffffff;">${escapeHtml(user.email)}</span>. Choose a password to finish setting it up.</td></tr>
<tr><td style="padding-bottom:28px;"><a href="${url}" style="display:inline-block;background:#FF5C8A;color:#0d0b10;font-family:'JetBrains Mono',Menlo,Consolas,monospace;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;text-decoration:none;padding:14px 22px;border-radius:0;">Set your password</a></td></tr>
<tr><td style="font-family:'JetBrains Mono',Menlo,Consolas,monospace;font-size:11px;line-height:1.6;letter-spacing:0.06em;color:#8b8693;border-top:2px solid #2a272e;padding-top:18px;">This link is valid for 24 hours. If the button doesn't work, paste this into your browser:<br><a href="${url}" style="color:#5AB8F0;text-decoration:none;word-break:break-all;">${url}</a><br><br>If you weren't expecting this, you can ignore it.</td></tr>
</table></td></tr></table></body></html>`;
  return sendMail({ to: user.email, subject, text, html, templateSlug: "welcome_set_password", userId: user.id });
}
