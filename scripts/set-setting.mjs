/* Set a setting from the shell:  node --experimental-strip-types scripts/set-setting.mjs KEY VALUE [--if-unset]
   Used by deploy.sh to point INTRO_VIDEO_URL at the downloaded promo video. */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";

const [key, value, flag] = process.argv.slice(2);
if (!key || value === undefined) { console.error("usage: set-setting.mjs KEY VALUE [--if-unset]"); process.exit(1); }
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" }) });
const cur = await prisma.setting.findUnique({ where: { key } });
if (flag === "--if-unset" && cur?.value) {
  console.log(`  ${key} already set to ${cur.value} — leaving it`);
} else {
  await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
  console.log(`  ${key} = ${value}`);
}
await prisma.$disconnect();
