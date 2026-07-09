# Association culturelle musulmane — Website Design

## Purpose

Build a static website for the mosque "Association culturelle musulmane" (Av. du Châtelard 5, 1815 Montreux), using the same template, layout, and visual style as the reference site https://mosquee-clarens.ch/presentation/.

## Contact details

- Name: Association culturelle musulmane
- Address: Av. du Châtelard 5, 1815 Montreux
- Email: serinsami71@gmail.com
- Phone: +41041765801255 (format looks non-standard for a Swiss number — leading `0` right after `+41` — flagged on-site for the owner to verify/correct)

## Pages

Six pages, matching the reference site's structure:

1. **Accueil** (`index.html`) — hero photo with overlay title/CTA, welcome/announcements section, prayer times snapshot, link into Services & activités.
2. **Présentation** (`presentation.html`) — "Qui sommes-nous", beliefs statement, objectives list, organization/financing note, partnerships. Generic placeholder text in the tone of the reference site (moderation, Sunnah/Jama'ah, non-profit association under Swiss civil code).
3. **Services & activités** (`services.html`) — prayer services, religious education for children (using the real photo of the kids' class, faces already blurred), community support. Placeholder text, real photos.
4. **Horaires des prières** (`horaires.html`) — static prayer time table styled after the Mawaqit display captured in the mosque's own screen photo (Fajr / Chourouq / Dohr / Asr / Maghrib / Icha + Joumoua time), explicitly marked as example data to be updated regularly. Includes a Qibla direction info block (magnetic bearing, compass degrees/grades) like the reference site.
5. **Contact** (`contact.html`) — address, phone, email, static Google Maps embed link (no API key), social link placeholders (Facebook/Instagram, left as `#` until real links are provided).
6. **Dons & Zakat** (`dons.html`) — info-only: bank transfer/IBAN placeholder block with an explanatory note. No payment processing (no Stripe, no backend).

No newsletter signup (no backend to receive it) and no live/calculated prayer times (static table only) for v1.

## Tech stack

- Plain HTML/CSS/JS, no framework, no build step.
- One shared stylesheet: `styles.css`.
- File structure:
  ```
  index.html
  presentation.html
  services.html
  horaires.html
  contact.html
  dons.html
  styles.css
  photos/
    unnamed.webp       (mihrab/minbar detail)
    unnamed (1).webp   (wide prayer hall — hero candidate)
    unnamed (2).webp   (men praying)
    unnamed (3).webp   (kids' class, faces blurred)
    unnamed (4).webp   (Friday congregation — hero candidate)
  ```
- No deployment configuration in this pass (built and reviewed locally first; Cloudflare Pages setup deferred to a follow-up).

## Visual design system

- Palette: dark teal `#033534` (header/nav/footer), gold `#c9a84c` (buttons/accent), cream `#f8f6f1` (section backgrounds), white content sections.
- Font: Open Sans (Google Fonts), matching the reference site.
- Hero: full-bleed real photo (Friday congregation or wide prayer hall) with dark gradient overlay, white heading text, gold CTA button — same treatment as the reference site's hero but using the mosque's own photos instead of stock imagery.
- Layout: alternating full-width sections (image+text, image+text, centered CTA blocks), matching the reference homepage's rhythm.
- Nav: sticky top bar, logo placeholder + 6-page nav links, matches reference site's nav order.
- Footer: address, copyright, social icons — teal background, matches reference site.

## Content approach

All body copy is realistic placeholder text (clearly generic, non-fabricated specifics like classes/times where not confirmed) in the tone of the reference site, except:
- Contact details (real, provided by owner)
- Prayer times table (uses format/values seen in mosque's own Mawaqit screen, marked as example data)
- Photos (real, provided by owner, already cleaned of unrelated files)

## Out of scope (v1)

- Live/calculated prayer times (adhan.js or API)
- Stripe or any online payment processing
- Newsletter signup / email capture
- Cloudflare Pages deployment
- Multi-language support
