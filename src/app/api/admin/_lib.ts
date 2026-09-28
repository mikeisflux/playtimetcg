/* Shared helpers for /api/admin/* routes (not a route itself). */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import type { User } from "@/generated/prisma/client";

export const forbidden = () => NextResponse.json({ error: "forbidden" }, { status: 403 });
export const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });
export const notFound = () => NextResponse.json({ error: "not found" }, { status: 404 });

/* Returns the admin or a 403 response. Usage:
   const g = await guard(); if (g instanceof NextResponse) return g; */
export async function guard(): Promise<User | NextResponse> {
  const admin = await requireAdmin();
  return admin ?? forbidden();
}

export function pageParams(url: URL, defaultSize = 50) {
  const page = Math.max(1, Number(url.searchParams.get("page") || 1) || 1);
  const size = Math.min(200, Math.max(5, Number(url.searchParams.get("size") || defaultSize) || defaultSize));
  return { page, size, skip: (page - 1) * size, take: size };
}

export function paged<T>(rows: T[], total: number, page: number, size: number) {
  return { rows, total, page, pages: Math.max(1, Math.ceil(total / size)) };
}

export function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? "" : v instanceof Date ? v.toISOString() : typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers.map(csvEscape).join(","), ...rows.map((r) => r.map(csvEscape).join(","))].join("\r\n") + "\r\n";
}

export function csvResponse(filename: string, body: string) {
  return new NextResponse(body, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"` } });
}

/* Parse a CSV text into rows of strings (handles quotes and CRLF). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += c;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  try { return (await req.json()) as T; } catch { return {} as T; }
}

export const str = (v: unknown, max = 5000) => (v === null || v === undefined ? "" : String(v)).slice(0, max);
export const optStr = (v: unknown, max = 5000) => { const s = str(v, max).trim(); return s ? s : null; };
export const int = (v: unknown, d = 0) => { const n = Number(v); return Number.isFinite(n) ? Math.round(n) : d; };
export const bool = (v: unknown) => v === true || v === "true" || v === "on" || v === 1 || v === "1";
