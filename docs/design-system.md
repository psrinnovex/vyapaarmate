# VyapaarMate design system — "Marigold Bazaar"

The website, business dashboard, customer portal, admin console and the Expo app share one
visual system built on the VyapaarMate logo: **black, logo green and white**, warmed by an ivory
"bazaar paper" canvas and marigold price tags. The full brand book, tokens and component
previews live in the Claude design system artifact (owner: PSHR INNOVEX). This page is the
developer summary.

## Tokens (Tailwind)

| Role | Class | Value | Use |
| --- | --- | --- | --- |
| Logo black | `ink` / `ink-950` | `#0B0D0B` | Text, dark buttons, dark bands |
| Logo green | `brand` / `green-500` | `#1EC926` | Main action; text on it is always `text-ink` (or `text-on-brand`) |
| Green text | `text-brand-text` / `green-700` | `#0B7A10` | Links and money words on light surfaces |
| White | `white` / `paper` | `#FFFFFF` | Cards, inputs |
| Canvas | `ivory-50` | `#FAF7F0` | Page background (with paper grain, set on `body`) |
| Accent | `marigold-500` | `#F2A20C` | Price tags, offers, highlights; text on it is `text-ink` |
| Info / error | `peacock-*` / `kumkum-*` | `#0E7C86` / `#B3311D` | Information and errors |
| Neutrals | `ink-50 … ink-950` | warm greys | Muted text is `text-ink-500` or darker (≥ 4.5:1) |

`brand`, `brand-text` and `on-brand` are CSS variables. Inside `.theme-dark`, `.vm-band` and
`.glass-dark` they switch to the night values (green-400), so the same classes stay readable on
black surfaces.

Fonts: **Poppins** (Indian Type Foundry, `font-display`) for `h1`–`h3`, prices and big numbers;
**Inter** (`font-sans`) for everything else. Both are bundled in `app/fonts` (SIL OFL).

## Components

- `Button` / `ButtonLink` — `brand` (default), `dark`, `accent`, `info`, `danger`, `secondary`,
  `outline`, `ghost`, `neutral`, `link`. Solid buttons sit on a 4px lip and press down 3px.
  One green button per view.
- `Badge` — `success`, `warning`, `danger`, `info`, `dark`, `neutral`, `brand`, `accent`.
- `StatusPill` — order, payment, subscription and business states (always a word, never colour only).
- `Sticker` — the price-tag motif (`marigold` default, `green`, `ink`, `paper`, `peacock`, `kumkum`).
  Max two per screen.
- `MetricCard` tones — `ink`, `green`, `peacock`, `marigold`, `kumkum`.

## Motifs and helpers (`app/globals.css`)

- `.vm-mark` — marigold marker stroke behind 2–4 headline words (no gradient text).
- `.vm-awning` — green-and-white scalloped awning; tune with `--awning-size`, `--awning-a`, `--awning-b`.
- `.vm-band` — the one dark band per page (logo black with green and marigold light).
- `.vm-perforation` — ticket perforation with punched notches.
- `.clay`, `.glass`, `.glass-dark`, `.clay-orb`, `.clay-press`, `.clay-tint-{green|marigold|peacock|kumkum|ivory|ink}`.

## Mobile

`apps/mobile/src/theme/theme.ts` carries the same palette for light ("Bazaar day") and dark
("Bazaar night") mode. The app uses the platform fonts; Poppins and Inter can be added later
with `npx expo install expo-font`.
