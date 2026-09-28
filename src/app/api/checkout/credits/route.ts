import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { divinitycoin, divinityConfigured } from "@/lib/divinitycoin";

/* Current DivinityCoin credit balance for the signed-in shopper. */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await divinityConfigured())) return NextResponse.json({ configured: false, available: 0, held: 0, total: 0 });
  try {
    const b = await divinitycoin.getBalance(user.id);
    return NextResponse.json({ configured: true, ...b });
  } catch (err) {
    return NextResponse.json({ configured: true, error: String(err) }, { status: 502 });
  }
}
