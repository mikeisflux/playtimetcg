/* Seeds the admin account, the product catalog (design/handoff/content/catalog.json),
   the card sets with the sample cards, the online-play products and the
   default settings. Idempotent — safe to run on every deploy.

   Admin: SEED_ADMIN_EMAIL (default divinitycomicsinc@gmail.com) with the
   password in SEED_ADMIN_PASSWORD. The password is never committed: put it in
   the server's .env (git-ignored). If it is missing on first run, a random
   one is generated and printed once. */
import "dotenv/config";
import { readFileSync } from "fs";
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

/* ───── cards: the seven published samples + numbered placeholders so the
   base deck is 72 cards. Replace the placeholders in Admin → Cards (or
   import the real deck as CSV). ───── */
const game = JSON.parse(readFileSync(new URL("../design/handoff/content/game.json", import.meta.url), "utf8"));
const catalog = JSON.parse(readFileSync(new URL("../design/handoff/content/catalog.json", import.meta.url), "utf8"));
const categories = game.die.map((d) => d.category);
const sampleByCode = Object.fromEntries(game.sampleCards.map((c) => [c.id, c]));
/* category distribution across 72 cards: 12/12/12/12/12/6/6 (matching die odds) */
const dist = { "Soft Touch": 12, "Flirty Fun": 12, "Classic Heat": 12, "Turn It Up": 12, "Wild Card": 12, "Focus on You": 6, "Free Play": 6 };
let n = 1;
let baseCount = 0;
for (const cat of categories) {
  for (let i = 0; i < dist[cat]; i++, n++) {
    const code = `B${String(n).padStart(3, "0")}`;
    const sample = sampleByCode[code] && sampleByCode[code].category === cat ? sampleByCode[code] : null;
    const rarity = sample ? sample.rarity : (i % 6 === 5 ? "Rare" : i % 3 === 2 ? "Uncommon" : "Common");
    const data = sample
      ? { title: sample.title, category: cat, rarity, spice: sample.spice, time: sample.time, text: sample.text }
      : { title: `${cat} ${i + 1}`, category: cat, rarity, spice: Math.min(5, 1 + Math.floor(i / 3)), time: "10 min", text: `Card text for ${code} is added in Admin → Cards. This placeholder keeps the online deck at 72 cards until the real copy is imported.` };
    await prisma.card.upsert({
      where: { code },
      update: sample ? data : { category: cat }, /* never overwrite edited placeholders */
      create: { code, setId: sets.base.id, sortIndex: n, ...data },
    });
    baseCount++;
  }
}
/* samples whose code sits outside the distribution slot still need to exist */
for (const c of game.sampleCards) {
  await prisma.card.upsert({
    where: { code: c.id },
    update: { title: c.title, category: c.category, rarity: c.rarity, spice: c.spice, time: c.time, text: c.text },
    create: { code: c.id, setId: sets.base.id, title: c.title, category: c.category, rarity: c.rarity, spice: c.spice, time: c.time, text: c.text, sortIndex: Number(c.id.slice(1)) },
  });
}
console.log(`✔ Base set: ${baseCount} cards ensured (7 published samples, rest placeholders).`);

/* expansion placeholders: 12 cards each */
const expPrefix = { "date-night": "DN", weekend: "WG", "long-term": "LT", quick: "QD", toy: "TF", travel: "TR" };
for (const [slug, prefix] of Object.entries(expPrefix)) {
  for (let i = 1; i <= 12; i++) {
    const code = `${prefix}${String(i).padStart(2, "0")}`;
    const cat = categories.filter((c) => c !== "Free Play")[(i - 1) % 6];
    await prisma.card.upsert({
      where: { code },
      update: {},
      create: { code, setId: sets[slug].id, sortIndex: i, title: `${sets[slug].name} ${i}`, category: cat, rarity: i % 6 === 0 ? "Rare" : i % 3 === 0 ? "Uncommon" : "Common", spice: Math.min(5, 1 + Math.floor(i / 3)), time: "10 min", text: `Card text for ${code} is added in Admin → Cards.` },
    });
  }
}
console.log("✔ Expansion sets: 6 × 12 placeholder cards ensured.");

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
for (const e of catalog.expansions) {
  await prisma.product.upsert({
    where: { slug: e.id },
    update: {},
    create: { slug: e.id, kind: "expansion", name: e.name, tag: e.hook, priceCents: Math.round(e.price * 100), accent: e.accent, includes: ["12 cards", "Shuffles into the base deck"], cardSetId: sets[e.id]?.id, sortIndex: sort++ },
  });
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
for (const [slug, prefix] of Object.entries(expPrefix)) {
  const setRow = sets[slug];
  await prisma.product.upsert({
    where: { slug: `digital-${slug}` }, update: {},
    create: { slug: `digital-${slug}`, kind: "digital_pack", name: `${setRow.name} — digital pack`, tag: "3 random cards from the set", priceCents: 299, accent: setRow.accent, digital: true, cardSetId: setRow.id, packSize: 3, includes: ["3 cards from " + setRow.name, "Tear it open on screen", "Added to your collection instantly"], sortIndex: sort++ },
  });
  void prefix;
}
console.log("✔ Products ensured (3 sets, 6 expansions, 2 subscriptions, 6 digital packs).");

/* ───── settings defaults (only when unset) ───── */
const defaults = {
  SITE_URL: "https://playtimetcg.com", SITE_NAME: "Play Time", SUPPORT_EMAIL: "hello@playtimetcg.com",
  AGE_GATE_LEAVE_URL: "https://www.google.com", INTRO_VIDEO_ENABLED: "true", DISCREET_PACKAGING: "true",
  STORE_CURRENCY: "USD", SHIPPING_FLAT_CENTS: "600", SHIPPING_FREE_OVER_CENTS: "7500", TAX_RATE_PERCENT: "0",
  ONLINE_PLAY_ENABLED: "true", STARTER_SET_SLUG: "base", PACK_RARITY_WEIGHTS: "common:70,uncommon:25,rare:5", PACK_GUARANTEE_UNCOMMON: "true",
  DIVINITYCOIN_API_URL: "https://divinitycoin.com", DIVINITYCOIN_PARTNER_SLUG: "playtimetcg", DIVINITYCOIN_ALLOW_CREDITS: "true", DIVINITYCOIN_TEST_MODE: "false",
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
