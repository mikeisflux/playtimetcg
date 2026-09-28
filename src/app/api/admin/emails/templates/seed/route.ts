import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/auth";
import { htmlToText } from "@/lib/sendgrid";
import { guard } from "../../../_lib";
import { DEFAULT_TEMPLATES } from "../_defaults";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const g = await guard(); if (g instanceof NextResponse) return g;
  const force = new URL(req.url).searchParams.get("force") === "1";
  let created = 0, updated = 0;
  for (const t of DEFAULT_TEMPLATES) {
    const existing = await prisma.emailTemplate.findUnique({ where: { slug: t.slug } });
    if (!existing) {
      await prisma.emailTemplate.create({ data: { slug: t.slug, name: t.name, description: t.description, subject: t.subject, html: t.html, text: t.text ?? htmlToText(t.html) } });
      created++;
    } else if (force) {
      await prisma.$transaction([
        prisma.emailTemplateVersion.create({ data: { templateId: existing.id, version: existing.version, subject: existing.subject, html: existing.html, text: existing.text, changedBy: g.email, changeNote: "before reset to default" } }),
        prisma.emailTemplate.update({ where: { id: existing.id }, data: { subject: t.subject, html: t.html, text: t.text ?? htmlToText(t.html), version: { increment: 1 } } }),
      ]);
      updated++;
    }
  }
  await audit(g.id, "template.seed", "email_template", null, undefined, { created, updated, force });
  return NextResponse.json({ created, updated, total: DEFAULT_TEMPLATES.length });
}
