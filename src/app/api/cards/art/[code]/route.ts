import { NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import path from "path";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasOnlineAccess } from "@/lib/packs";

export const runtime = "nodejs";

/* Card artwork is never published on the open web (design handoff rule).
   It is served only to a signed-in player who owns the card or has online
   play, plus admins. Files come from scripts/import-card-art.mjs, which
   renders the print PDF into private-assets/cards/<CODE>.jpg (git-ignored). */
export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code: raw } = await params;
  const code = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!code) return NextResponse.json({ error: "not found" }, { status: 404 });
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!user.isAdmin) {
    const ok = code === "BACK"
      ? await hasOnlineAccess(user.id)
      : (await prisma.userCard.count({ where: { userId: user.id, card: { code } } })) > 0 || (await hasOnlineAccess(user.id));
    if (!ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const file = path.join(process.cwd(), "private-assets", "cards", `${code === "BACK" ? "back" : code}.jpg`);
  try {
    const st = await stat(file);
    const body = await readFile(file);
    return new NextResponse(new Uint8Array(body), {
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Length": String(st.size),
        "Cache-Control": "private, max-age=86400",
        "X-Robots-Tag": "noindex, noimageindex",
      },
    });
  } catch {
    return NextResponse.json({ error: "no artwork yet" }, { status: 404 });
  }
}
