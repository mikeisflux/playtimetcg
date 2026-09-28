import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { guard, pageParams, paged } from "../_lib";

export const dynamic = "force-dynamic";

const DRAFT = "draft";
const FAILED_STATUSES = ["failed", "bounced", "spam"];
/* Rows whose status is NULL must survive the "not a draft" filter, so it is
   spelled out as an OR instead of `status: { not }` (which drops NULLs). */
const notDraft: Prisma.MessageWhereInput = { OR: [{ status: null }, { status: { not: DRAFT } }] };

/* Folder predicates. Drafts are outbound rows with status "draft" and only
   appear in Drafts (and All). */
const FOLDERS: Record<string, Prisma.MessageWhereInput> = {
  inbox: { direction: "in", archived: false },
  starred: { starred: true, AND: [notDraft] },
  sent: { direction: "out", archived: false, AND: [notDraft] },
  drafts: { status: DRAFT },
  archived: { archived: true, AND: [notDraft] },
  failed: { direction: "out", archived: false, status: { in: FAILED_STATUSES } },
  all: {},
};

const snippet = (t: string | null) => (t || "").replace(/\s+/g, " ").trim().slice(0, 160);

/* GET ?folder=inbox|starred|sent|drafts|archived|failed|all &q= &page= &pageSize= (&status= &channel=) */
export async function GET(req: Request) {
  const g = await guard(); if (g instanceof NextResponse) return g;
  const url = new URL(req.url);
  const folder = url.searchParams.get("folder") || "inbox";
  const q = (url.searchParams.get("q") || "").trim().slice(0, 200);
  const status = url.searchParams.get("status") || "";
  const channel = url.searchParams.get("channel") || "";
  const pageSize = url.searchParams.get("pageSize");
  if (pageSize) url.searchParams.set("size", pageSize);

  const where: Prisma.MessageWhereInput = {
    AND: [
      FOLDERS[folder] ?? FOLDERS.inbox,
      status ? { status } : {}, channel ? { channel } : {},
      q ? { OR: [{ subject: { contains: q, mode: "insensitive" } }, { fromEmail: { contains: q, mode: "insensitive" } }, { toEmail: { contains: q, mode: "insensitive" } }, { fromName: { contains: q, mode: "insensitive" } }, { cc: { contains: q, mode: "insensitive" } }, { text: { contains: q, mode: "insensitive" } }] } : {},
    ],
  };
  const { page, size, skip, take } = pageParams(url);
  const countWhere: Record<string, Prisma.MessageWhereInput> = { ...FOLDERS, inbox: { ...FOLDERS.inbox, read: false } };
  const keys = Object.keys(countWhere);
  const [total, rows, ...countVals] = await Promise.all([
    prisma.message.count({ where }),
    prisma.message.findMany({
      where, skip, take, orderBy: { createdAt: "desc" },
      select: { id: true, direction: true, channel: true, fromEmail: true, fromName: true, toEmail: true, cc: true, subject: true, text: true, read: true, starred: true, archived: true, threadId: true, status: true, statusMessage: true, templateSlug: true, createdAt: true, sentAt: true, _count: { select: { attachments: true } } },
    }),
    ...keys.map((k) => prisma.message.count({ where: countWhere[k] })),
  ]);
  const counts = Object.fromEntries(keys.map((k, i) => [k, countVals[i]])) as Record<string, number>;
  const list = rows.map(({ text, ...r }) => ({ ...r, snippet: snippet(text) }));
  return NextResponse.json({ ...paged(list, total, page, size), counts: { ...counts, unread: counts.inbox } });
}

/* Legacy multi-row PATCH { ids, read?, starred?, archived? } — kept for older
   callers; new code uses POST /api/admin/emails/bulk. */
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
