import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/auth";
import { guard, bad, readJson } from "../../_lib";

export const dynamic = "force-dynamic";

const ACTIONS: Record<string, { read?: boolean; starred?: boolean; archived?: boolean }> = {
  read: { read: true }, unread: { read: false },
  star: { starred: true }, unstar: { starred: false },
  archive: { archived: true }, unarchive: { archived: false },
};

/* POST { ids: string[], action: read|unread|star|unstar|archive|unarchive|delete } */
export async function POST(req: Request) {
  const g = await guard(); if (g instanceof NextResponse) return g;
  const b = await readJson<{ ids?: unknown; action?: unknown }>(req);
  const ids = Array.isArray(b.ids) ? b.ids.filter((x): x is string => typeof x === "string" && x.length > 0).slice(0, 500) : [];
  const action = String(b.action || "");
  if (!ids.length) return bad("ids required");
  if (action === "delete") {
    const r = await prisma.message.deleteMany({ where: { id: { in: ids } } });
    await audit(g.id, "email.bulk_delete", "message", null, undefined, { ids, count: r.count });
    return NextResponse.json({ ok: true, count: r.count });
  }
  const data = ACTIONS[action];
  if (!data) return bad("Unknown action");
  const r = await prisma.message.updateMany({ where: { id: { in: ids } }, data });
  return NextResponse.json({ ok: true, count: r.count });
}
