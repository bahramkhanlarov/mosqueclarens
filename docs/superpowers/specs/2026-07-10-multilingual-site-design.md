# Multilingual Site (EN, TR, AR, DE)

## Goal

Add English, Turkish, Arabic, and German versions of the mosque website alongside the existing French site, without introducing a build tool or backend.

## Structure

- French stays at the root, URLs unchanged (`/index.html`, `/horaires.html`, `/dons.html`, `/services.html`, `/presentation.html`, `/contact.html`).
- Each new language gets its own folder, mirroring the same 5 pages + index:
  - `/en/index.html`, `/en/presentation.html`, `/en/horaires.html`, `/en/dons.html`, `/en/services.html`, `/en/contact.html`
  - `/tr/...` (same set)
  - `/ar/...` (same set)
  - `/de/...` (same set)
- Total: 5 pages × 4 new languages = 20 new HTML files, plus the 5 existing French pages get a language switcher added.
- No build tooling, no templating engine — matches the site's current plain HTML/CSS/JS approach. Each translated page is a full standalone HTML file with the same structure/CSS/JS as its French counterpart, only text nodes translated.

## Language Switcher

- Added to the nav of every page (all 5 languages), as simple text links: `FR · EN · TR · AR · DE`.
- Each link points to the equivalent page in the target language folder (e.g. on `/dons.html`, the EN link points to `/en/dons.html`; on `/en/dons.html`, the FR link points back to `/dons.html`).
- Implemented as a shared HTML snippet manually kept in sync across all 25 pages (no shared include mechanism exists in this static setup).

## Arabic RTL Handling

- `<html lang="ar" dir="rtl">` on all `/ar/` pages.
- A `[dir="rtl"]` CSS block added to `styles.css` to flip nav alignment, text alignment, and directional spacing (margins/padding that assume LTR) where needed.
- No separate stylesheet — RTL overrides live in the existing `styles.css` scoped under the `[dir="rtl"]` selector.

## Translation Content

- Source of truth is the current French text on each page.
- Translations for EN, TR, AR, DE are produced directly (not via external service), preserving the same HTML structure, headings, and CSS classes — only translatable text nodes change.
- Swiss QR-bill donation details on `dons.html` (IBAN, payment reference, QR code image) remain identical across all language versions — only surrounding labels/instructions are translated.

## Third-Party Embeds

- `horaires.html` embeds a Mawaqit iframe for live prayer times. Check whether Mawaqit's embed URL supports a `lang` query parameter; if so, use the matching language per page. If not, the iframe stays as-is (Mawaqit's own UI, out of our control) while the surrounding page text (headings, explanatory copy) is translated normally.

## SEO

- Add `hreflang` alternate tags in `<head>` on every page (French and all 4 new languages), listing all 5 language versions of that page plus an `x-default` pointing to the French root version.

## Out of Scope

- No browser-language auto-detection or redirect.
- No JS-based/client-side language switching or localStorage persistence.
- No backend, CMS, or i18n framework/build step.
- No changes to the Swiss QR-bill payment data itself.

## Deployment

- No changes needed to Cloudflare Pages configuration — new folders are static assets served the same way as existing pages.
