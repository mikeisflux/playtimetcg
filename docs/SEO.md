# SEO — what is in place and how to edit it

The public site is server-rendered, so every crawler sees the full page, the
age gate included: the gate (`src/components/AgeGate.tsx`) is a fixed overlay
rendered *after* `<main>` in `src/app/(site)/layout.tsx`, never a replacement
for the content. Only imagery is withheld until the `pt-site-age-ok` cookie is
set (`isAgeVerified()`), which is by design — card art and product photos are
never served to un-gated visitors or crawlers.

## Where things live

| Concern | File |
| --- | --- |
| Per-page metadata builder, private-path rules, JSON-LD builders | `src/lib/seo.ts` |
| Site-wide defaults (title template, icons, share image, `rating=adult`) | `src/app/layout.tsx` |
| Breadcrumb trail + BreadcrumbList JSON-LD | `src/components/Breadcrumbs.tsx` |
| `<JsonLd>` renderer, `ImageSlot` (lazy / priority images) | `src/components/ui.tsx` |
| `robots.txt` | `src/app/robots.ts` |
| `sitemap.xml` | `src/app/sitemap.ts` |
| Web app manifest | `src/app/manifest.ts` |
| Share image, icons, favicon | `public/og.png`, `public/icon-192.png`, `public/icon-512.png`, `public/apple-touch-icon.png`, `public/favicon.ico`, `src/app/icon.svg` |
| Breadcrumb / "next up" styles | end of `src/app/globals.css` |

## Metadata per route

Every page calls `buildMetadata(path, defaults)` from its `generateMetadata`.
It produces: `<title>` (the root template appends ` | Play Time`; pass
`absolute: true` to skip it, as the home page does), meta description,
canonical URL, Open Graph (type, locale, site_name, title, description, url,
1200×630 image), Twitter `summary_large_image`, `robots` (with
`max-image-preview:large`), `<meta name="rating" content="adult">`, and the
Search Console / Bing verification tags when those settings are filled in.

Keep titles ≤ 48 characters before the suffix (≤ 60 total) and descriptions
≤ 160 characters. Admin → SEO shows an audit of overrides that exceed this.

### Private routes

`PRIVATE_PREFIXES` in `src/lib/seo.ts` (`/admin`, `/api`, `/account`,
`/checkout`, `/cart`, `/play`, `/login`, `/signup`, `/forgot`, `/reset`) are
always `noindex` (`/play` is `noindex,follow` so its links still count),
excluded from the sitemap and disallowed in `robots.txt`, regardless of what a
page or an Admin → SEO override says. To make `/play` indexable again, remove
it from that list.

### Admin → SEO overrides

`SeoEntry` rows (one per path) override title, description, keywords,
canonical, OG title/description/image, robots, sitemap priority/changefreq and
raw JSON-LD. The path list in Admin → SEO is `SITE_ROUTES` (public static
routes) + every active product + every published Page. A raw JSON-LD override
**replaces** the page's default graph for that path; the BreadcrumbList is
rendered separately and always stays.

### Settings (Admin → Settings → SEO & analytics)

`SITE_URL` (must be `https://playtimetcg.com` in production — it is the base of
every canonical, OG url, sitemap entry and JSON-LD id), `SITE_NAME`,
`SEO_DEFAULT_TITLE`, `SEO_TITLE_TEMPLATE`, `SEO_DEFAULT_DESCRIPTION`,
`SEO_DEFAULT_KEYWORDS`, `SEO_OG_IMAGE` (default `/og.png`),
`SEO_TWITTER_HANDLE`, `SEO_ROBOTS_EXTRA` (extra disallow paths),
`SEO_ORG_JSONLD` (replaces the generated Organization graph),
`GOOGLE_SITE_VERIFICATION`, `BING_SITE_VERIFICATION`, `GA_MEASUREMENT_ID`,
`META_PIXEL_ID`. GA and the Meta pixel are injected only after the age gate is
passed, at the end of `<body>`, so they never block rendering.

## Structured data (server-rendered `application/ld+json`)

| Route | Graph |
| --- | --- |
| `/` | `Organization` (Divinity Comics Inc, brand Play Time) + `WebSite` (`isFamilyFriendly: false`) |
| `/shop/[slug]` | `Product` (sku = slug, brand, `isFamilyFriendly: false`, audience 18+, `Offer` in USD, InStock, return/shipping links for physical goods) |
| `/shop`, `/expansions`, `/pricing` | `ItemList` of `Product` + `Offer` |
| `/how-to-play` | `HowTo` built from `HOW_STEPS` in `src/lib/content.ts` |
| `/faq` | `FAQPage` parsed from the FAQ page's `<h3>` / `<p>` pairs (Admin → Pages) |
| every inner page | `BreadcrumbList` via `<Breadcrumbs>` |

There is no site search, so `WebSite` carries no `SearchAction`.

## Sitemap and robots

`/sitemap.xml` lists `SITE_ROUTES`, every active product (`/shop/<slug>`) and
every published `Page` row, skipping anything private or overridden to
`noindex`. `lastmod` is the newest of the deploy stamp
(`NEXT_PUBLIC_PT_BUILD`), the product/page `updatedAt` and the SEO override's
`updatedAt` — never "now". Both files read settings/DB inside `try/catch`, so
they render (static routes only) when the database is unreachable.

## On-page conventions

- Exactly one `<h1>` per page; section titles are `<h2>`, items `<h3>`.
- Inner pages start with `<Breadcrumbs items={[{ name, href }]} />`.
- Guide pages chain: home → how-to-play → the-deck → expansions → shop → faq,
  with a "Next" button in each closing section and `.nextup` link rows.
- Images: `ImageSlot` lazy-loads by default and takes `priority` for the one
  above-the-fold image; every real image has descriptive alt text; the
  placeholder is `aria-hidden` (no empty-alt images reach crawlers). The hero
  video uses `preload="metadata"` and falls back to `/og.png` as its poster.
- Fonts: Google Fonts with `preconnect` + `display=swap`.

## Regenerating the images

`public/og.png` and the icons were drawn with `@napi-rs/canvas` (dark
`#0d0b10`, bold uppercase wordmark, the seven-color heat ramp, no photography).
To redraw them, rerun the generator with a bold sans font on the path (the
original script is in the session notes; any 1200×630 PNG works for `og.png`,
and Admin → Settings `SEO_OG_IMAGE` can point at a different file).

## For the owner

- Fill `GOOGLE_SITE_VERIFICATION` / `BING_SITE_VERIFICATION`, then submit
  `https://playtimetcg.com/sitemap.xml` in Search Console and Bing Webmaster.
- Set `GA_MEASUREMENT_ID` and/or `META_PIXEL_ID` when ready.
- Set `SEO_TWITTER_HANDLE` if the brand has an X account.
- Confirm `SITE_URL` is `https://playtimetcg.com` in the production database.
