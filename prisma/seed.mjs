/* Seeds the admin account, the product catalog (design/handoff/content/catalog.json),
   the card sets with the sample cards, the online-play products and the
   default settings. Idempotent — safe to run on every deploy.

   Admin: SEED_ADMIN_EMAIL (default divinitycomicsinc@gmail.com) with the
   password in SEED_ADMIN_PASSWORD. The password is never committed: put it in
   the server's .env (git-ignored). If it is missing on first run, a random
   one is generated and printed once. */
import "dotenv/config";
import { readFileSync, existsSync } from "fs";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";
import { randomBytes, scryptSync } from "crypto";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" }) });
const ADMIN_EMAIL = (process.env.SEED_ADMIN_EMAIL || "divinitycomicsinc@gmail.com").toLowerCase();

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

/* ───── admin ───── */
const existing = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
if (existing) {
  const data = { isAdmin: true };
  if (process.env.SEED_ADMIN_PASSWORD) data.passwordHash = hashPassword(process.env.SEED_ADMIN_PASSWORD);
  await prisma.user.update({ where: { email: ADMIN_EMAIL }, data });
  console.log(`✔ ${ADMIN_EMAIL} exists — ensured admin${process.env.SEED_ADMIN_PASSWORD ? " and applied SEED_ADMIN_PASSWORD" : ""}.`);
} else {
  const password = process.env.SEED_ADMIN_PASSWORD || randomBytes(9).toString("base64url");
  await prisma.user.create({
    data: { email: ADMIN_EMAIL, name: "Divinity Comics", passwordHash: hashPassword(password), isAdmin: true, ageVerifiedAt: new Date() },
  });
  console.log(`✔ Created admin ${ADMIN_EMAIL}.`);
  if (!process.env.SEED_ADMIN_PASSWORD) {
    console.log(`  Generated password: ${password}`);
    console.log("  ⚠ Save this now — it is not shown again. Set SEED_ADMIN_PASSWORD in .env to choose your own.");
  }
}

/* ───── card sets ───── */
const setDefs = [
  { slug: "base", name: "Base set", kind: "base", accent: "#FF5C8A", sortIndex: 0 },
  { slug: "date-night", name: "Date Night", kind: "expansion", accent: "#5AB8F0", sortIndex: 1 },
  { slug: "weekend", name: "Weekend Getaway", kind: "expansion", accent: "#A68CF5", sortIndex: 2 },
  { slug: "long-term", name: "Long-Term Couples", kind: "expansion", accent: "#3FD6C8", sortIndex: 3 },
  { slug: "quick", name: "Quick & Dirty", kind: "expansion", accent: "#FF5C8A", sortIndex: 4 },
  { slug: "toy", name: "Toy-Friendly", kind: "expansion", accent: "#E86BD8", sortIndex: 5 },
  { slug: "travel", name: "Travel", kind: "expansion", accent: "#FF6A3D", sortIndex: 6 },
  { slug: "monthly", name: "Monthly Drop", kind: "monthly", accent: "#FFD23F", sortIndex: 7 },
];
const sets = {};
for (const d of setDefs) {
  sets[d.slug] = await prisma.cardSet.upsert({ where: { slug: d.slug }, update: { name: d.name, kind: d.kind, accent: d.accent, sortIndex: d.sortIndex }, create: d });
}

/* ───── cards: docs/Play_Time_Full_Card_Set_with_Backs.csv is the source of truth
   (title, description, category, rarity, spice, time — owner supplied).
   design/cards/cards-meta.json supplies the print-PDF page order. ───── */
const game = JSON.parse(readFileSync(new URL("../design/handoff/content/game.json", import.meta.url), "utf8"));
const catalog = JSON.parse(readFileSync(new URL("../design/handoff/content/catalog.json", import.meta.url), "utf8"));
const meta = JSON.parse(readFileSync(new URL("../design/cards/cards-meta.json", import.meta.url), "utf8"));
const pageOf = Object.fromEntries(meta.map((m) => [m.code, m.page]));
const csvSetSlug = { "Base": "base", "Date Night": "date-night", "Weekend Getaway": "weekend", "Long-Term Couples": "long-term", "Quick & Dirty": "quick", "Toy-Friendly": "toy", "Travel": "travel" };

function parseCsv(text) {
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim() !== ""));
}
let cardRows = [];
try {
  const csvFile = ["../docs/Play_Time_Full_Card_Set_with_Backs.csv", "../docs/Play_Time_Full_Card_Set.csv"].map((f) => new URL(f, import.meta.url)).find((u) => existsSync(u));
  if (!csvFile) throw new Error("no card CSV in docs/");
  const [head, ...body] = parseCsv(readFileSync(csvFile, "utf8").replace(/^\uFEFF/, ""));
  const idx = Object.fromEntries(head.map((h, i) => [h.trim(), i]));
  cardRows = body.map((r) => ({
    set: csvSetSlug[r[idx.Set]?.trim()] ?? "base", code: r[idx.CardID].trim(), title: r[idx.Title].trim(), text: r[idx.Description].trim(),
    category: r[idx.Category].trim(), rarity: r[idx.Rarity].trim(), spice: Number(r[idx.SpiceLevel]) || 3, time: r[idx.TimeEstimate].trim() || "Varies",
  }));
} catch (e) {
  console.log("⚠ card CSV not readable — falling back to print-PDF metadata with placeholder titles.", e.message);
  const perSetIndex = {};
  cardRows = meta.map((m) => {
    const k = `${m.set}:${m.category}`; perSetIndex[k] = (perSetIndex[k] ?? 0) + 1;
    return { set: m.set, code: m.code, title: `${m.category} ${perSetIndex[k]}`, text: `Card text for ${m.code} is added in Admin → Cards.`, category: m.category, rarity: m.rarity, spice: m.spice, time: m.time };
  });
}
let cardCount = 0;
for (const c of cardRows) {
  const set = sets[c.set];
  if (!set || !c.code) continue;
  const data = { setId: set.id, title: c.title, text: c.text, category: c.category, rarity: c.rarity, spice: c.spice, time: c.time, sortIndex: pageOf[c.code] ?? 999 };
  await prisma.card.upsert({ where: { code: c.code }, update: data, create: { code: c.code, ...data } });
  cardCount++;
}
/* retire the pre-print placeholder codes (DN01…, WG01…, LT01…, QD01…, TF01…, TR01…TR12) */
const stale = await prisma.card.findMany({ where: { code: { in: [...["DN", "WG", "LT", "QD", "TF", "TR"].flatMap((p) => Array.from({ length: 12 }, (_, i) => `${p}${String(i + 1).padStart(2, "0")}`))] } }, include: { _count: { select: { owners: true } } } });
for (const c of stale) {
  if (c._count.owners) await prisma.card.update({ where: { id: c.id }, data: { active: false } });
  else await prisma.card.delete({ where: { id: c.id } });
}
console.log(`✔ ${cardCount} cards ensured from the card CSV${stale.length ? ` (${stale.length} old placeholders retired)` : ""}.`);

/* ───── products ───── */
let sort = 0;
for (const p of catalog.products) {
  await prisma.product.upsert({
    where: { slug: p.id },
    update: {},
    create: {
      slug: p.id, kind: "set", name: p.name, tag: p.tag, priceCents: Math.round(p.price * 100), accent: p.accent,
      includes: p.includes, requiresChoice: p.requiresChoice ?? undefined, featured: !!p.featured, imageSlot: p.imageSlot, sortIndex: sort++,
      description: p.id === "base" ? "72 cards, one 12-sided die, a drawstring bag and the rulebook. Everything you need for the first night and the fiftieth."
        : p.id === "bundle" ? "The base set plus any two expansion packs. Pick the two that sound most like you."
        : "The base set, all six expansion packs, a premium storage box and exclusive Rare cards you can’t get any other way.",
    },
  });
}
const expCopy = JSON.parse(readFileSync(new URL("../design/handoff/content/expansions.json", import.meta.url), "utf8")).packs;
for (const e of catalog.expansions) {
  const c = expCopy[e.id] ?? {};
  const copy = {
    tag: c.tagline ?? e.hook,
    description: c.web ?? null,
    includes: ["12 cards", c.heat, c.rarities, c.needs ?? "Shuffles into the base deck"].filter(Boolean),
  };
  const existing = await prisma.product.findUnique({ where: { slug: e.id }, select: { id: true, description: true } });
  if (!existing) {
    await prisma.product.create({ data: { slug: e.id, kind: "expansion", name: e.name, priceCents: Math.round(e.price * 100), accent: e.accent, cardSetId: sets[e.id]?.id, sortIndex: sort++, ...copy } });
  } else if (!existing.description) {
    // Owner copy lands once; edits made in Admin → Products afterwards are kept.
    await prisma.product.update({ where: { id: existing.id }, data: copy });
  } else sort++;
}
/* The Play Time Playkit — accessories, no cards. Created once; price and
   contents are edited in Admin → Products. Contents stay alphabetized. */
const PLAYKIT_INCLUDES = ["Blindfold", "Feather", "His and hers toy", "Lube", "Massage oil"];
const PLAYKIT_DESCRIPTION = "The night, kitted out. A blindfold, a feather, lube, massage oil and a toy for each of you, in one discreet box. Nothing here is required — the base deck plays on its own — but a lot of cards get better when it’s within reach. No cards inside.";
await prisma.product.upsert({
  where: { slug: "playkit" },
  update: {},
  create: {
    slug: "playkit", kind: "kit", name: "Play Time Playkit", tag: "Everything the cards ask for", priceCents: 6000, accent: "#A68CF5",
    includes: PLAYKIT_INCLUDES,
    description: PLAYKIT_DESCRIPTION,
    imageSlot: "site-prod-playkit", sortIndex: sort++,
  },
});
/* one-time: add the blindfold to a Playkit seeded before it was in the list */
{
  const kit = await prisma.product.findUnique({ where: { slug: "playkit" } });
  if (kit && Array.isArray(kit.includes) && !kit.includes.includes("Blindfold")) {
    await prisma.product.update({ where: { id: kit.id }, data: { includes: PLAYKIT_INCLUDES, description: PLAYKIT_DESCRIPTION } });
  }
}
/* Product photos committed under public/products/<slug>.jpg — applied once
   (a photo uploaded later in Admin → Products wins). */
for (const slug of ["base", "bundle", "collector", "playkit"]) {
  if (existsSync(new URL(`../public/products/${slug}.jpg`, import.meta.url))) {
    await prisma.product.updateMany({ where: { slug, imageUrl: null }, data: { imageUrl: `/products/${slug}.jpg` } });
  }
}
/* online play + digital + subscriptions */
await prisma.product.upsert({
  where: { slug: "online-play" }, update: {},
  create: { slug: "online-play", kind: "subscription", subPlan: "online_play", subInterval: "month", name: "Online play", tag: "Monthly · cancel anytime", priceCents: 999, accent: "#FFD23F", digital: true, includes: ["The full 72-card base deck in your collection", "Private two-player rooms", "The digital 12-sided die", "Buy and tear open digital packs"], description: "Play Time on any screen. Subscribe and the whole base deck is yours to play online with your partner, wherever they are.", sortIndex: sort++ },
});
await prisma.product.upsert({
  where: { slug: "monthly-cards" }, update: {},
  create: { slug: "monthly-cards", kind: "subscription", subPlan: "monthly_cards", subInterval: "month", name: "Monthly 3-card drop", tag: "3 new cards every month, shipped", priceCents: 700, accent: "#E86BD8", digital: false, includes: ["Three brand-new physical cards each month", "Ships discreetly", "Cancel anytime"], description: "A small envelope every month with three cards that aren’t in any pack. Keep the deck growing.", sortIndex: sort++ },
});
for (const slug of ["date-night", "weekend", "long-term", "quick", "toy", "travel"]) {
  const setRow = sets[slug];
  await prisma.product.upsert({
    where: { slug: `digital-${slug}` }, update: {},
    create: { slug: `digital-${slug}`, kind: "digital_pack", name: `${setRow.name} — digital pack`, tag: "3 random cards from the set", priceCents: 299, accent: setRow.accent, digital: true, cardSetId: setRow.id, packSize: 3, includes: ["3 cards from " + setRow.name, "Tear it open on screen", "Added to your collection instantly"], sortIndex: sort++ },
  });
}
console.log("✔ Products ensured (3 sets, the Playkit, 6 expansions, 2 subscriptions, 6 digital packs).");

/* ───── legal & help pages (created only when missing; edit in Admin → Pages) ───── */
const PAGES = [
  { slug: "privacy", title: "Privacy Policy" }, { slug: "terms", title: "Terms of Service" },
  { slug: "shipping", title: "Shipping" }, { slug: "returns", title: "Returns" },
  { slug: "faq", title: "Questions, answered." },
];
let pagesCreated = 0;
for (const pg of PAGES) {
  const exists = await prisma.page.findUnique({ where: { slug: pg.slug } });
  if (exists) continue;
  const html = readFileSync(new URL(`./pages/${pg.slug}.html`, import.meta.url), "utf8");
  await prisma.page.create({ data: { slug: pg.slug, title: pg.title, html, published: true } });
  pagesCreated++;
}
console.log(`✔ Pages ensured (${pagesCreated} created).`);

/* ───── settings defaults (only when unset) ───── */
const defaults = {
  SITE_URL: "https://playtimetcg.com", SITE_NAME: "Play Time", SUPPORT_EMAIL: "hello@playtimetcg.com",
  AGE_GATE_LEAVE_URL: "https://www.google.com", INTRO_VIDEO_ENABLED: "true", DISCREET_PACKAGING: "true",
  STORE_CURRENCY: "USD", SHIPPING_FLAT_CENTS: "600", SHIPPING_FREE_OVER_CENTS: "7500", TAX_RATE_PERCENT: "0",
  ONLINE_PLAY_ENABLED: "true", STARTER_SET_SLUG: "base", PACK_RARITY_WEIGHTS: "common:70,uncommon:25,rare:5", PACK_GUARANTEE_UNCOMMON: "true",
  DIVINITYCOIN_API_URL: "https://divinitycoin.com", DIVINITYCOIN_PARTNER_SLUG: "playtimetcg", DIVINITYCOIN_TEST_MODE: "false",
  MAIL_FROM_NAME: "Play Time", SENDGRID_TRACKING: "true",
  SEO_TITLE_TEMPLATE: "%s | Play Time", SEO_DEFAULT_TITLE: "Play Time — The Card Game for Couples (18+)",
  SEO_DEFAULT_DESCRIPTION: "72 cards, one 12-sided die, and a better night than the one you were planning. An adult card game for couples, written by a practicing sex therapist.",
  SEO_DEFAULT_KEYWORDS: "couples card game, adult card game, date night game, intimacy game, sex therapist card game, Play Time",
  SEO_OG_IMAGE: "/og.png",
};
for (const [key, value] of Object.entries(defaults)) {
  await prisma.setting.upsert({ where: { key }, update: {}, create: { key, value } });
}
console.log("✔ Default settings ensured.");
await prisma.$disconnect();
