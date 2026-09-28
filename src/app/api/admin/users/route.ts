import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { guard, pageParams, paged } from "../_lib";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const g = await guard(); if (g instanceof NextResponse) return g;
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  const filter = url.searchParams.get("filter") || "";
  const where: Prisma.UserWhereInput = {
    ...(q ? { OR: [{ email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }, { id: q }] } : {}),
    ...(filter === "admins" ? { isAdmin: true } : {}),
    ...(filter === "subscribers" ? { subscriptions: { some: { status: "active" } } } : {}),
  };
  const { page, size, skip, take } = pageParams(url);
  const [total, rows] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where, skip, take, orderBy: { createdAt: "desc" },
      select: {
        id: true, email: true, name: true, isAdmin: true, createdAt: true, ageVerifiedAt: true, marketingOptIn: true,
        _count: { select: { orders: true, cards: true } },
        subscriptions: { where: { status: { in: ["active", "past_due"] } }, select: { plan: true, status: true } },
      },
    }),
  ]);
  return NextResponse.json(paged(rows, total, page, size));
}
