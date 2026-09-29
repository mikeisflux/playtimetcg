/* Renders the Open Graph / social share image at print resolution.

   Output is 3600 × 1890 px — the standard 1200 × 630 social frame at 300 dpi
   (the PNG carries a 300 dpi pHYs chunk) — so it stays sharp wherever a
   platform re-samples it. Fonts are bundled in design/og/fonts so the render
   is identical on any machine, no network needed.

   Usage:
     node scripts/render-og.mjs                       → public/og.png (wordmark + ramp)
     node scripts/render-og.mjs --photo path/to.jpg   → adds the photo in the right panel
     node scripts/render-og.mjs --out other.png       → different output file
   Env: OG_SCALE (default 3) multiplies the 1200 × 630 base frame. */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const photoPath = opt("--photo");
const out = path.resolve(root, opt("--out") || "public/og.png");
const S = Number(process.env.OG_SCALE || 3);
const DPI = 300;

const tokens = JSON.parse(readFileSync(path.join(root, "design/handoff/tokens.json"), "utf8"));
const C = tokens.color;
const RAMP = Object.values(C.heat);

const fontsDir = path.join(root, "design/og/fonts");
GlobalFonts.registerFromPath(path.join(fontsDir, "ArchivoBlack-400.woff2"), "Archivo Black");
GlobalFonts.registerFromPath(path.join(fontsDir, "JetBrainsMono-Regular.ttf"), "JetBrains Mono");
GlobalFonts.registerFromPath(path.join(fontsDir, "JetBrainsMono-Bold.ttf"), "JetBrains Mono");

const W = 1200, H = 630;
const canvas = createCanvas(W * S, H * S);
const ctx = canvas.getContext("2d");
ctx.scale(S, S);
ctx.imageSmoothingEnabled = true;
ctx.imageSmoothingQuality = "high";
ctx.textBaseline = "alphabetic";

/* Tracked (letter-spaced) text, drawn glyph by glyph so it renders the same everywhere. */
function tracked(text, x, y, spacing) {
  let cx = x;
  for (const ch of text) { ctx.fillText(ch, cx, y); cx += ctx.measureText(ch).width + spacing; }
  return cx - x - spacing;
}
function display(px) { ctx.font = `${px}px "Archivo Black"`; }
function mono(px, bold = false) { ctx.font = `${bold ? "bold " : ""}${px}px "JetBrains Mono"`; }
function ramp(x, y, w, h) {
  const seg = w / RAMP.length;
  RAMP.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(x + i * seg, y, Math.ceil(seg), h); });
}
/* Draws an image cover-cropped into a box, keeping the crop centered. */
function cover(img, x, y, w, h) {
  const r = Math.max(w / img.width, h / img.height);
  const dw = img.width * r, dh = img.height * r;
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  ctx.restore();
}

ctx.fillStyle = C.ink; ctx.fillRect(0, 0, W, H);
const M = 72; // margin, flush left like the site

if (photoPath) {
  /* Photo layout: wordmark stacked on the left, the photo on the right,
     ramp and tagline underneath — same composition as the campaign cover. */
  const img = await loadImage(readFileSync(path.resolve(photoPath)));
  const px = 660, py = 48, pw = W - px - 48, ph = 400;
  cover(img, px, py, pw, ph);
  ctx.fillStyle = C["text-strong"];
  display(196); ctx.fillText("PLAY", M - 6, 236); ctx.fillText("TIME", M - 6, 420);
  ramp(M, 484, W - M * 2, 34);
  display(38); ctx.fillStyle = C["text-strong"]; tracked("ROLL THE DIE. RAISE THE HEAT.", M, 586, 1);
  mono(18); ctx.fillStyle = C["text-dim"]; ctx.textAlign = "right";
  tracked("PLAYTIMETCG.COM", W - M - 8 * 18 * 0.6 - 14 * 4, 586, 4); ctx.textAlign = "left";
} else {
  /* Wordmark layout: ramp on top, eyebrow, wordmark, two-line tagline, footer. */
  ramp(0, 0, W, 12);
  ctx.fillStyle = C["text-dim"]; mono(20);
  tracked("A CARD GAME FOR COUPLES · 18+", M, 148, 6);
  ctx.fillStyle = C["text-strong"]; display(150);
  ctx.fillText("PLAY TIME", M - 6, 312);
  display(44);
  ctx.fillStyle = C["text-strong"]; ctx.fillText("ROLL THE DIE.", M, 396);
  ctx.fillStyle = C.highlight; ctx.fillText("RAISE THE HEAT.", M, 448);
  ctx.fillStyle = C["text-dim"]; mono(18);
  tracked("72 CARDS · D12 · 7 CATEGORIES", M, 578, 4);
  const site = "PLAYTIMETCG.COM";
  const siteW = [...site].reduce((w, ch) => w + ctx.measureText(ch).width + 4, -4);
  tracked(site, W - M - siteW, 578, 4);
}

/* PNG with a 300 dpi pHYs chunk so print and design tools read it as 300 dpi. */
function withDpi(png, dpi) {
  const ppm = Math.round(dpi / 0.0254);
  const data = Buffer.alloc(9); data.writeUInt32BE(ppm, 0); data.writeUInt32BE(ppm, 4); data[8] = 1;
  const type = Buffer.from("pHYs");
  const crcTable = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcTable[n] = c >>> 0; }
  const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const len = Buffer.alloc(4); len.writeUInt32BE(9, 0);
  const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc(Buffer.concat([type, data])), 0);
  const chunk = Buffer.concat([len, type, data, crcBuf]);
  // Drop any existing pHYs, then insert ours right after IHDR (8-byte signature + 25-byte IHDR chunk).
  const chunks = []; let p = 8;
  while (p < png.length) { const l = png.readUInt32BE(p); const t = png.toString("latin1", p + 4, p + 8); const c = png.subarray(p, p + 12 + l); if (t !== "pHYs") chunks.push(c); p += 12 + l; }
  return Buffer.concat([png.subarray(0, 8), chunks[0], chunk, ...chunks.slice(1)]);
}

mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, withDpi(canvas.toBuffer("image/png"), DPI));
console.log(`✔ ${path.relative(root, out)} — ${W * S} × ${H * S} px @ ${DPI} dpi${photoPath ? ` (photo: ${photoPath})` : ""}`);
