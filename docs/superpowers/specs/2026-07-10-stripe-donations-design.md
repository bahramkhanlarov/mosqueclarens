# Stripe Card Donations

## Goal

Let donors give by card (or other Stripe-supported methods) on the Dons & Zakat page, alongside the existing Swiss QR-bill option, across all 5 language versions of the site.

## Architecture

The site is currently pure static HTML/CSS/JS with no backend. This feature adds the site's first server-side piece: a Cloudflare Pages Function at `functions/create-donation-checkout.js`. It runs at request time on Cloudflare's edge, holds the Stripe secret key as an environment secret (never exposed to the browser), and creates a Stripe Checkout Session via the Checkout Sessions API.

No Stripe.js/Elements integration is needed — donors are redirected to Stripe's own hosted Checkout page, so no publishable key or client-side Stripe SDK is required.

## Flow

1. Donor is on `dons.html` (or `/en/dons.html`, `/tr/dons.html`, `/ar/dons.html`, `/de/dons.html`).
2. In the new "Donate by card" block, they pick a preset CHF amount (20 / 50 / 100 / 200) or type a custom amount.
3. Clicking "Donate" runs client-side JS that POSTs `{ amount, locale }` (amount in CHF, locale derived from the page) to `/create-donation-checkout`.
4. The Function validates the amount (integer or 2-decimal CHF value, positive, capped at a sane maximum e.g. CHF 50,000 to catch input errors), creates a Checkout Session in `payment` mode with a single line item ("Don à l'association" / localized equivalent) priced in `chf`, sets `locale` to match the donor's page language, and sets `success_url`/`cancel_url` back to that language's `dons.html` with `?donation=success` / `?donation=cancelled` query params.
5. The Function returns `{ url: session.url }`; client-side JS redirects the browser there.
6. On return, `dons.html` checks the query param on load and shows a small inline confirmation ("Thank you for your donation") or a neutral "Payment was not completed" message — no page reload logic beyond reading `location.search`.

## Stripe API usage

- Checkout Sessions API (`stripe.checkout.sessions.create`), `mode: 'payment'`.
- **No `payment_method_types` param** — omitted entirely so Stripe's dynamic payment methods (configured from the Stripe Dashboard) decide what to show (card, Apple Pay, Google Pay, TWINT if enabled, etc.) based on donor context.
- `currency: 'chf'`.
- `line_items`: one item, `price_data` with the donor-entered amount converted to centimes (`amount * 100`), product name "Don — Association culturelle musulmane" (localized per language).
- `success_url`: `https://clarensmosquee.ch/{lang-prefix}dons.html?donation=success`
- `cancel_url`: `https://clarensmosquee.ch/{lang-prefix}dons.html?donation=cancelled`
- `locale`: `fr` / `en` / `tr` / `ar` / `de` matching the donor's page.
- Latest Stripe API version, called via the Stripe Node SDK from the Pages Function.

## Secrets

- `STRIPE_SECRET_KEY` set as a Cloudflare Pages environment secret (via dashboard or `wrangler pages secret put`), never committed to the repo or written into any file in this session.
- Recommend a **restricted API key** (`rk_` prefix, scoped to Checkout Sessions: write) over a full secret key, per Stripe's own guidance — the user will generate this in the Stripe Dashboard.

## Frontend changes (all 5 `dons.html` files)

- New "Donate by card" block added below the existing bank transfer/QR-bill block (`.iban-box`), reusing existing card/button visual language (`.btn`, `.card` styles) rather than inventing new components.
- Preset amount buttons (20/50/100/200 CHF) as a small button group; clicking one selects it (visually highlighted) and fills a numeric input; the input can also be typed into directly for a custom amount.
- A "Donate" button triggers the POST-and-redirect flow described above.
- Inline success/cancelled message shown based on `?donation=` query param, translated per language.
- Labels translated consistently with the rest of each language's `dons.html` (e.g. "Faire un don par carte" / "Donate by card" / "Kartla bağış yapın" / "التبرع بالبطاقة" / "Per Karte spenden").

## Error handling

- If the Function's Stripe API call fails (network issue, invalid amount, Stripe error), it returns a 4xx/5xx JSON error; client-side JS shows an inline error message ("Une erreur est survenue, veuillez réessayer" / localized) instead of redirecting — no silent failure.
- Amount validation happens both client-side (basic sanity: positive number, reasonable max) and server-side in the Function (never trust client input for the actual charge amount sent to Stripe).

## Out of scope

- No recurring/subscription donations in this pass — one-time only. Monthly giving can be added later as a separate Checkout Session `mode: 'subscription'` enhancement.
- No webhook handling for post-payment reconciliation in this pass (e.g. emailing a receipt, logging donations to a database) — Stripe's own Checkout receipt email (if enabled in the Dashboard) covers the donor-facing confirmation for now.
- No Stripe Tax / VAT handling — donations are not subject to Swiss VAT-relevant products in this context.
- No changes to the existing Swiss QR-bill donation flow — it stays as-is, side by side with the new card option.

## Deployment

- Requires enabling Cloudflare Pages Functions for this project (the `functions/` directory is picked up automatically by Cloudflare Pages on deploy — no wrangler.toml changes needed for a Pages project).
- Requires the user to set `STRIPE_SECRET_KEY` as a Pages secret before the donate button will work in production; until then, the button can exist but will show the error state if clicked.
