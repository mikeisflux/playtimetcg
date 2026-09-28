/* Admin-managed settings stored in SQL, with .env fallback.
   Everything an operator needs to configure lives in /admin/settings. */
import { prisma } from "./db";

export interface SettingDef {
  key: string;
  label: string;
  group: string;
  hint?: string;
  secret?: boolean;
  readonly?: boolean; // computed / informational rows
}

export const SETTING_GROUPS = [
  "Site",
  "DivinityCoin",
  "SendGrid",
  "SEO & analytics",
  "Store",
  "Online play",
  "Security",
] as const;

export const SETTING_KEYS: SettingDef[] = [
  // Site
  { key: "SITE_URL", label: "Public site URL", group: "Site", hint: "https://playtimetcg.com" },
  { key: "SITE_NAME", label: "Site name", group: "Site", hint: "Play Time" },
  { key: "SUPPORT_EMAIL", label: "Support email", group: "Site", hint: "hello@playtimetcg.com" },
  { key: "INTRO_VIDEO_URL", label: "Intro video URL (mp4/webm)", group: "Site", hint: "/uploads/intro.mp4 or a CDN URL — shown once on first visit" },
  { key: "INTRO_VIDEO_POSTER", label: "Intro video poster image", group: "Site", hint: "optional" },
  { key: "INTRO_VIDEO_ENABLED", label: "Show intro video on first visit", group: "Site", hint: "true / false" },
  { key: "AGE_GATE_LEAVE_URL", label: "Age gate “Leave” destination", group: "Site", hint: "https://www.google.com" },
  { key: "MAINTENANCE_MODE", label: "Maintenance mode", group: "Site", hint: "true / false — admins can still log in" },
  { key: "MAINTENANCE_MESSAGE", label: "Maintenance message", group: "Site" },

  // DivinityCoin
  { key: "DIVINITYCOIN_API_URL", label: "DivinityCoin API base URL", group: "DivinityCoin", hint: "https://divinitycoin.com (public checkout) — or the VPN address http://10.10.0.1:3001 for the internal API" },
  { key: "DIVINITYCOIN_API_KEY", label: "DivinityCoin partner API key", group: "DivinityCoin", secret: true, hint: "sent as X-Internal-Key on every server-to-server call" },
  { key: "DIVINITYCOIN_PARTNER_SLUG", label: "Partner slug registered on DivinityCoin", group: "DivinityCoin", hint: "playtimetcg" },
  { key: "DIVINITYCOIN_WEBHOOK_SECRET", label: "DivinityCoin webhook signing secret", group: "DivinityCoin", secret: true, hint: "HMAC-SHA256 secret DivinityCoin uses to sign webhook deliveries" },
  { key: "DIVINITYCOIN_WEBHOOK_URL", label: "Webhook URL (paste into DivinityCoin partner settings)", group: "DivinityCoin", readonly: true, hint: "https://playtimetcg.com/api/webhooks/divinitycoin" },
  { key: "DIVINITYCOIN_CHECKOUT_PATH", label: "Hosted checkout path", group: "DivinityCoin", hint: "/api/partner/checkout (default)" },
  { key: "DIVINITYCOIN_ALLOW_CREDITS", label: "Allow paying with DivinityCoin credit balance", group: "DivinityCoin", hint: "true / false" },
  { key: "DIVINITYCOIN_TEST_MODE", label: "Test mode", group: "DivinityCoin", hint: "true — orders can be marked paid from /admin without a real webhook" },

  // SendGrid
  { key: "SENDGRID_API_KEY", label: "SendGrid API key", group: "SendGrid", secret: true, hint: "SG.…" },
  { key: "MAIL_FROM", label: "Outgoing from address", group: "SendGrid", hint: "hello@playtimetcg.com (verified sender)" },
  { key: "MAIL_FROM_NAME", label: "Outgoing from name", group: "SendGrid", hint: "Play Time" },
  { key: "MAIL_REPLY_TO", label: "Reply-to address", group: "SendGrid" },
  { key: "MAIL_BCC_ADMIN", label: "BCC admin on order emails", group: "SendGrid", hint: "optional" },
  { key: "MAIL_FOOTER", label: "Email footer text", group: "SendGrid" },
  { key: "INBOUND_EMAIL_KEY", label: "Inbound Parse key", group: "SendGrid", secret: true, hint: "any long random string; Inbound Parse URL = /api/webhooks/sendgrid/inbound?key=<it>" },
  { key: "SENDGRID_EVENT_KEY", label: "Event webhook key", group: "SendGrid", secret: true, hint: "Event Webhook URL = /api/webhooks/sendgrid/events?key=<it>" },
  { key: "SENDGRID_TRACKING", label: "Open/click tracking", group: "SendGrid", hint: "true / false" },

  // SEO & analytics
  { key: "SEO_DEFAULT_TITLE", label: "Default page title", group: "SEO & analytics", hint: "Play Time — The Card Game for Couples (18+)" },
  { key: "SEO_TITLE_TEMPLATE", label: "Title template", group: "SEO & analytics", hint: "%s | Play Time" },
  { key: "SEO_DEFAULT_DESCRIPTION", label: "Default meta description", group: "SEO & analytics" },
  { key: "SEO_DEFAULT_KEYWORDS", label: "Default keywords (comma separated)", group: "SEO & analytics" },
  { key: "SEO_OG_IMAGE", label: "Default Open Graph image", group: "SEO & analytics", hint: "/og.png (dark wordmark + ramp — safe everywhere)" },
  { key: "SEO_TWITTER_HANDLE", label: "Twitter / X handle", group: "SEO & analytics", hint: "@playtimetcg" },
  { key: "SEO_ROBOTS_EXTRA", label: "Extra robots.txt disallow paths", group: "SEO & analytics", hint: "comma separated" },
  { key: "SEO_ORG_JSONLD", label: "Organization JSON-LD (raw)", group: "SEO & analytics" },
  { key: "GA_MEASUREMENT_ID", label: "Google Analytics measurement ID", group: "SEO & analytics", hint: "G-XXXXXXX" },
  { key: "GOOGLE_SITE_VERIFICATION", label: "Google Search Console verification", group: "SEO & analytics" },
  { key: "BING_SITE_VERIFICATION", label: "Bing Webmaster verification", group: "SEO & analytics" },
  { key: "META_PIXEL_ID", label: "Meta pixel ID", group: "SEO & analytics" },

  // Store
  { key: "STORE_CURRENCY", label: "Currency", group: "Store", hint: "USD" },
  { key: "SHIPPING_FLAT_CENTS", label: "Flat shipping (cents)", group: "Store", hint: "e.g. 600 = $6.00; 0 = free" },
  { key: "SHIPPING_FREE_OVER_CENTS", label: "Free shipping over (cents)", group: "Store", hint: "e.g. 7500" },
  { key: "TAX_RATE_PERCENT", label: "Tax rate %", group: "Store", hint: "0 if handled elsewhere" },
  { key: "DISCREET_PACKAGING", label: "Ships in discreet packaging", group: "Store", hint: "true / false — adds the line to Shop and the cart footer" },
  { key: "STORE_ANNOUNCEMENT", label: "Announcement bar text", group: "Store", hint: "optional" },

  // Online play
  { key: "ONLINE_PLAY_ENABLED", label: "Online play enabled", group: "Online play", hint: "true / false" },
  { key: "STARTER_SET_SLUG", label: "Starter set granted on subscribe", group: "Online play", hint: "base" },
  { key: "PACK_RARITY_WEIGHTS", label: "Digital pack rarity weights", group: "Online play", hint: "common:70,uncommon:25,rare:5" },
  { key: "PACK_GUARANTEE_UNCOMMON", label: "Guarantee ≥1 Uncommon per pack", group: "Online play", hint: "true / false" },
  { key: "CARD_ART_PUBLIC", label: "Show card artwork on the public site", group: "Site", hint: "true — sample cards on Home, The deck and product pages use the real art; false — art only inside online play" },

  // Security
  { key: "RECAPTCHA_SITE_KEY", label: "reCAPTCHA v3 site key", group: "Security" },
  { key: "RECAPTCHA_SECRET_KEY", label: "reCAPTCHA v3 secret key", group: "Security", secret: true },
  { key: "ADMIN_ALLOWED_IPS", label: "Admin IP allow-list", group: "Security", hint: "comma separated, blank = any" },
  { key: "SESSION_DAYS", label: "Session length (days)", group: "Security", hint: "7" },
];

const cache = new Map<string, { v: string; t: number }>();
const TTL = 15_000;

export async function getSetting(key: string): Promise<string> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < TTL) return hit.v;
  let v = "";
  try {
    const row = await prisma.setting.findUnique({ where: { key } });
    if (row?.value) v = row.value;
  } catch { /* table may not exist yet */ }
  if (!v) v = process.env[key] || "";
  cache.set(key, { v, t: Date.now() });
  return v;
}

export async function getSettings(keys: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  await Promise.all(keys.map(async (k) => { out[k] = await getSetting(k); }));
  return out;
}

export async function setSetting(key: string, value: string) {
  await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
  cache.delete(key);
}

export async function deleteSetting(key: string) {
  await prisma.setting.deleteMany({ where: { key } });
  cache.delete(key);
}

export function flag(v: string, fallback = false): boolean {
  if (!v) return fallback;
  return /^(1|true|yes|on)$/i.test(v.trim());
}

export async function siteUrl(): Promise<string> {
  return ((await getSetting("SITE_URL")) || "https://playtimetcg.com").replace(/\/$/, "");
}

export async function siteName(): Promise<string> {
  return (await getSetting("SITE_NAME")) || "Play Time";
}
