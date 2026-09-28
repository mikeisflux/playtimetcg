import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    if (body.defaultAddress) {
      await prisma.address.updateMany({ where: { userId: user.id }, data: { isDefault: false } });
      await prisma.address.updateMany({ where: { id: String(body.defaultAddress), userId: user.id }, data: { isDefault: true } });
      return NextResponse.json({ ok: true });
    }
    if (body.deleteAddress) {
      await prisma.address.deleteMany({ where: { id: String(body.deleteAddress), userId: user.id } });
      return NextResponse.json({ ok: true });
    }
    const name = String(body.name || "").trim().slice(0, 80);
    if (!name) return NextResponse.json({ error: "Name is required." }, { status: 400 });
    await prisma.user.update({ where: { id: user.id }, data: { name, marketingOptIn: !!body.marketing } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Something went wrong — please try again." }, { status: 500 });
  }
}
