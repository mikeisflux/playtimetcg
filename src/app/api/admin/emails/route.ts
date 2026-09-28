import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { guard, pageParams, paged } from "../_lib";

export const dynamic = "force-dynamic";

/* folder: inbox | starred | sent | archived | failed | all ; plus status=, q=, channel= */
export async function GET(req: Request) {
  const g = await guard(); if (g instanceof NextResponse) return g;
  const url = new URL(req.url);
  const folder = url.searchParams.get("folder") || "inbox";
  const q = (url.searchParams.get("q") || "").trim();
  const status = url.searchParams.get("status") || "";
  const channel = url.searchParams.get("channel") || "";
  const folderWhere: Record<string, Prisma.MessageWhereInput> = {
    inbox: { direction: "in", archived: false },
    starred: { starred: true },
    sent: { direction: "out" },
    archived: { archived: true },
    failed: { direction: "out", status: { in: ["failed", "bounced", "spam"] } },
    all: {},
  };
  const where: Prisma.MessageWhereInput = {
    ...(folderWhere[folder] ?? folderWhere.inbox),
    ...(status ? { status } : {}), ...(channel ? { channel } : {}),
    ...(q ? { OR: [{ subject: { contains: q, mode: "insensitive" } }, { fromEmail: { contains: q, mode: "insensitive" } }, { toEmail: { contains: q, mode: "insensitive" } }, { fromName: { contains: q, mode: "insensitive" } }, { text: { contains: q, mode: "insensitive" } }] } : {}),
  };
  const { page, size, skip, take } = pageParams(url);
  const [total, rows, counts] = await Promise.all([
    prisma.message.count({ where }),
    prisma.message.findMany({
      where, skip, take, orderBy: { createdAt: "desc" },
      select: { id: true, direction: true, channel: true, fromEmail: true, fromName: true, toEmail: true, subject: true, read: true, starred: true, archived: true, threadId: true, status: true, statusMessage: true, templateSlug: true, createdAt: true, sentAt: true, _count: { select: { attachments: true } } },
    }),
    Promise.all([
      prisma.message.count({ where: { direction: "in", archived: false, read: false } }),
      prisma.message.count({ where: { starred: true } }),
      prisma.message.count({ where: { direction: "out", status: { in: ["failed", "bounced", "spam"] } } }),
    ]),
  ]);
  return NextResponse.json({ ...paged(rows, total, page, size), counts: { unread: counts[0], starred: counts[1], failed: counts[2] } });
}

export async function PATCH(req: Request) {
  const g = await guard(); if (g instanceof NextResponse) return g;
  const b = (await req.json().catch(() => ({}))) as { ids?: string[]; read?: boolean; starred?: boolean; archived?: boolean };
  if (!Array.isArray(b.ids) || !b.ids.length) return NextResponse.json({ error: "ids required" }, { status: 400 });
  const data: Prisma.MessageUpdateManyMutationInput = {};
  if (typeof b.read === "boolean") data.read = b.read;
  if (typeof b.starred === "boolean") data.starred = b.starred;
  if (typeof b.archived === "boolean") data.archived = b.archived;
  await prisma.message.updateMany({ where: { id: { in: b.ids } }, data });
  return NextResponse.json({ ok: true });
}
