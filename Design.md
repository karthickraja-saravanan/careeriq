---
version: alpha
name: character.ai
website: "https://character.ai"
description: >-
  An AI-chat consumer surface gated by a single sign-up card. The system anchors on a near-white canvas (#f4f4f5), pill-shaped CTAs at 30px radius, and a wordmark wrapped in literal parentheses — "(character.ai)" — typeset in the custom atHauss display. Primary voltage is a saturated blue (#1a5eff) reserved for focus rings and the latent "primary-refresh" token, while every visible CTA in the marketing chrome runs near-black (#202024) on white. Type runs atHauss across every weight tier with a fallback to Inter, and the 36px h1 carries -0.72px tracking — a literary tightening on what would otherwise be a generic auth page.

seo:
  title: "character.ai Design System: Pill Buttons and atHauss"
  metaDescription: "A light #f4f4f5 canvas, near-black pill CTAs, blue #1a5eff in focus rings and links, and atHauss display. character.ai for React and AI tools."
  highlights:
    - "Pill CTA geometry — 30px radius on buttons paired with a 2rem (#1a5eff) root radius, the strongest formal signal in the chrome"
    - "Wordmark-in-parentheses — literal ( ) brackets wrap the (character.ai) lockup in atHauss, treating the URL itself as the logotype"
    - "Near-black primary, blue in reserve — visible CTAs run #202024 on white while #1a5eff lives in focus rings, link-text, and the primary-refresh token"
    - "Two-typeface stack — atHauss for product chrome, Inter declared as --font-inter for fallbacks, no third family across 7 weight tiers"
    - "NextUI-derived token graph — 379 CSS variables on :root expose the underlying nextui scale (primary 212/100/47), surfaced through a Tailwind layer rather than hand-rolled"
  tags:
    - "AI & LLM Platforms"
    - "Social & Community"
  lastUpdated: "2026-05-13"
  author:
    name: "Dov Azencot"
    url: "https://x.com/dovazencot"
  opening: |
    character.ai's landing surface is a sign-up gate, not a marketing brochure. The page is one card on a near-white canvas (#f4f4f5), holding a 36px atHauss h1 ("Get access to 10M+ Characters"), three auth buttons stacked vertically, and a footer link row. The wordmark sits top-left wrapped in literal parentheses — (character.ai) — a typographic move that treats the URL itself as the logo. There is no hero illustration, no testimonial band, no comparison table. The page exists to convert a click to an account.

    This DESIGN.md packages the underlying token graph into one file. Inside: 22 color tokens, 9 type styles built on atHauss with Inter as the declared --font-inter fallback, 6 corner radii anchored to a 30px pill, 9 spacing values on a 4px scale, and 18 components — every piece visible on the auth surface plus the latent product chrome the 379 :root variables expose. The colors include the brand-layer #1a5eff (declared as --primary-blue), the auth-CTA near-black #202024 (--button-background), and the cream canvas #f4f4f5 (--background) that distinguishes the site from a pure white default.

    Download the file and feed it to Claude, Cursor, or GitHub Copilot. The agent reproduces character.ai's auth-card voice — pill buttons, near-black primaries, atHauss tightening at -0.72px, parentheses-wrapped wordmark — rather than a generic SaaS theme. Where most AI-chat consumer apps front-load a feature grid, this one front-loads a Google/Apple/email triplet on a single card. Studying the token graph reveals a NextUI-derived scale operating beneath a custom Tailwind layer.
  related:
    - href: "/design"
      title: "Browse all design systems"
      description: "The full directory of DESIGN.md files on shadcn.io, with live mockups for each."
    - href: "https://character.ai"
      title: "character.ai — official site"
      description: "The chat-with-millions-of-AI-characters consumer app, gated behind the sign-up card this spec extracts."
    - href: "https://github.com/google-labs-code/design.md"
      title: "The DESIGN.md specification"
      description: "Google Labs' open spec for machine-readable design system files — the format this page is built on."
  questions:
    - id: "primary-color"
      title: "What is character.ai's primary brand color?"
      answer: "The brand voltage is a saturated blue at #1a5eff, declared as --primary-blue and --primary-refresh in the underlying token graph. The visible CTA on the auth card, however, runs near-black (#202024 — declared as --button-background) on white. The blue is in reserve — it surfaces on focus rings, on the --link color, on the --primary-container-refresh light tint #a3bfff, but never on the Sign Up to Chat button itself. This is unlike most AI-chat consumer brands that paint their primary CTA in their brand voltage."
    - id: "typography"
      title: "What typography does character.ai use, and what should I use if atHauss isn't available?"
      answer: "The site runs atHauss across every visible text element, declared as --font-at-hauss with a fallback chain through ui-sans-serif and system-ui. Inter is declared as --font-inter for secondary roles. Sizes ladder from 11px (small links) through 14px (button labels) up to 36px (the hero h1, with -0.72px letter-spacing). The display tightening is the only non-default tracking value in the system. If atHauss is unavailable, Inter at the same weights (400 body, 500 labels, 600 display) is the closest open-source substitute since it is already declared as the secondary stack."
    - id: "pill-geometry"
      title: "Why are character.ai's buttons pill-shaped and how do I match it?"
      answer: "Every CTA on the auth surface — Sign Up to Chat, Login, Continue with Google, Continue with Apple, Continue with email — uses a 30px border-radius, which at the visible 40px button height reads as a full pill. The root --radius variable is 2rem (32px), and --nextui-radius-large is 14px, but the components consistently override toward 30px. To match: set radius to 30px on any button at 40px height; do not use rounded-md or rounded-lg from a default Tailwind theme."
    - id: "auth-card-as-landing"
      title: "Why is the entire landing page a sign-up card?"
      answer: "The marketing surface is deliberately collapsed into one conversion target. The page renders a 360px-wide card on a 1440px canvas, centered roughly two-thirds down, with three stacked auth buttons separated by an OR divider and a fine-print 'By continuing, you agree' footer in 11px atHauss. There is no scroll, no second band, no testimonial. The product itself — the chat surface, the character grid, the discovery feed — lives entirely behind the sign-up wall. Studying the token graph reveals the product-side chrome (--feed-item-width: 140px, --plus-gradient, --labs-gradient) that the marketing page never reveals."
    - id: "use-in-project"
      title: "Can I use this DESIGN.md to build my own React app?"
      answer: "Yes — feed the file to Claude, Cursor, or any AI tool that reads design tokens. The agent reproduces character.ai's auth-card voice (pill buttons, near-black primaries, atHauss display tightening, parentheses-wrapped wordmark) rather than a generic shadcn theme. Every color, type style, radius, and spacing value is a quoted token you can paste into Tailwind config, CSS variables, or your own component library. The underlying NextUI scale (--nextui-primary 212/100/47, --nextui-radius-large 14px) is exposed for teams already on that stack."
    - id: "known-gaps"
      title: "What's missing from this DESIGN.md spec?"
      answer: "Several items live in the Known Gaps section. atHauss is a licensed character.ai typeface with no public web font — Inter is the closest substitute. The 379 :root CSS variables expose latent product tokens (--feed-item-width, --plus-gradient, --labs-gradient, swiper carousel theming) that never render on the public marketing surface, so they are documented but not styled. Dark-mode tokens exist in the graph (--brand-bg-inverted #202024, --inverse-surface-refresh #1e1e1e) but the public page renders light-only. Chat-bubble, message-action, character-card, and feed-discovery components live behind the auth wall and are not extracted."

colors:
  primary: "#1a5eff"
  primary-container: "#a0c9ff"
  primary-deep: "#0061a6"
  primary-on-container: "#001138"
  inverse-primary: "#d1dfff"
  link: "#138eed"
  link-secondary: "#1ba5fb"
  cta: "#202024"
  cta-text: "#fafafa"
  ink: "#26272b"
  ink-strong: "#131316"
  body: "#1e1e1e"
  muted: "#585962"
  muted-soft: "#7c7c87"
  outline: "#a2a2ac"
  hairline: "#e2e8f0"
  hairline-strong: "#d4d4da"
  surface-elevation-3: "#c8c8cf"
  canvas: "#f4f4f5"
  surface-card: "#fafafa"
  surface-cream: "#ececee"
  surface-cream-strong: "#e5dfeb"
  accent-violet: "#b460eb"
  accent-violet-soft: "#e1bff7"
  accent-green: "#1ebe53"
  accent-green-soft: "#a8eac6"
  warning: "#ff9800"
  warning-soft: "#ffe991"
  error: "#cc3434"
  error-soft: "#fba7b9"

typography:
  display-md:
    fontFamily: "atHauss, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: 36px
    fontWeight: 600
    lineHeight: 1.11
    letterSpacing: "-0.72px"
  title-lg:
    fontFamily: "atHauss, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: 18px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0
  title-md:
    fontFamily: "atHauss, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0
  body-md:
    fontFamily: "atHauss, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.43
    letterSpacing: 0
  button:
    fontFamily: "atHauss, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.43
    letterSpacing: 0
  nav-link:
    fontFamily: "atHauss, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0
  caption:
    fontFamily: "atHauss, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.33
    letterSpacing: 0
  caption-label:
    fontFamily: "atHauss, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: 11px
    fontWeight: 500
    lineHeight: 1.45
    letterSpacing: 0
  fine-print:
    fontFamily: "atHauss, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: 11px
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: 0

rounded:
  sm: "8px"
  md: "12px"
  lg: "14px"
  pill: "30px"
  card: "32px"
  full: "9999px"

spacing:
  xxs: "4px"
  xs: "8px"
  sm: "12px"
  md: "16px"
  base: "20px"
  lg: "24px"
  xl: "32px"
  xxl: "40px"

components:
  top-nav:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.nav-link}"
    padding: "16px 24px"
    height: "72px"
    border: "0"
  wordmark:
    backgroundColor: "transparent"
    textColor: "{colors.ink-strong}"
    typography: "{typography.title-lg}"
    padding: "0"
  nav-link:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    typography: "{typography.nav-link}"
    padding: "8px 16px"
  button-primary:
    backgroundColor: "{colors.cta}"
    textColor: "{colors.cta-text}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    padding: "0px 16px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.ink-strong}"
    textColor: "{colors.cta-text}"
    rounded: "{rounded.pill}"
  button-secondary:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    padding: "0px 16px"
    height: "40px"
    border: "1px solid {colors.hairline}"
  button-auth-provider:
    backgroundColor: "{colors.cta}"
    textColor: "{colors.cta-text}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    padding: "0px 16px"
    height: "48px"
  button-auth-email:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    padding: "0px 16px"
    height: "48px"
    border: "1px solid {colors.hairline-strong}"
  text-link:
    backgroundColor: "transparent"
    textColor: "{colors.link}"
    typography: "{typography.body-md}"
  auth-card:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink}"
    typography: "{typography.title-md}"
    rounded: "{rounded.card}"
    padding: "32px"
    border: "1px solid {colors.hairline}"
  hero-headline:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.display-md}"
    padding: "0"
  hero-subhead:
    backgroundColor: "transparent"
    textColor: "{colors.body}"
    typography: "{typography.title-lg}"
    padding: "0"
  divider-or:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    typography: "{typography.caption-label}"
    padding: "8px 0"
  text-input:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.pill}"
    padding: "0px 20px"
    height: "48px"
    border: "1px solid {colors.hairline-strong}"
  fine-print-block:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    typography: "{typography.fine-print}"
    padding: "8px 0"
  footer-link-row:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.muted}"
    typography: "{typography.body-md}"
    padding: "16px 24px"
  help-fab:
    backgroundColor: "{colors.surface-cream}"
    textColor: "{colors.ink}"
    typography: "{typography.caption-label}"
    rounded: "{rounded.full}"
    padding: "0"
    height: "32px"
  plus-badge:
    backgroundColor: "{colors.link-secondary}"
    textColor: "{colors.cta-text}"
    typography: "{typography.caption-label}"
    rounded: "{rounded.pill}"
    padding: "2px 10px"
---

## Overview

character.ai's chrome is a sign-up wall dressed as a marketing page. The base canvas is a near-white `{colors.canvas}` (#f4f4f5), one shade off pure white — visible only because the 360px auth card sits on top in `{colors.surface-card}` (#fafafa) and the hairline contrast separates the two. The wordmark at top-left is literal: `(character.ai)` wrapped in parentheses, set in atHauss, treating the URL itself as the lockup. There is no hero illustration, no scrolling feature band, no testimonial column. The viewport ends where the footer link row ends.

**Wordmark as parenthetical**: where most AI-chat consumer brands run a sans-serif logotype with a custom glyph, character.ai sets the URL inside literal parentheses and calls it the logo. The choice mirrors a function call — `(character.ai)` reads as an invocation, fitting for a product that exposes character personas through a chat surface. The parentheses are not decorative; they are the brand mark.

**Blue in reserve, near-black on the page**: the underlying token graph declares `--primary-blue` as `{colors.primary}` (#1a5eff), but no visible CTA on the public surface renders in that blue. The Sign Up to Chat button, the Continue with Google button, and the Continue with Apple button all run `{colors.cta}` (#202024) — a near-black declared as `--button-background`. The blue surfaces only as `{colors.link}` (#138eed) on the Terms and Privacy fine-print and as the latent focus ring color. Where most consumer AI brands paint their primary CTA in their brand voltage, character.ai treats the brand color as a system token and leaves the auth surface in achromatic chrome.

**Key Characteristics:**
- Near-white canvas `{colors.canvas}` (#f4f4f5) with `{colors.ink}` (#26272b) text — a one-step-off-white that registers visibly only against the auth card surface.
- Pill geometry — every CTA uses `{rounded.pill}` (30px) at 40-48px heights, reading as a full pill. The root `--radius` is 32px, captured here as `{rounded.card}`.
- atHauss display tightening — the 36px hero h1 carries -0.72px letter-spacing, the only non-default tracking value in the type system. Body and labels stay at zero tracking.
- Wordmark-as-parenthetical — `(character.ai)` set in atHauss at 18px, weight 400, the URL itself functioning as logotype.
- Near-black auth CTA `{colors.cta}` (#202024) — the visible primary on the page, despite the underlying `--primary-blue` (#1a5eff) declared in the token graph.
- Two-typeface declaration — atHauss as `--font-at-hauss` and Inter as `--font-inter`, with no third family across nine type roles spanning 11px through 36px.
- NextUI scale beneath a Tailwind layer — 379 CSS variables on `:root` expose `--nextui-primary` (212 100% 47%), `--nextui-radius-large` (14px), `--nextui-spacing-unit-4` (1rem), surfacing the underlying component library through custom tokens.

## Colors

### Brand & Accent
- **Primary Blue** (`{colors.primary}` — #1a5eff): frequency 0 visible on the auth surface, but layer "brand" in the extraction, declared as `--primary-blue` and `--primary-refresh`. Reserved for focus rings, latent link states, and the primary-button slot when the auth wall opens into the product.
- **Primary Container** (`{colors.primary-container}` — #a0c9ff): frequency 0. Used as `--primary-container-refresh` and `--link-light` — the lightened brand tint for selected states and disabled link backgrounds.
- **Primary Deep** (`{colors.primary-deep}` — #0061a6): frequency 0. The darker container slot — `--primary-container` proper in the Material-Design-derived ladder.
- **Primary On Container** (`{colors.primary-on-container}` — #001138): frequency 0. Text on a primary-container background.
- **Inverse Primary** (`{colors.inverse-primary}` — #d1dfff): frequency 0. The very-light blue tint used on inverse surfaces.
- **Link** (`{colors.link}` — #138eed): frequency 0 visible. Used on the Terms and Privacy Policy fine-print lines under the auth buttons.
- **Link Secondary** (`{colors.link-secondary}` — #1ba5fb): frequency 0. Declared as `--plus-light-blue` — used inside the c.ai+ subscription chrome.

### CTA / Ink
- **CTA Near-Black** (`{colors.cta}` — #202024): frequency 1 as background. Declared as `--button-background` in the token graph. The visible primary on every auth CTA — Sign Up to Chat, Continue with Google, Continue with Apple. Not pure black, slightly warmed toward neutral 850.
- **CTA Text** (`{colors.cta-text}` — #fafafa): frequency 11 (7 text · 4 bg). Used as the text fill on every near-black CTA. Also functions as the card-fill surface tone.
- **Ink** (`{colors.ink}` — #26272b): frequency 39 (38 text · 1 bg). The dominant text color on the canvas — h1, navigation labels, the (character.ai) wordmark.
- **Ink Strong** (`{colors.ink-strong}` — #131316): frequency 3 (1 text · 2 bg). Reserved for emphasis text and a darker hover-state background on the near-black CTA.
- **Body** (`{colors.body}` — #1e1e1e): frequency 0 raw, declared as `--on-surface-refresh`. Used for the "Sign up in just ten seconds" sub-headline on the auth card.
- **Muted** (`{colors.muted}` — #585962): frequency 17 (all text). The workhorse secondary — nav links, footer links, fine-print body. Declared as `--muted-foreground` and `--on-surface-variant`.
- **Muted Soft** (`{colors.muted-soft}` — #7c7c87): frequency 0 raw. Captions, placeholder text, tertiary labels.
- **Outline** (`{colors.outline}` — #a2a2ac): frequency 0 raw. Disabled icons, very-light borders.

### Surface
- **Canvas** (`{colors.canvas}` — #f4f4f5): frequency 0 raw, declared as `--background`. The default page floor — one step off pure white.
- **Surface Card** (`{colors.surface-card}` — #fafafa): frequency 11 (7 text · 4 bg). The auth card surface, the elevated-content fill.
- **Surface Cream** (`{colors.surface-cream}` — #ececee): frequency 0 raw. Declared as `--surface-elevation-1` and `--brand-bg` — slightly warmer than the canvas.
- **Surface Cream Strong** (`{colors.surface-cream-strong}` — #e5dfeb): frequency 0 raw. The brand off-white tone declared as `--G175` and `--brand-off-white`.
- **Hairline** (`{colors.hairline}` — #e2e8f0): frequency 61 (60 border · 1 bg). The dominant border tone on the entire page — auth card outline, input borders, footer divider.
- **Hairline Strong** (`{colors.hairline-strong}` — #d4d4da): frequency 2 (both border). A heavier hairline used on the email-button outline and elevated card borders.
- **Surface Elevation 3** (`{colors.surface-elevation-3}` — #c8c8cf): frequency 0. The `--accent` and `--surface-elevation-4` slot — used inside product chrome behind the wall.

### Accent / Semantic
- **Accent Violet** (`{colors.accent-violet}` — #b460eb): frequency 0. Declared as `--tertiary-refresh` — used inside the labs-gradient (a three-stop pink-to-violet-to-soft-blue band defined on `--labs-gradient`).
- **Accent Violet Soft** (`{colors.accent-violet-soft}` — #e1bff7): frequency 0. Tertiary container fill.
- **Accent Green** (`{colors.accent-green}` — #1ebe53): frequency 0. Declared as `--secondary-refresh` and `--secondary-green` — used on connection status dots.
- **Accent Green Soft** (`{colors.accent-green-soft}` — #a8eac6): frequency 0. Secondary container fill.
- **Warning** (`{colors.warning}` — #ff9800): frequency 0. Standard amber warning fill.
- **Warning Soft** (`{colors.warning-soft}` — #ffe991): frequency 0. Warning container fill.
- **Error** (`{colors.error}` — #cc3434): frequency 0. Validation error fill, declared as `--error`.
- **Error Soft** (`{colors.error-soft}` — #fba7b9): frequency 0. Error container fill.

## Typography

### Font Family
The system runs **atHauss** as the single display + body face, declared as `--font-at-hauss` with a fallback chain through `ui-sans-serif, system-ui, sans-serif`. **Inter** is declared in parallel as `--font-inter` for secondary roles and as the closest open-source substitute. JetBrains Mono or another monospace face would be needed for code blocks but does not appear on the auth surface.

The display/body split is collapsed:
- atHauss weight 600 with -0.72px tracking → h1 (36px) — the only tightened tier
- atHauss weight 400-500 → body, navigation, button labels, captions
- All other type lands at zero letter-spacing

### Hierarchy

| Token | Size | Weight | Line Height | Letter Spacing | Use |
|---|---|---|---|---|---|
| `{typography.display-md}` | 36px | 600 | 1.11 | -0.72px | "Get access to 10M+ Characters" — the only display tier on the public surface |
| `{typography.title-lg}` | 18px | 400 | 1.5 | 0 | Sub-headline ("Sign up in just ten seconds"), wordmark |
| `{typography.title-md}` | 16px | 400 | 1.5 | 0 | Nav link text, card-title labels |
| `{typography.body-md}` | 14px | 400 | 1.43 | 0 | Default running-text, auth button labels |
| `{typography.button}` | 14px | 500 | 1.43 | 0 | Standard button labels — atHauss medium |
| `{typography.nav-link}` | 16px | 400 | 1.5 | 0 | Top-nav menu items |
| `{typography.caption}` | 12px | 400 | 1.33 | 0 | Footer secondary links |
| `{typography.caption-label}` | 11px | 500 | 1.45 | 0 | "OR" divider, badge labels |
| `{typography.fine-print}` | 11px | 400 | 1.45 | 0 | "By continuing, you agree" footer text |

### Principles
The 36px h1 is the only typography role with non-zero letter-spacing in the entire system. The -0.72px tightening reads as a `-0.02em` em-relative ratio — character.ai's choice to round to exact pixels rather than ems. Below 18px, every label and link stays at zero tracking and 400 or 500 weight. There is no 700-weight tier on the public surface — atHauss carries headings at 600 only.

### Note on Font Substitutes
If atHauss is unavailable, **Inter** at the same weights (400 body, 500 labels, 600 display) is the closest substitute since it is already declared as `--font-inter` in the system. **Söhne** or **Haas Grot** are paid alternatives. Helvetica or Arial would break the slightly humanist proportions of atHauss.

## Layout

### Spacing System
- **Base unit:** 4px.
- **Tokens:** `{spacing.xxs}` 4px · `{spacing.xs}` 8px · `{spacing.sm}` 12px · `{spacing.md}` 16px · `{spacing.base}` 20px · `{spacing.lg}` 24px · `{spacing.xl}` 32px · `{spacing.xxl}` 40px.
- **Most frequent values from extraction:** 8px appears 12 times, "0px 16px" (button horizontal padding) appears 5 times, "8px 16px" (nav-link padding) appears 4 times.
- **Auth card internal padding:** `{spacing.xl}` (32px) — the dominant card padding.
- **Button height tier:** 40px for chrome CTAs (Sign Up to Chat, Login), 48px for auth-provider buttons (Continue with Google, Apple, email).

### Grid & Container
- **Max content width:** the auth card caps at ~360px and sits centered on a 1440px canvas.
- **Single-card layout:** no grid — the page is one column with one card.
- **Top-nav layout:** wordmark left, two pill buttons (Sign Up to Chat, Login) right, no center navigation.
- **Footer link row:** two rows of inline-flex links centered at the bottom of the viewport.

### Whitespace Philosophy
The auth card occupies one-quarter of the viewport, surrounded by canvas on every side. There is no second content band, so whitespace is the page's primary compositional element. The vertical gap between the wordmark and the auth card is roughly 240px of pure canvas — a deliberate emptiness that focuses every visual moment on the sign-up triplet.

## Elevation & Depth

| Level | Treatment | Use |
|---|---|---|
| Flat | No shadow, no border | Body sections, footer link row |
| Soft hairline | 1px `{colors.hairline}` border | Auth card outline, button outlines |
| Heavier hairline | 1px `{colors.hairline-strong}` border | Email button, text input outline |
| Card surface | `{colors.surface-card}` background — no shadow | The auth card itself |
| Latent shadow | `--toastify-toast-shadow: 0px 4px 12px rgba(0,0,0,0.1)` | Reserved for toast notifications, not visible on the auth surface |

The elevation philosophy is **hairline-first, shadow-rare**. The auth card relies on a 1px `{colors.hairline}` border plus the `{colors.surface-card}` fill against the `{colors.canvas}` floor — the one-step contrast is the depth signal. Drop shadows exist in the token graph (`--toastify-toast-shadow`, `--nextui-box-shadow-small/medium/large`) but never render on the public surface.

## Shapes

### Border Radius Scale

| Token | Value | Use |
|---|---|---|
| `{rounded.sm}` | 8px | `--nextui-radius-small` — reserved for small dropdowns |
| `{rounded.md}` | 12px | `--nextui-radius-medium` — reserved for medium cards inside the product |
| `{rounded.lg}` | 14px | `--nextui-radius-large` — reserved for larger card variants |
| `{rounded.pill}` | 30px | Every visible CTA — Sign Up to Chat, Login, Continue buttons, text inputs |
| `{rounded.card}` | 32px | The auth card outer radius (matches `--radius: 2rem`) |
| `{rounded.full}` | 9999px | The help FAB at bottom-right and inline avatar tokens |

### Iconography
The auth surface carries five icons total: the Google G in its colored form, the Apple wordmark in white, an envelope outline on the email button, and a "?" inside the help FAB at bottom-right. No other iconography appears on the public surface. The product side declares `--swiper-navigation-size: 44px` for carousel arrows, but those live behind the wall.

## Components

### Top Navigation

**`top-nav`** — Cream-canvas nav bar pinned to the top of the viewport, 72px tall, `{colors.canvas}` background. Carries the parentheses-wrapped wordmark at left, two pill CTAs (`{component.button-primary}` and `{component.button-secondary}`) at right. No center menu items, no logo glyph.

**`wordmark`** — The `(character.ai)` lockup, set in `{typography.title-lg}` (atHauss 18px / 400), `{colors.ink-strong}` text. The parentheses are part of the wordmark, not punctuation.

**`nav-link`** — Inline nav text link in `{colors.muted}` text. Padding `8px 16px`. Used in the footer link row (About, Careers, Safety Center, Blog, Cookie Policy, Privacy Policy, Terms of Service, Charms Terms of Use).

### Buttons

**`button-primary`** — The signature Sign Up to Chat CTA. Background `{colors.cta}` (#202024), text `{colors.cta-text}` (#fafafa), type `{typography.button}` (atHauss 14px / 500), padding `0px 16px`, height 40px, rounded `{rounded.pill}` (30px).

**`button-primary-hover`** — Press state. Background darkens to `{colors.ink-strong}` (#131316). Radius unchanged.

**`button-secondary`** — The Login pill. Background `{colors.surface-card}` with a 1px `{colors.hairline}` border, text `{colors.ink}`, otherwise identical geometry to primary.

**`button-auth-provider`** — Continue with Google, Continue with Apple. Same near-black fill as `{component.button-primary}` but 48px tall and full-card-width — the auth-provider tier overrides the standard 40px chrome height.

**`button-auth-email`** — Continue with email. Inverts to a `{colors.surface-card}` fill with a 1px `{colors.hairline-strong}` border, text `{colors.ink}`. Reads as the secondary auth path beneath the OAuth duo.

**`text-link`** — Inline links in `{colors.link}` (#138eed). Used on the "Terms" and "Privacy Policy" anchors inside the fine-print block.

### Cards & Containers

**`auth-card`** — The 360px-wide sign-up card. Background `{colors.surface-card}` (#fafafa), `{colors.hairline}` 1px outline, rounded `{rounded.card}` (32px), internal padding `{spacing.xl}` (32px). Holds the hero headline, sub-headline, three stacked auth buttons, the OR divider, and the fine-print block.

**`hero-headline`** — The "Get access to 10M+ Characters" h1. Type `{typography.display-md}` (atHauss 36px / 600 / -0.72px), color `{colors.ink}`. The card's only large-type element.

**`hero-subhead`** — "Sign up in just ten seconds" paragraph. Type `{typography.title-lg}` (atHauss 18px / 400), color `{colors.body}`. Sits directly under the h1 with no vertical divider.

### Inputs & Forms

**`text-input`** — Pill-shaped text input. Background `{colors.surface-card}`, text `{colors.ink}`, type `{typography.body-md}`, rounded `{rounded.pill}` (30px), padding `0px 20px`, height 48px, 1px `{colors.hairline-strong}` border. Matches the email-button geometry exactly.

### Divider / Fine-Print

**`divider-or`** — The "OR" splitter between OAuth buttons and the email button. Type `{typography.caption-label}` (atHauss 11px / 500), color `{colors.muted}`, no background. The text floats centered with no horizontal rule.

**`fine-print-block`** — "By continuing, you agree with the Terms and Privacy Policy". Type `{typography.fine-print}` (atHauss 11px / 400), color `{colors.muted}`. Links inside use `{component.text-link}`.

### Footer / Misc

**`footer-link-row`** — Inline-flex row of footer text links, centered horizontally at the bottom of the viewport. Type `{typography.body-md}`, color `{colors.muted}`, padding `16px 24px`.

**`help-fab`** — A 32px circular help button anchored at bottom-right, holding a "?" glyph. Background `{colors.surface-cream}` (#ececee), text `{colors.ink}`. Rounded `{rounded.full}`.

**`plus-badge`** — The c.ai+ subscription marker. Background `{colors.link-secondary}` (#1ba5fb — `--plus-light-blue`), text `{colors.cta-text}`, rounded `{rounded.pill}`, padding `2px 10px`. Does not appear on the auth surface but lives in the token graph behind the wall.

## Do's and Don'ts

### Do
- Anchor every CTA on the near-black `{colors.cta}` (#202024) — declared `--button-background` — rather than on the brand-layer `{colors.primary}` (#1a5eff). The blue stays in reserve for focus rings and link text.
- Use `{rounded.pill}` (30px) on every button at 40-48px height. Do not substitute `rounded-md` or `rounded-lg` from a default Tailwind theme.
- Wrap the wordmark in literal parentheses: `(character.ai)`. The brackets are part of the lockup, not punctuation around it.
- Apply -0.72px letter-spacing on the 36px h1 only. Every smaller tier stays at zero tracking.
- Pair the 360px auth card with empty canvas on every side — the whitespace is the composition.

### Don't
- Don't paint the Sign Up to Chat button in `{colors.primary}` (#1a5eff). The brand color is declared but never visible on a CTA — fill it with `{colors.cta}` instead.
- Don't use `{rounded.card}` (32px) on small buttons or chips. The 32px radius is reserved for the auth card outer container; buttons under 56px tall use `{rounded.pill}` (30px) instead.
- Don't apply -0.72px tracking to body or label tiers. Tightening below 18px crushes atHauss into illegibility.
- Don't substitute Helvetica or Arial for atHauss. Inter is the declared `--font-inter` fallback — use that, not a metric-incompatible neo-grotesque.
- Don't add a 700-weight tier. atHauss tops out at 600 on the public surface; jumping to 700 reads as off-brand bombast.
- Don't fill the auth card with a hero illustration, testimonial column, or feature grid. The card holds exactly six elements: h1, sub-head, three buttons, fine-print. Adding a sixth row breaks the composition.
- Don't apply a drop shadow under the auth card. Elevation is signaled by the 1px `{colors.hairline}` outline against `{colors.canvas}` — adding a shadow reads as Bootstrap default.

## Responsive Behavior

### Breakpoints

| Name | Width | Key Changes |
|---|---|---|
| Mobile | < 768px | Top nav stays — Sign Up + Login pills shrink to icon-only; auth card scales to ~92% viewport width; h1 drops to 28px; footer link row stacks into two rows |
| Tablet | 768–1024px | Top-nav pills retain text; auth card stays at 360px centered; footer remains single row |
| Desktop | 1024–1440px | Full top-nav pills; auth card at 360px; footer link row inline-flex centered |
| Wide | > 1440px | Same as desktop with more outer canvas; auth card never exceeds 360px |

### Touch Targets
- `{component.button-primary}` at 40px height — at the WCAG 44px floor for primary actions.
- `{component.button-auth-provider}` at 48px height — comfortably above the floor for the conversion-critical OAuth row.
- `{component.text-input}` at 48px height.
- `{component.help-fab}` at 32px diameter — slightly under WCAG 44 but visually centered.

## Known Gaps

- atHauss is a licensed character.ai typeface with no public web font. Inter (declared as `--font-inter`) is the closest substitute and is already in the fallback stack.
- The 379 `:root` CSS variables expose latent product-side tokens — `--feed-item-width: 140px`, `--plus-gradient` (a four-stop cyan-to-yellow-to-pink-to-neutral band), `--labs-gradient` (a three-stop pink-to-violet-to-soft-blue band), swiper carousel theming — that never render on the public auth surface. They are documented as token names but not extracted as components.
- Dark-mode tokens exist in the graph (`--brand-bg-inverted`, `--inverse-surface-refresh`, the `--G900` near-black slot) but the public marketing surface renders light-only.
- Product-side components — chat bubbles, message-action menus, character cards in the discovery feed, the c.ai+ paywall sheet — live entirely behind the sign-up wall and were not captured.
- Animation and transition timings (auth button hover, modal entry, toast slide-in via the declared toastify variables) are out of scope.
- Form validation states beyond the default input are not extracted — error and success states would require triggering an auth failure to confirm.
