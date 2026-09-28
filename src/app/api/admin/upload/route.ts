import { NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";
import { audit } from "@/lib/auth";
import { guard, bad } from "../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_IMAGE = 25 * 1024 * 1024;
const MAX_VIDEO = 200 * 1024 * 1024;

export async function POST(req: Request) {
  const g = await guard(); if (g instanceof NextResponse) return g;
  let form: FormData;
  try { form = await req.formData(); } catch { return bad("multipart form expected"); }
  const file = form.get("file");
  if (!(file instanceof File)) return bad("file missing");
  const isVideo = file.type.startsWith("video/");
  const max = isVideo ? MAX_VIDEO : MAX_IMAGE;
  if (file.size > max) return bad(`File too large (max ${Math.round(max / 1024 / 1024)}MB)`, 413);
  const safe = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "file";
  const name = `${randomBytes(6).toString("hex")}-${safe}`;
  const dir = path.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), new Uint8Array(await file.arrayBuffer()));
  const url = `/uploads/${name}`;
  await audit(g.id, "upload", "file", name, undefined, { url, size: file.size, type: file.type });
  return NextResponse.json({ url, size: file.size, type: file.type, name: file.name });
}
