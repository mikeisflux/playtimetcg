import { readFileSync } from "fs";
import path from "path";

/* Preset page copy lives in prisma/pages/*.html (also seeded on deploy). */
function load(slug: string, fallback: string): string {
  try { return readFileSync(path.join(process.cwd(), "prisma", "pages", `${slug}.html`), "utf8"); } catch { return fallback; }
}

export const PAGE_PRESETS: Record<string, { title: string; html: string }> = {
  privacy: { title: "Privacy Policy", html: load("privacy", "<h2>Privacy Policy</h2><p>What we collect, why, and how long we keep it.</p>") },
  terms: { title: "Terms of Service", html: load("terms", "<h2>Terms of Service</h2><p>By using this site you agree to the following terms.</p>") },
  shipping: { title: "Shipping", html: load("shipping", "<h2>Shipping</h2><p>Orders ship in plain, discreet packaging within 2 business days.</p>") },
  returns: { title: "Returns", html: load("returns", "<h2>Returns</h2><p>No physical returns; a full 7-day money-back guarantee instead.</p>") },
  about: { title: "About", html: "<h2>About Play Time</h2><p>An adult card game for couples, written by a practicing sex therapist.</p>" },
};
