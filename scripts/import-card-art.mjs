/* Renders the print PDF of the cards into per-card artwork for the online
   game and points each Card row at it.

     node --experimental-strip-types scripts/import-card-art.mjs [path/to/cards.pdf]

   Default input: docs/Play Time Cards Print.pdf. Page N ↔ design/cards/
   cards-meta.json[N-1].code; the final page is the card back.
   Output: private-assets/cards/<CODE>.jpg and back.jpg (git-ignored, served
   only through /api/cards/art/<CODE> to players who own the card). */
import "dotenv/config";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import path from "path";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { createCanvas } from "@napi-rs/canvas";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";

const root = process.cwd();
const input = process.argv[2] || path.join(root, "docs", "Play Time Cards Print.pdf");
const outDir = path.join(root, "private-assets", "cards");
const meta = JSON.parse(readFileSync(path.join(root, "design", "cards", "cards-meta.json"), "utf8"));
const SCALE = Number(process.env.CARD_ART_SCALE || 2); // ~2× print points → crisp on retina
const QUALITY = Number(process.env.CARD_ART_QUALITY || 86);

if (!existsSync(input)) {
  console.error(`✘ ${input} not found. Add the cards PDF to docs/ (or pass a path).`);
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });

const doc = await getDocument({ data: new Uint8Array(readFileSync(input)), useSystemFonts: true }).promise;
console.log(`PDF has ${doc.numPages} pages; ${meta.length} cards in cards-meta.json`);

async function renderPage(i, file) {
  const page = await doc.getPage(i);
  const vp = page.getViewport({ scale: SCALE });
  const canvas = createCanvas(Math.ceil(vp.width), Math.ceil(vp.height));
  const ctx = canvas.getContext("2d");
  await page.render({ canvasContext: ctx, viewport: vp, canvas }).promise;
  writeFileSync(file, canvas.toBuffer("image/jpeg", QUALITY));
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" }) });
let done = 0, missing = 0;
for (const card of meta) {
  if (card.page > doc.numPages) { missing++; continue; }
  const file = path.join(outDir, `${card.code}.jpg`);
  await renderPage(card.page, file);
  await prisma.card.updateMany({ where: { code: card.code }, data: { imageUrl: `cards/${card.code}.jpg` } });
  done++;
  if (done % 12 === 0) console.log(`  …${done}/${meta.length}`);
}
if (doc.numPages > meta.length) {
  await renderPage(doc.numPages, path.join(outDir, "back.jpg"));
  console.log("✔ card back rendered");
}
await prisma.$disconnect();
console.log(`✔ ${done} cards rendered to ${outDir}${missing ? ` (${missing} listed cards had no page)` : ""}`);
