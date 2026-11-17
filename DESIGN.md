# DESIGN.md — بوصلة الإنسان | Human Compass

Source of truth: `brand/brochure.pdf` (31 pages, Adobe Illustrator, 1200×675 pt landscape).
Every value below was read from the PDF itself: colours from the vector fills
(`pdftocairo -svg`), fonts from `pdffonts`, imagery from the embedded rasters
(`pdfimages`) composited with their alpha masks.

---

## 1. Colour tokens

Defined once in `app/globals.css` under `@theme` (Tailwind v4, CSS-first), so they
are available as `bg-cream`, `text-ink`, `border-line`, etc.

| Token | HEX | Measured in PDF | Role |
|---|---|---|---|
| `cream` | `#F9F7F0` | page background `rgb(97.2%,97.3%,93.3%)` | Page background |
| `ink` | `#16272B` | `rgb(8.65%,15.4%,16.97%)` — headlines, dark slides | Body text, headlines, dark sections, footer, card borders |
| `emerald` | `#1E4A42` | 3D glass objects | Primary brand colour, icons, selected states |
| `emerald-700` | `#1D3B42` | flat logo fill `rgb(11.5%,23%,26%)` | Logo, hover/pressed states |
| `copper` | `#B57A4A` | `rgb(70.9%,48%,29%)` — accent words, needle, badges, price pills | Accent word in headlines, numbers, check badges, decorative strokes |
| `copper-600` | `#9A6238` | *derived* | **Text-safe copper**: primary button fill, small copper text, links |
| `copper-700` | `#84532F` | *derived* | Primary button hover/pressed |
| `copper-300` | `#C68D5D` | *derived* | **Copper text on `ink`** below 24px (footer labels, small numbers) |
| `line` | `#DAD6CC` | header hairline | Hairline dividers, input borders at rest |
| `white` | `#FFFFFF` | — | Cards on cream |
| `danger` | `#A3321F` | *new* | Validation errors (AA on cream and white) |

### Contrast (WCAG 2.2) — why `copper-600` exists

| Pair | Ratio | Verdict |
|---|---|---|
| `ink` on `cream` | 14.4 : 1 | AAA |
| `emerald` on `cream` | 9.3 : 1 | AAA |
| `copper` on `cream` | **3.35 : 1** | Large text only (≥ 24px, or ≥ 18.66px bold) |
| white on `copper` | **3.6 : 1** | Large text only |
| `copper-600` on `cream` | 4.7 : 1 | AA ✓ |
| white on `copper-600` | 5.0 : 1 | AA ✓ |
| `cream` on `ink` | 14.4 : 1 | AAA |
| `copper` on `ink` | **4.3 : 1** | Large text only |
| `copper-300` on `ink` | 5.4 : 1 | AA ✓ |
| `danger` on `cream` / white | 6.5 / 6.9 : 1 | AA ✓ |

(Computed with the WCAG 2.x relative-luminance formula.)

Rules:
- `copper` is used for **headline accent words (≥ 24px)**, big numbers, check badges,
  the logo needle and decorative strokes — never for body-size text on cream.
- Anything small that needs to be copper on light backgrounds (button labels, links,
  step titles, price labels) uses `copper-600`.
- On `ink` sections plain `copper` is for headlines (≥ 24px); smaller copper text uses `copper-300`.

---

## 2. Typography

The brochure is set in **Thmanyah** (embedded subsets found in the PDF):
`thmanyahsans` Light/Regular/Medium/Bold, `thmanyahseriftext` Light/Regular/Medium/Bold,
`thmanyahserifdisplay` Medium.

| Role | Brand font | Fallback in use now | CSS var |
|---|---|---|---|
| Body, UI, forms | Thmanyah Sans | **IBM Plex Sans Arabic** (Google Fonts) | `--font-sans` |
| Headlines | Thmanyah Serif Display (Medium) | **Noto Naskh Arabic** (Google Fonts) | `--font-display` |
| Sub-headlines, quotes | Thmanyah Serif Text | Noto Naskh Arabic | `--font-display` |

Both are loaded through `next/font`, self-hosted by Next at build time (no runtime calls to
Google). Switching to Thmanyah: drop the files in `brand/fonts/` and follow
`lib/fonts.ts` (instructions inline + README §6).
**License:** Thmanyah is distributed by Thmanyah under its own free-font licence —
confirm commercial web-embedding is permitted for your use before shipping the files.

Digits: the brochure uses **Latin digits** everywhere (`01`, `350+`, `1,500`). We format
numbers and dates with `ar-SA-u-nu-latn` to match.

### Type scale (mobile → desktop)

| Token | Size / line-height | Font | Use |
|---|---|---|---|
| `display` | 40/1.15 → 64/1.1 | display, 500 | Hero headline |
| `h1` | 32/1.2 → 44/1.15 | display, 500 | Page titles (`/confirmed`, `/privacy`) |
| `h2` | 26/1.25 → 36/1.2 | display, 500 | Section titles |
| `h3` | 20/1.35 → 22/1.35 | sans, 700 | Card titles |
| `lead` | 18/1.7 → 20/1.7 | sans, 400 | Sub-lines under headlines |
| `body` | 16/1.75 | sans, 400 | Default text (Arabic needs generous leading) |
| `small` | 14/1.6 | sans, 400/500 | Helper text, labels, tagline |
| `micro` | 12/1.5 | sans, 500 | Time-zone notes, legal |

Headline pattern (from every brochure slide): ink text with **one** key word or phrase in
copper — `احجزوا <span class="text-copper">اجتماعًا تعريفيًا</span>`. In copy files the
accent is written as `**…**` and rendered by `<Accent>`.

---

## 3. Spacing, radius, elevation, layout

- Base unit 4px (Tailwind default scale). Section padding: `py-16` mobile, `py-24` desktop.
- Content width: `max-w-6xl` (1152px) with `px-4` (16px) gutter on mobile, `px-6` desktop.
- Radius: `rounded-card` = **24px** (cards, calendar panel, form panel),
  `rounded-badge` = 6px (check badges — brochure badges are ~25% radius squares),
  `rounded-full` for buttons, pills, step circles, slot buttons.
- Borders: cards = 1px `ink`; inputs = 1px `line`, focus = 2px `emerald` ring.
- Elevation: **none**. The brochure is flat; depth comes only from the 3D renders.
  No drop shadows on cards.
- Grid: single column on mobile; booking area becomes `[calendar | form]` at `lg`.

---

## 4. Components

| Component | Spec (taken from brochure page) |
|---|---|
| **Header bar** (p. 3–30) | Logo (40px) at the inline-end (left in RTL), tagline `حلول التحليل والتطوير المهني والقيادي للمنظمات` at inline-start in `small` ink. A full-width 1px `line` hairline underneath. |
| **Headline** | `display`/`h2`, ink, one copper accent word. Optional `lead` sub-line in ink/80. |
| **Card** (p. 26–27) | White or cream fill, 1px `ink` border, 24px radius, 24–32px padding. Title, then a 1px ink rule, then content. |
| **Check badge** (p. 26–27) | 20px copper rounded square (radius 25%) with white check. Exact path lifted from the PDF. |
| **Primary button** | `copper-600` fill, white label, `rounded-full`, 48px tall min, 600 weight. Hover `copper-700`. Focus ring `emerald`. |
| **Price pill** (p. 27) | Copper pill, white bold numerals ≥ 20px (large-text contrast OK). |
| **Secondary button** | Transparent, 1px ink border, ink text, `rounded-full`. |
| **Segmented choice** (session type, sector, …) | Card-like radio tiles: 1px `line` border at rest; selected = 2px `emerald` border + emerald check dot. |
| **Step timeline** (p. 23) | Outlined 56px circles (1px ink) with Latin two-digit numbers `01 02 03` in ink, joined by a thin 1px ink line. Step title in `copper-600`, description in ink. Vertical on mobile, horizontal on desktop. |
| **Calendar** | 7-column month grid in a 24px-radius card. Available day = emerald text with a copper dot; selected = emerald fill, cream text; unavailable = ink/30 and `aria-disabled`. Arrow-key navigation (roving tabindex). |
| **Time-slot button** | Pill, 1px `line` border; hover border emerald; selected = emerald fill + cream text. Riyadh time shown underneath in `micro` when visitor ≠ Asia/Riyadh. |
| **Inputs** | 48px tall, white fill, 1px `line` border, 12px radius, label above (always visible, never placeholder-only), error text below in `danger` with an icon. |
| **Dark section / footer** (p. 6, 10, 15, 31) | `ink` background, cream text, copper headline. Large **outline logo** motif (white 1px strokes + copper needle stroke) bleeding off the inline-end bottom corner. |
| **3D visual** | Transparent-background renders cut from the brochure, placed on cream with no frame. |
| **WhatsApp FAB** | 56px emerald circle, cream glyph, bottom inline-start corner, safe-area aware. |

---

## 5. Imagery

All imagery is the brochure's own 3D emerald-glass + copper renders, extracted at native
resolution with alpha (`public/images/*.webp`), served through `next/image` (AVIF/WebP,
responsive `sizes`). No stock photos.

| File | Brochure page | Used on |
|---|---|---|
| `meeting.webp` (chat bubbles + copper handshake) | 29 | Booking hero |
| `calendar.webp` (calendar + clock) | 8 | Calendar section heading |
| `compass-bust.webp` (glass bust with compass) | 4 | Individual paths info |
| `chairs.webp` (two chairs + chat bubble) | 10 / 30 | Confirmation page |
| `shield.webp` (shield + padlock) | 28 | Privacy page |
| `leaders.webp`, `magnifier.webp`, `logo-3d.webp` | 16, 7, 1 | Spare / future sections |

## 6. Logo

Extracted **as vector** from page 27 (header) — the exact Illustrator paths, not a trace —
into `components/Logo.tsx` and `public/logo.svg`:
copper triangle needle above an emerald-700 dot, two upper arcs and two lower leaves.
The outline motif (page 31) is the same geometry rendered with strokes
(`<Logo variant="outline" />`, non-scaling 1px white strokes + copper needle).

---

## 7. Do / Don't

**Do**
- Keep pages calm: lots of cream, one idea per section, one copper word per headline.
- Use Latin digits and the Saudi formal-friendly plural address (احجزوا، جهتكم، تواصلوا).
- Use `copper-600` for any copper text under 24px on light backgrounds.
- Keep borders 1px and ink; keep radii consistent (24 / 12 / full).
- Mirror layout with logical properties (`ms-`, `me-`, `ps-`, `start-`, `end-`).

**Don't**
- Don't add drop shadows, gradients or glassmorphism to UI — the gloss lives in the renders only.
- Don't put more than one copper accent in a headline, or copper body text on cream.
- Don't use stock photography or emoji.
- Don't recolour the logo or stretch it; minimum size 28px.
- Don't place the outline motif behind text on light backgrounds — dark sections only.
