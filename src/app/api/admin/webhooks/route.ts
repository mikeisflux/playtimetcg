import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { divinityWebhookUrl } from "@/lib/divinitycoin";
import { getSetting } from "@/lib/settings";
import { guard, pageParams, paged } from "../_lib";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const g = await guard(); if (g instanceof NextResponse) return g;
  const url = new URL(req.url);
  const provider = url.searchParams.get("provider") || "";
  const status = url.searchParams.get("status") || "";
  const q = (url.searchParams.get("q") || "").trim();
  const where: Prisma.WebhookEventWhereInput = {
    ...(provider ? { provider } : {}), ...(status ? { status } : {}),
    ...(q ? { OR: [{ eventId: { contains: q } }, { type: { contains: q, mode: "insensitive" } }, { error: { contains: q, mode: "insensitive" } }] } : {}),
  };
  const { page, size, skip, take } = pageParams(url);
  const [total, rows, siteUrl] = await Promise.all([
    prisma.webhookEvent.count({ where }),
    prisma.webhookEvent.findMany({ where, skip, take, orderBy: { receivedAt: "desc" } }),
    getSetting("SITE_URL"),
  ]);
  const base = (siteUrl || "https://playtimetcg.com").replace(/\/$/, "");
  return NextResponse.json({
    ...paged(rows, total, page, size),
    urls: { divinitycoin: await divinityWebhookUrl(), sendgridEvents: `${base}/api/webhooks/sendgrid/events?key=<SENDGRID_EVENT_KEY>`, sendgridInbound: `${base}/api/webhooks/sendgrid/inbound?key=<INBOUND_EMAIL_KEY>` },
  });
}
