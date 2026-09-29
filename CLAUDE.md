# Play Time — project instructions

## Stack (do not downgrade)
- Next.js 16 (App Router, `src/proxy.ts` not middleware), React 19.3, TypeScript 7, Node 22, Prisma 7.10 with the `pg` driver adapter (client generated to `src/generated/prisma`, git-ignored). Keep versions at latest stable; `prisma` CLI and `@prisma/client` must match.
- Plain CSS in `src/app/globals.css` driven by `design/handoff/tokens.json`. No Tailwind, no UI libraries.
- Auth is email + password only (scrypt + HMAC cookie in `src/lib/auth.ts`). Never add magic links or social login.

## Design rules (from design/handoff/README.md — the source of truth)
- Dark `#0d0b10`, alternate sections `#121015` with 2px `#2a272e` rules. **Zero border radius. No shadows.** Flush left, including button labels.
- Exception, owner-requested: the public site (everything under `src/app/(site)`, styles in `src/app/light.css`, effects in `src/components/play/fx/`) uses glows, halos, flashes and particle light — light, never depth. The admin stays plain. Still zero radius, still flush left, and every effect must respect `prefers-reduced-motion`.
- Archivo 500–900 display (uppercase), Space Grotesk body, JetBrains Mono labels.
- Heat ramp order: `#3FD6C8 #5AB8F0 #A68CF5 #E86BD8 #FF5C8A #FF6A3D #FFD23F`.
- Imagery is suggestive, not explicit, and only rendered behind the age gate (`isAgeVerified()`); card art is never published on the web.
- Expansion price ($14) is a placeholder until the owner confirms. Legal copy is owner-supplied via Admin → Pages; never write it.

## Conventions
- Settings/API keys live in the database (`Setting`) with `.env` fallback — see `src/lib/settings.ts`; add new keys to `SETTING_KEYS` so they appear in /admin/settings.
- Route params/searchParams are Promises (Next 16) — await them.
- Prisma `Bytes` is `Uint8Array` — wrap Buffers with `new Uint8Array(buf)`.
- Payments go through DivinityCoin only (`src/lib/divinitycoin.ts`, `docs/DIVINITYCOIN.md`); webhook is `/api/webhooks/divinitycoin`. Never build card processing.
- Verify with `npx tsc --noEmit` and `npx next build` before pushing. Do not run browser test harnesses unless asked.
- Keep source files under 500 lines; split into focused modules.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
