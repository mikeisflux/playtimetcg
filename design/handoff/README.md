# Handoff: Play Time — Storefront Website

## Overview
Play Time is an adult card game for couples: 72 cards and a 12-sided die, written by a practicing sex therapist. This site is a **direct store**. It sells the base set, two bundles and six expansion packs, sits behind an 18+ age gate, and explains the game well enough that a visitor buys.

The **Home page is designed in high fidelity** (`reference/Play Time Website - Home.dc.html`). The other pages below are specified here and must be built in the same visual system. Home is the source of truth for every visual decision.

## About the Design Files
The files in `reference/` are **design references built in HTML**. They are prototypes showing the intended look and behavior, **not production code to copy**. Recreate them in a proper framework.

The repo (`mikeisflux/playtimetcg`) is empty, so choose the stack. Recommended:
- **Next.js (App Router) + TypeScript** for pages and server components
- **Plain CSS modules or Tailwind** with the tokens from `tokens.json` mapped to CSS variables
- **A hosted commerce backend** for cart and checkout (see "Commerce" below). Do not build card processing yourself.

To view the reference, open `reference/Play Time Website - Home.dc.html` in a browser from that folder. It needs `support.js` and `image-slot.js` beside it, which are included. Its styles are all inline. Read values from it or from `tokens.json`.

## Fidelity
**High-fidelity** for Home: final colors, type, spacing, copy and interactions. Recreate it pixel-accurately, then build the remaining pages from the same components and tokens.

## Pages in scope
1. **Home** — designed. See below.
2. **How to play** — spec below.
3. **The deck** — categories, rarity, heat. Spec below.
4. **Expansions** — spec below.
5. **Pricing** — spec below.
6. **Shop / Cart / Product** — spec below.
7. **Age gate** — designed as an overlay on Home and applies site-wide.

Also needed but not designed: **Privacy, Terms, Shipping, Returns, Contact**. These are plain text pages in the same layout. The owner must supply the legal copy; do not write it.

---

## Global rules
- **Dark site.** The page background is `#0d0b10` everywhere. Alternate sections sit on `#121015` with a 2px `#2a272e` rule above and below.
- **Zero border radius** anywhere. No shadows. Structure comes from rules: 2px between sections and 1px between rows.
- **Flush left.** Headings, copy and button labels align left (`text-align: left` on buttons).
- **Content width:** `max-width: 1280px; margin: 0 auto; padding-inline: clamp(20px, 5vw, 64px)`.
- **Section vertical padding:** `clamp(64px, 9vw, 120px)`.
- **Responsive:** every multi-column block is `display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, Npx), 1fr))`, so columns collapse without media queries. The N values are listed per section. Type is fluid via `clamp()`. At narrow widths the nav links wrap under the wordmark; on mobile, replace them with a menu button (not designed, but keep it flush left in a full-width sheet, same type).
- **Heat ramp strip.** Seven equal flex segments in ramp order: `#3FD6C8 #5AB8F0 #A68CF5 #E86BD8 #FF5C8A #FF6A3D #FFD23F`. It appears 4px tall at the very top of the page, 10px under the hero image, and 6px in the age gate. Make it a component.
- **Fonts** (Google Fonts, SIL OFL): Archivo 500/700/800/900 for display, Space Grotesk 400/500/700 for body, JetBrains Mono 400/500 for labels. Load with `display=swap`.
- **Links:** default `#FF5C8A`, hover `#FFD23F`. Nav and footer links override this (see below).
- **Text selection:** background `#FF5C8A`, text `#0d0b10`.
- **Focus:** add `:focus-visible { outline: 2px solid #FFD23F; outline-offset: 2px }` to every interactive element. It isn't in the prototype, but it is required for accessibility.

## Components

### Buttons (all: no radius, Archivo 800 14px, uppercase, letter-spacing 0.1em, left-aligned label)
| Variant | Rest | Hover |
|---|---|---|
| Primary | bg `#FF5C8A`, text `#0d0b10`, padding 18px 24px | bg `#FFD23F` |
| Secondary (outline) | 2px border `#f2f0f4`, text `#f2f0f4`, padding 16px 22px | bg `#f2f0f4`, text `#0d0b10` |
| Light | bg `#f2f0f4`, text `#0d0b10` | bg `#FFD23F` |
| On pink (Close section) | bg `#0d0b10`, text `#fff` | bg `#fff`, text `#0d0b10` |
| Small pack "Add" | transparent, 2px border in the pack's accent, padding 8px 12px, 12px text | bg `#f2f0f4`, text `#0d0b10` |
| Featured product | same as Primary but bg `#FFD23F` | stays `#FFD23F` |

### Eyebrow label
JetBrains Mono 12px, uppercase, letter-spacing 0.22em, colored with one ramp color per section. Always sits 12px above an H2.

### Spice meter
Five equal segments with a 3px gap, 8–10px tall. Filled segments use the category color and empty ones `rgba(255,255,255,0.12)`. **Always five segments.**

### Rarity frame
The card is wrapped in a 3–4px frame (see `content/game.json → rarities`):
- **Common:** `rgba(255,255,255,0.28)`
- **Uncommon:** silver gradient
- **Rare:** full heat-ramp gradient

### Game card (web version of the physical card)
- `aspect-ratio: 63.5 / 88.9`, width `min(100%, 340px)`.
- Frame by rarity, then inner background `#0d0b10`, split into:
  1. **Image area** — top 44%. Placeholder is `#16141a` with a 135° 1px stripe pattern at 5% white. Set name top-left and card ID top-right, in mono 11px `#8b8693`.
  2. **Category bar** — 6px, in the category color.
  3. **Body** — padding 16px 18px 18px, gap 10px:
     - Category (mono 11px, category color) with rarity on the right (mono 10px `#8b8693`)
     - Title (Archivo 900, 24px, uppercase, line-height 0.95)
     - Text (Space Grotesk 14px/1.45, `#b8b3c0`)
     - Spice meter
     - `SPICE n/5` and the time, in mono 11px `#8b8693`

### Die face
A regular pentagon via `clip-path: polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)`, 112px, filled with the rolled category's color. The number is Archivo 900 40px `#0d0b10`, nudged down 10px for optical centering.

---

## Screens

### Home (designed)
Sections from top to bottom. Every section has `data-screen-label` in the reference.

**1. Ramp strip**, 4px.

**2. Header.**
- Sticky, `rgba(13,11,16,0.94)` with an 8px backdrop blur, 2px bottom rule `#2a272e`, min height 68px.
- Left: the "PLAY TIME" wordmark (Archivo 900, 20px, tracking 0.14em, white).
- Right: nav links "How to play", "The deck", "Expansions", "Shop" (mono 12px, tracking 0.16em, `#b8b3c0`, hover white), 28px gap.
- Then the **Cart button**: 2px border `#f2f0f4`, label "CART", and a count badge (22px min square, bg `#FF5C8A`, text `#0d0b10` 12px). The button inverts on hover.

**3. Hero.** Two columns, `minmax(min(100%,420px),1fr)`, gap `clamp(32px,5vw,72px)`, vertically centered.
- **Left, 28px gaps:**
  - Eyebrow: "A card game for couples · 18+" (`#8b8693`)
  - H1: "ROLL THE DIE." then a line break and "RAISE THE HEAT." (second line `#FFD23F`), in the hero type style
  - Lead: "72 cards, one 12-sided die, and a better night than the one you were planning. Written by a practicing sex therapist to be easy to say yes to — and just as easy to say no." Max width 520px.
  - Buttons: Primary "Buy the base set — $35" (adds the base set and opens the cart) and Secondary "See how it works" (anchors to #how).
  - Stat row above a 2px rule, four items. Each is a value in Archivo 900 28px over a label in mono 11px `#8b8693`: 72 / Cards, d12 / One die, 7 / Categories, 5 / Heat levels.
- **Right:** a 4:5 image, then a 10px ramp strip. Image slot `site-hero`: *suggestive, not explicit — a couple with the deck on the bed, 1600×2000 px.*

**4. Statement.** Surface `#121015` with rules. Two columns, `minmax(min(100%,380px),1fr)`, bottom-aligned.
- H2: "MOST COUPLES FALL INTO A RUT."
- Right: "Same moves. Same nights. Same routine. You don’t need another self-help book. You need something you actually want to play." (20px `#b8b3c0`), then "NO COMPLICATED RULES. NO AWKWARD LECTURES." (Archivo 800 20px uppercase `#FFD23F`).

**5. How it works** (`#how`).
- Eyebrow "How it works" (`#FF5C8A`). H2 "LEARN IT IN A MINUTE."
- A 4-column grid, `minmax(min(100%,230px),1fr)`, with a 2px `#f2f0f4` top rule. Each cell is padded 28px 24px 32px 0 with a 2px `#2a272e` bottom rule and contains:
  - A number in Archivo 900 56px, in its color
  - A title in Archivo 800 20px uppercase
  - A body in 16px/1.55 `#b8b3c0`
- Content:
  - 01 `#3FD6C8` **Roll** — The 12-sided die picks one of seven categories.
  - 02 `#A68CF5` **Draw** — Take a card from the matching pile. Want a choice? Draw two, keep one.
  - 03 `#FF5C8A` **Read it out loud** — Every word, exactly as written. Saying it is half of it.
  - 04 `#FFD23F` **Do it, tweak it, or pass** — Either of you can pass on any card. Then switch turns and keep going.

**6. Try a roll** (`#deck`). Surface section, two columns, `minmax(min(100%,400px),1fr)`.
- **Left:**
  - Eyebrow "Try a roll" (`#A68CF5`)
  - H2 "THE DIE PICKS THE MOOD."
  - Lead "Twelve faces, seven categories. Cool colors are gentler, hot colors are bolder. You decide the details."
  - Die face, with a Light button "Roll the die" beside it
  - Category legend: a 2px top rule, then seven rows. Each row has a 14px color square, the die range in mono 13px in the category color, and the name in Archivo 800 15px. The active row gets bg `rgba(255,255,255,0.06)` and a white name; inactive names are `#8b8693`.
- **Right:** the label "A card from {category}", then the Game card showing that category's sample card from `content/game.json`.
- **Behavior:** see Interactions.

**7. Rarity and heat.** Two columns, `minmax(min(100%,420px),1fr)`.
- **Left:** eyebrow "Collect them" (`#E86BD8`), H2-sized "THREE RARITIES", then three rows. Each row has a 64×88 frame swatch and a name with a description.
- **Right:** eyebrow "Set your ceiling" (`#FF6A3D`), "FIVE HEAT LEVELS", then five rows, each with a 110px meter, the name (84px column) and a description.

**8. Shop** (`#shop`). Surface section.
- Header row: eyebrow "Shop" (`#FF5C8A`) and H2 "GET THE DECK" on the left; "Every set includes the 12-sided die" (mono, `#8b8693`) on the right.
- **Product grid**, `minmax(min(100%,300px),1fr)`, gap 24px. Each product card has:
  - bg `#0d0b10` and a 2px border: `#2a272e`, or `#FFD23F` for the featured Collector
  - A 4:3 image slot
  - Padding 24px
  - Name (Archivo 900 24px uppercase) with the price on the right (Archivo 900 24px `#FFD23F`)
  - Tag (mono 11px, in the product accent)
  - An includes list: rows with a 6px pink square and 15px `#d8d4de` text, on 1px rules
  - An "Add to cart" button pinned to the bottom
- **Expansions** (`#expansions`), below a 2px rule:
  - Eyebrow "Expansions" (`#5AB8F0`) and H3 "SIX PACKS. TWELVE CARDS EACH." with the note "Shuffle them into the base deck, or play one on its own for a themed night."
  - Grid `minmax(min(100%,190px),1fr)`, gap 16px. Each pack card has a 1px `#2a272e` border, an 8px accent band on top, the name (Archivo 900 19px), a hook (14px), and a price with a small "Add" button below a 1px rule.

**9. Close.** The full section is bg `#FF5C8A` with text `#0d0b10`.
- Poster H2 "KEEP IT FUN." then a line break and "KEEP IT HOT."
- Right: "Written by a practicing sex therapist. Built so either of you can pass, tweak or stop — any card, any time." (20px, weight 500), then the dark button "Buy the base set — $35".

**10. Footer.** 2px top rule. Grid `minmax(min(100%,180px),1fr)`.
- Brand column: the wordmark, then "For consenting adults 18+. Play at your own pace. Stop whenever you want."
- Link columns:
  - **Shop:** Base set, Bundles, Expansions
  - **The game:** How to play, The deck
  - **Help:** Shipping, Returns, Contact
  - **Legal:** Privacy, Terms
- Column headers are mono 11px `#7a7681`; links are 15px `#d8d4de`, hover `#FFD23F`.
- Bottom bar above a 1px rule: "© 2026 Play Time" on the left and "Roll the die. Raise the heat." on the right, both mono 11px.

**Cart drawer** (overlay).
- A backdrop `rgba(0,0,0,0.6)` that closes the drawer on click.
- A right-side panel, `min(440px,100%)`, bg `#121015`, 2px left rule, containing:
  - **Header:** "YOUR CART" and a "Close" text button.
  - **Scroll area:** item rows. Each row has a 10px accent bar, the name with "$X each" under it, a qty stepper (− / n / +, 36px square buttons inside a 1px `#3a363f` border) and the line total.
  - **Empty state:** "Nothing here yet" / "Start with the base set. Everything else plugs into it."
  - **Footer:** Subtotal (Archivo 900 26px), "Shipping and tax calculated at checkout.", and a Primary "Checkout" button.

**Age gate** (overlay, site-wide).
- Fixed full screen, `rgba(13,11,16,0.97)`, z above everything.
- A 560px column containing, in order:
  - 6px ramp strip
  - Eyebrow "Adults only" (`#FF5C8A`)
  - A "PLAY / TIME" wordmark at `clamp(56px,12vw,96px)`
  - "This site sells an adult card game and includes suggestive imagery and frank language about sex. You must be 18 or older to enter."
  - Primary "I’m 18 or older" and an outline "Leave" (→ external site)
  - Fine print: "By entering you confirm you are of legal age where you live."

### How to play (build from spec)
Reuse the Home "How it works" grid, then add:
1. **Setting up** — five numbered rows: Sort the deck, Set your ceiling, Pull your vetoes, Make room for three piles (Played, Saved, Retired), Pick a roller.
2. **A full turn** — roller and partner roles, six steps.
3. **The four answers** — Do it, Tweak it, Save it, Pass (unlimited passes).
4. **Special rolls** — 11 Focus on You and 12 Free Play (Dealer’s Choice, Double Draw, Reverse Roles, Free Play Create).
5. **Ending the night.**
6. **Ground rules** — anyone can pass, change the card, agree first, stop means stop, the last five minutes count.

Copy for all six is in the printed rulebook (pages 06–13 and 18). The owner has the PDF. Use numbered-row styling: Archivo 900 number in the section color, uppercase Archivo 800 title, body text, 1px rules. End with a Close-style CTA band.

### The deck (build from spec)
- The Home "Try a roll" block, full width.
- A grid of all seven category cards, one sample each from `content/game.json`.
- The rarity and heat sections from Home.
- "What's inside": 72 cards, one 12-sided die, quick start card, three rarity levels.

### Expansions (build from spec)
- One tall row per pack: a full-width accent band, name, hook, a longer description (owner to supply), "12 cards", price and Add.
- A "Playing with expansions" block: shuffle in by color, themed night, no-die night, pack for the trip, ceiling still applies.
- A note: no expansion includes Free Play cards.

### Pricing (build from spec)
The three product cards from Home at larger size, plus a comparison table below. Columns: Base / Couple's bundle / Collector. Rows: cards, die, bag, expansion packs (0 / 2 / 6), storage box, exclusive Rares, price. Table style: 2px header rule, 1px row rules, mono column heads.

### Shop, Product and Cart (build from spec)
- **Shop:** all products and packs in the Home grid styles.
- **Product detail:** a gallery of 4:3 image slots on the left. On the right: name, price, tag, includes list, quantity stepper and Add to cart. The Couple's bundle must make you choose 2 of the 6 packs before adding (`requiresChoice` in `catalog.json`).
- **Cart page:** the drawer layout at full width.
- **Checkout:** handled by the commerce provider.

---

## Interactions & Behavior
- **Age gate**
  - It shows on first visit to any route and blocks scroll and interaction until confirmed.
  - "I’m 18 or older" sets a persistent flag and dismisses the gate. The prototype uses the `localStorage` key `pt-site-age-ok`; in production use a first-party cookie with a 30-day expiry so server-rendered pages can read it.
  - "Leave" navigates away.
  - Trap focus inside the gate, and don't render product imagery until the flag is set. Don't show crawlers anything more explicit than the gate itself.
- **Cart**
  - Every add action increments the item's qty and opens the drawer.
  - Stepper − at qty 1 removes the item.
  - The header badge shows the total unit count.
  - Persist the cart (commerce provider cart ID in a cookie).
  - The drawer closes on backdrop click, the Close button and Esc.
  - Lock body scroll while it's open.
- **Try a roll**
  - Clicking "Roll the die" disables the button and changes its label to "Rolling…".
  - The number is then randomized every 70ms for 11 ticks, 770ms total, and settles on a final value from 1 to 12.
  - The die color, active legend row, card category bar, meter, frame and text all follow the current number on every tick.
  - Start at 1 (Soft Touch).
  - Honor `prefers-reduced-motion` by skipping the ticks and showing the result immediately.
- **Hover:** every button and link has a hover state (see the Components table). Use a 120ms color/background transition; the prototype has none.
- **Anchors:** nav links scroll to `#how`, `#deck`, `#expansions` and `#shop`. Use smooth scrolling with the sticky header height (68px) as scroll-margin.

## State
- `ageVerified: boolean`, from a cookie.
- `cart: { lines: [{ id, qty }] }`, synced with the commerce provider.
- `cartOpen: boolean`.
- `roll: { n: 1–12, rolling: boolean }`, local to the Try-a-roll block.
- Category is derived from `n` via `content/game.json → die`.

## Commerce
- **Recommended:** Shopify as a headless backend (Storefront API cart plus hosted checkout). The alternative is Stripe Checkout.
- **Verify processor policy before building.** Card networks and processors restrict adult products, and a sex-education card game may need a specific category, an age-verification record, or a high-risk processor. The owner must confirm with the provider before launch.
- All prices come from `content/catalog.json`. **The expansion pack price of $14 is a placeholder**; the owner has not set it.

## Imagery
- The imagery rule is **suggestive, not explicit**, and only behind the age gate. No nudity, no genitals, no sexual acts: product-first and lifestyle-mood only.
- Every image location is an empty slot in the reference, and the owner supplies the photos:

| Slot | Where | Aspect | Supply |
|---|---|---|---|
| `site-hero` | Home hero, right | 4:5 | 1600×2000 px |
| `site-prod-base` | Base set card | 4:3 | 1600×1200 px |
| `site-prod-bundle` | Bundle card | 4:3 | 1600×1200 px |
| `site-prod-collector` | Collector card | 4:3 | 1600×1200 px |

- Use `next/image` (or equivalent) with AVIF/WebP and set width and height.
- Game-card image areas stay as the striped placeholder on the site. Card art is not published on the web.
- Open Graph image: dark `#0d0b10`, the "PLAY TIME" wordmark and a ramp strip, with no photography, so link previews are safe everywhere.

## Design Tokens
Everything is in `tokens.json`. Summary:
- **Ground:** `#0d0b10`, surface `#121015`, card image `#16141a`, raised `#1e1c22`, rule `#2a272e`, strong rule `#3a363f`.
- **Text:** `#ffffff` / `#f2f0f4` / `#d8d4de` / `#b8b3c0` / `#8b8693` / `#7a7681`.
- **Heat ramp (category colors):** Soft Touch `#3FD6C8`, Flirty Fun `#5AB8F0`, Classic Heat `#A68CF5`, Focus on You `#E86BD8`, Turn It Up `#FF5C8A`, Wild Card `#FF6A3D`, Free Play `#FFD23F`.
- **Primary** `#FF5C8A`, hover and highlight `#FFD23F`.
- **Radius 0. Shadows none.** Rules are 2px for sections and 1px for rows.
- The type scale is in `tokens.json → type`.

## Assets
- **Fonts:** Google Fonts (see above).
- **No icons are needed**; the design is typographic. If one is ever needed, use Lucide at a 1.5px stroke.
- **Product photography:** supplied by the owner.
- **Game content:** `content/game.json` (die mapping, sample cards, rarities, heat levels) and `content/catalog.json` (products and prices).

## Files
- `reference/Play Time Website - Home.dc.html` — the hi-fi Home prototype. Open it in a browser. Its preview toggles (Tweaks) are `showAgeGate` and `cartPreview`.
- `reference/support.js`, `reference/image-slot.js` — runtime for the reference only. Do not ship them.
- `tokens.json` — design tokens.
- `content/catalog.json` — products, packs and prices.
- `content/game.json` — die, categories, sample cards, rarities, heat.

## Open items for the owner
1. Expansion pack price.
2. Legal copy: Privacy, Terms, Shipping, Returns.
3. Whether packaging ships discreetly. If it does, add that line to Shop and the cart footer.
4. Longer descriptions for each expansion.
5. Product photography for the four slots.
6. Processor and age-verification requirements for your region.
