/* Renders the seven category card backs from the backs PDF (one page per
   back, in die order: 1–2 Soft Touch … 12 Free Play) to
   private-assets/cards/back-1.jpg … back-7.jpg, plus back.jpg (page 1) as
   the neutral fallback if none exists yet.

   Usage: node scripts/import-card-backs.mjs [path/to/card-backs.pdf]
   The deploy script downloads the PDF from Google Drive and runs this. */
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { createCanvas } from "@napi-rs/canvas";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const input = process.argv[2] || path.join(root, "private-assets", "card-backs.pdf");
const outDir = path.join(root, "private-assets", "cards");
const SCALE = Number(process.env.CARD_ART_SCALE || 2);
const QUALITY = Number(process.env.CARD_ART_QUALITY || 86);

if (!existsSync(input)) { console.error(`✘ ${input} not found.`); process.exit(1); }
mkdirSync(outDir, { recursive: true });
const doc = await getDocument({ data: new Uint8Array(readFileSync(input)), useSystemFonts: true }).promise;
console.log(`Backs PDF has ${doc.numPages} page(s); expecting 7 (die order).`);
let n = 0;
for (let i = 1; i <= Math.min(7, doc.numPages); i++) {
  const page = await doc.getPage(i);
  const vp = page.getViewport({ scale: SCALE });
  const canvas = createCanvas(Math.ceil(vp.width), Math.ceil(vp.height));
  const ctx = canvas.getContext("2d");
  await page.render({ canvasContext: ctx, viewport: vp, canvas }).promise;
  writeFileSync(path.join(outDir, `back-${i}.jpg`), canvas.toBuffer("image/jpeg", QUALITY));
  n++;
}
if (n && !existsSync(path.join(outDir, "back.jpg"))) copyFileSync(path.join(outDir, "back-1.jpg"), path.join(outDir, "back.jpg"));
console.log(`✔ ${n} card back(s) rendered to ${outDir}`);
if (doc.numPages !== 7) console.log(`⚠ expected 7 pages, got ${doc.numPages} — check that the PDF is backs only, in die order.`);
