import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/auth";
import { renderTemplate, sendMail, htmlToText } from "@/lib/sendgrid";
import { getSettings } from "@/lib/settings";
import { guard, bad, notFound, readJson, str, optStr, bool } from "../../../_lib";
import { SAMPLE_VARS } from "../_defaults";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const g = await guard(); if (g instanceof NextResponse) return g;
  const { id } = await ctx.params;
  const row = await prisma.emailTemplate.findUnique({ where: { id }, include: { versions: { orderBy: { version: "desc" }, select: { id: true, version: true, subject: true, changedBy: true, changeNote: true, createdAt: true } } } });
  return row ? NextResponse.json({ row }) : notFound();
}

export async function PUT(req: Request, ctx: Ctx) {
  const g = await guard(); if (g instanceof NextResponse) return g;
  const { id } = await ctx.params;
  const before = await prisma.emailTemplate.findUnique({ where: { id } });
  if (!before) return notFound();
  const b = await readJson(req);
  const subject = str(b.subject, 300).trim() || before.subject;
  const html = str(b.html, 200_000) || before.html;
  const text = b.text === undefined ? before.text : optStr(b.text, 50_000);
  const contentChanged = subject !== before.subject || html !== before.html || text !== before.text;
  const row = await prisma.$transaction(async (tx) => {
    if (contentChanged) {
      await tx.emailTemplateVersion.create({ data: { templateId: id, version: before.version, subject: before.subject, html: before.html, text: before.text, changedBy: g.email, changeNote: optStr(b.changeNote, 300) } });
    }
    return tx.emailTemplate.update({
      where: { id },
      data: {
        name: str(b.name, 120).trim() || before.name, description: b.description === undefined ? before.description : optStr(b.description, 500),
        subject, html, text, isActive: b.isActive === undefined ? before.isActive : bool(b.isActive),
        ...(contentChanged ? { version: { increment: 1 } } : {}),
      },
    });
  });
  await audit(g.id, "template.update", "email_template", id, { version: before.version }, { version: row.version });
  return NextResponse.json({ row });
}

/* actions: preview {vars?}, test {vars?}, restore {versionId} */
export async function POST(req: Request, ctx: Ctx) {
  const g = await guard(); if (g instanceof NextResponse) return g;
  const { id } = await ctx.params;
  const t = await prisma.emailTemplate.findUnique({ where: { id } });
  if (!t) return notFound();
  const b = await readJson<{ action?: string; vars?: Record<string, unknown>; versionId?: string; subject?: string; html?: string; text?: string }>(req);
  const s = await getSettings(["SITE_NAME", "SITE_URL", "SUPPORT_EMAIL"]);
  const vars = { ...SAMPLE_VARS, siteName: s.SITE_NAME || "Play Time", siteUrl: s.SITE_URL || "https://playtimetcg.com", supportEmail: s.SUPPORT_EMAIL || "hello@playtimetcg.com", ...(b.vars || {}) };
  const subjectSrc = b.subject ?? t.subject, htmlSrc = b.html ?? t.html, textSrc = b.text ?? t.text;
  switch (b.action) {
    case "preview":
      return NextResponse.json({ subject: renderTemplate(subjectSrc, vars), html: renderTemplate(htmlSrc, vars), text: textSrc ? renderTemplate(textSrc, vars) : htmlToText(renderTemplate(htmlSrc, vars)) });
    case "test": {
      const html = renderTemplate(htmlSrc, vars);
      const r = await sendMail({ to: g.email, subject: `[TEST] ${renderTemplate(subjectSrc, vars)}`, text: textSrc ? renderTemplate(textSrc, vars) : htmlToText(html), html, templateSlug: t.slug, channel: "system" });
      if (!r.ok) return bad(r.error || "Send failed", 502);
      await audit(g.id, "template.test", "email_template", id, undefined, { to: g.email });
      return NextResponse.json({ ok: true });
    }
    case "restore": {
      const v = await prisma.emailTemplateVersion.findUnique({ where: { id: str(b.versionId, 40) } });
      if (!v || v.templateId !== id) return bad("Version not found");
      const row = await prisma.$transaction(async (tx) => {
        await tx.emailTemplateVersion.create({ data: { templateId: id, version: t.version, subject: t.subject, html: t.html, text: t.text, changedBy: g.email, changeNote: `before restore of v${v.version}` } });
        return tx.emailTemplate.update({ where: { id }, data: { subject: v.subject, html: v.html, text: v.text, version: { increment: 1 } } });
      });
      await audit(g.id, "template.restore", "email_template", id, { version: t.version }, { version: row.version, from: v.version });
      return NextResponse.json({ row });
    }
    case "version": {
      const v = await prisma.emailTemplateVersion.findUnique({ where: { id: str(b.versionId, 40) } });
      if (!v || v.templateId !== id) return bad("Version not found");
      return NextResponse.json({ version: v });
    }
    default: return bad("Unknown action");
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const g = await guard(); if (g instanceof NextResponse) return g;
  const { id } = await ctx.params;
  const t = await prisma.emailTemplate.findUnique({ where: { id } });
  if (!t) return notFound();
  await prisma.emailTemplate.delete({ where: { id } });
  await audit(g.id, "template.delete", "email_template", id, { slug: t.slug }, undefined);
  return NextResponse.json({ ok: true });
}
