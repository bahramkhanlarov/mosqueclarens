# Stripe Card Donations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Donate by card" option to the Dons & Zakat page (all 5 languages) that creates a Stripe Checkout Session via a new Cloudflare Pages Function and redirects the donor to Stripe's hosted payment page.

**Architecture:** A single Cloudflare Pages Function (`functions/create-donation-checkout.js`) calls the Stripe REST API directly via `fetch` (no SDK, no build step — matches this site's existing buildless static setup) to create a one-time Checkout Session in CHF. A shared client-side script (`/donate.js`) wires up preset/custom amount selection and the POST-and-redirect flow on every `dons.html`. No Stripe.js/Elements or publishable key is needed since Checkout is Stripe-hosted.

**Tech Stack:** Cloudflare Pages Functions (Workers runtime, vanilla JS, no npm dependencies), Stripe REST API (Checkout Sessions), vanilla JS/CSS matching the existing site.

## Global Constraints

- No `payment_method_types` param in the Stripe API call — omit it entirely so Stripe's dynamic payment methods apply (per `docs/superpowers/specs/2026-07-10-stripe-donations-design.md`).
- Currency is `chf` throughout; amounts sent to Stripe are integer centimes (`amount * 100`).
- `mode: 'payment'` only — no subscriptions in this pass.
- Never commit a real Stripe secret key to the repo. Local dev uses `.dev.vars` (gitignored); production uses a Cloudflare Pages secret.
- Preset donation amounts: 20 / 50 / 100 / 200 CHF, plus a custom amount field, per the approved spec.
- All 5 language versions of `dons.html` (`dons.html`, `en/dons.html`, `tr/dons.html`, `ar/dons.html`, `de/dons.html`) get the same feature with translated labels.

---

### Task 1: Cloudflare Pages Function — create Stripe Checkout Session

**Files:**
- Create: `functions/create-donation-checkout.js`
- Create: `.dev.vars` (local-only, gitignored — holds a real Stripe test secret key)
- Modify: `.gitignore`

**Interfaces:**
- Produces: `POST /create-donation-checkout` — accepts JSON body `{ amount: number, locale: "fr"|"en"|"tr"|"ar"|"de" }`, returns `200 { url: string }` on success or `4xx/5xx { error: string }` on failure. Consumed by `donate.js` in Task 3.

- [ ] **Step 1: Add `.dev.vars` to `.gitignore`**

```
.DS_Store
.gstack/
.claude/settings.local.json
.dev.vars
```

- [ ] **Step 2: Create `functions/create-donation-checkout.js`**

```javascript
const MIN_AMOUNT = 1;
const MAX_AMOUNT = 50000;

const LOCALE_CONFIG = {
  fr: { productName: "Don — Association culturelle musulmane", path: "/dons.html" },
  en: { productName: "Donation — Muslim Cultural Association", path: "/en/dons.html" },
  tr: { productName: "Bağış — İslami Kültür Derneği", path: "/tr/dons.html" },
  ar: { productName: "تبرع — الجمعية الثقافية الإسلامية", path: "/ar/dons.html" },
  de: { productName: "Spende — Islamischer Kulturverein", path: "/de/dons.html" }
};

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch (err) {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const amount = Number(body.amount);
  const locale = LOCALE_CONFIG[body.locale] ? body.locale : "fr";

  if (!Number.isFinite(amount) || amount < MIN_AMOUNT || amount > MAX_AMOUNT) {
    return new Response(JSON.stringify({ error: "Invalid donation amount" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  if (!env.STRIPE_SECRET_KEY) {
    return new Response(JSON.stringify({ error: "Stripe is not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  const config = LOCALE_CONFIG[locale];
  const origin = new URL(request.url).origin;
  const unitAmountCentimes = Math.round(amount * 100);

  const params = new URLSearchParams();
  params.set("mode", "payment");
  params.set("locale", locale);
  params.set("success_url", `${origin}${config.path}?donation=success`);
  params.set("cancel_url", `${origin}${config.path}?donation=cancelled`);
  params.set("line_items[0][quantity]", "1");
  params.set("line_items[0][price_data][currency]", "chf");
  params.set("line_items[0][price_data][unit_amount]", String(unitAmountCentimes));
  params.set("line_items[0][price_data][product_data][name]", config.productName);

  const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: params.toString()
  });

  if (!stripeResponse.ok) {
    const errorBody = await stripeResponse.text();
    return new Response(JSON.stringify({ error: "Stripe checkout session creation failed", details: errorBody }), {
      status: 502,
      headers: { "Content-Type": "application/json" }
    });
  }

  const session = await stripeResponse.json();

  return new Response(JSON.stringify({ url: session.url }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}
```

- [ ] **Step 3: Create `.dev.vars` with a real Stripe test key**

Ask the user for a Stripe **test-mode** restricted key (`rk_test_...`) or secret key (`sk_test_...`) scoped at minimum to Checkout Sessions write access, generated from https://dashboard.stripe.com/test/apikeys. Write it to `.dev.vars` in the project root:

```
STRIPE_SECRET_KEY=rk_test_REPLACE_WITH_REAL_TEST_KEY
```

Do not use a live key for this step. Do not print the key value back in any commit message, log, or chat output beyond this local file.

- [ ] **Step 4: Run the Function locally and verify a valid request succeeds**

Run: `wrangler pages dev . --port 8788`

In a second terminal:
```bash
curl -s -X POST http://localhost:8788/create-donation-checkout \
  -H "Content-Type: application/json" \
  -d '{"amount": 50, "locale": "en"}'
```

Expected: JSON response like `{"url":"https://checkout.stripe.com/c/pay/cs_test_..."}`. Open that URL in a browser and confirm it shows a Stripe Checkout page for CHF 50.00.

- [ ] **Step 5: Verify invalid input is rejected**

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:8788/create-donation-checkout \
  -H "Content-Type: application/json" \
  -d '{"amount": -5, "locale": "en"}'
```

Expected: `400`

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:8788/create-donation-checkout \
  -H "Content-Type: application/json" \
  -d 'not json'
```

Expected: `400`

- [ ] **Step 6: Commit**

```bash
git add functions/create-donation-checkout.js .gitignore
git commit -m "Add Cloudflare Pages Function to create Stripe Checkout Sessions for donations"
```

(`.dev.vars` is gitignored and must NOT appear in `git status` as staged — verify with `git status` before committing that only the two intended files are staged.)

---

### Task 2: Shared donate widget styles

**Files:**
- Modify: `styles.css`

**Interfaces:**
- Produces: CSS classes `.donate-card`, `.amount-group`, `.amount-btn`, `.amount-btn-active`, `.amount-custom`, `#donate-message` consumed by the HTML markup added in Tasks 4–5.

- [ ] **Step 1: Append donate widget styles to `styles.css`**

Add this block at the end of `styles.css` (after the existing `@media (max-width: 700px)` footer block):

```css
/* Donate by card */
.donate-card {
  margin-top: 2.5rem;
  padding-top: 2.5rem;
  border-top: 1px solid var(--border);
}

.amount-group {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin: 1rem 0;
}

.amount-btn {
  background: #fff;
  border: 2px solid var(--border);
  color: var(--dark);
  font-weight: 700;
  font-size: 0.85rem;
  padding: 0.6rem 1.25rem;
  border-radius: 6px;
  cursor: pointer;
  transition: border-color 0.2s, color 0.2s;
}

.amount-btn:hover {
  border-color: var(--gold);
}

.amount-btn-active {
  border-color: var(--gold);
  color: var(--gold);
  background: var(--cream);
}

.amount-custom {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  max-width: 220px;
  margin-bottom: 1.25rem;
}

.amount-custom label {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--gold);
  font-weight: 700;
}

.amount-custom input {
  padding: 0.6rem 0.75rem;
  border: 2px solid var(--border);
  border-radius: 6px;
  font-family: var(--font);
  font-size: 1rem;
  width: 100%;
}

#donate-message {
  margin-top: 1rem;
}
```

- [ ] **Step 2: Visually verify in a browser**

Run: `wrangler pages dev . --port 8788` (if not already running from Task 1), open `http://localhost:8788/dons.html`. Confirm no CSS errors in the browser console (nothing renders yet since the HTML block doesn't exist until Task 4 — this step just confirms the CSS file still loads without syntax errors).

Run: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8788/styles.css`
Expected: `200`

- [ ] **Step 3: Commit**

```bash
git add styles.css
git commit -m "Add donate-by-card widget styles"
```

---

### Task 3: Shared donate widget behavior script

**Files:**
- Create: `donate.js`

**Interfaces:**
- Consumes: `POST /create-donation-checkout` from Task 1 (`{amount, locale}` → `{url}` or `{error}`).
- Consumes (from HTML, added in Tasks 4–5): elements `.donate-card` (with `data-msg-success`, `data-msg-cancelled` attributes), `.amount-btn` (with `data-amount` attribute), `#donate-amount` (number input), `#donate-submit` (button, with `data-locale`, `data-msg-empty`, `data-msg-error` attributes), `#donate-message` (paragraph for inline messages).

- [ ] **Step 1: Create `donate.js`**

```javascript
document.addEventListener("DOMContentLoaded", function () {
  var container = document.querySelector(".donate-card");
  if (!container) return;

  var amountInput = document.getElementById("donate-amount");
  var amountButtons = container.querySelectorAll(".amount-btn");
  var submitBtn = document.getElementById("donate-submit");
  var messageEl = document.getElementById("donate-message");

  function showMessage(text) {
    messageEl.textContent = text;
    messageEl.hidden = false;
  }

  amountButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      amountButtons.forEach(function (b) {
        b.classList.remove("amount-btn-active");
      });
      btn.classList.add("amount-btn-active");
      amountInput.value = btn.dataset.amount;
    });
  });

  var params = new URLSearchParams(window.location.search);
  if (params.get("donation") === "success") {
    showMessage(container.dataset.msgSuccess);
  } else if (params.get("donation") === "cancelled") {
    showMessage(container.dataset.msgCancelled);
  }

  submitBtn.addEventListener("click", function () {
    var amount = parseFloat(amountInput.value);
    if (!amount || amount <= 0) {
      showMessage(submitBtn.dataset.msgEmpty);
      return;
    }

    submitBtn.disabled = true;

    fetch("/create-donation-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: amount, locale: submitBtn.dataset.locale })
    })
      .then(function (res) {
        if (!res.ok) throw new Error("checkout failed");
        return res.json();
      })
      .then(function (data) {
        window.location.href = data.url;
      })
      .catch(function () {
        submitBtn.disabled = false;
        showMessage(submitBtn.dataset.msgError);
      });
  });
});
```

- [ ] **Step 2: Verify the file loads**

Run: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8788/donate.js`
Expected: `200`

- [ ] **Step 3: Commit**

```bash
git add donate.js
git commit -m "Add shared donate widget behavior script"
```

---

### Task 4: Wire the donate widget into the French `dons.html`

**Files:**
- Modify: `dons.html`

**Interfaces:**
- Consumes: `.donate-card` CSS from Task 2, `donate.js` from Task 3.

- [ ] **Step 1: Insert the donate-by-card block into `dons.html`**

Find this existing block (the closing of the QR-bill section):

```html
    <p class="note" style="margin-top: 2rem;">Scannez ce code avec l'application de votre banque (paiement QR-facture suisse) pour faire un don directement. Pour toute question sur les dons ou la Zakat, contactez-nous directement.</p>
    <a href="/contact.html" class="btn">Nous contacter</a>
  </div>
</section>
```

Replace it with:

```html
    <p class="note" style="margin-top: 2rem;">Scannez ce code avec l'application de votre banque (paiement QR-facture suisse) pour faire un don directement. Pour toute question sur les dons ou la Zakat, contactez-nous directement.</p>
    <a href="/contact.html" class="btn">Nous contacter</a>

    <div class="donate-card" data-msg-success="Merci pour votre don ! Un reçu vous a été envoyé par Stripe." data-msg-cancelled="Le paiement a été annulé. Vous pouvez réessayer à tout moment.">
      <h3 style="color: var(--teal); font-family: Georgia, serif;">Faire un don par carte</h3>
      <p>Vous pouvez aussi donner directement en ligne par carte bancaire, Apple Pay ou Google Pay.</p>
      <div class="amount-group" role="group" aria-label="Montant du don">
        <button type="button" class="amount-btn" data-amount="20">20 CHF</button>
        <button type="button" class="amount-btn" data-amount="50">50 CHF</button>
        <button type="button" class="amount-btn" data-amount="100">100 CHF</button>
        <button type="button" class="amount-btn" data-amount="200">200 CHF</button>
      </div>
      <div class="amount-custom">
        <label for="donate-amount">Autre montant (CHF)</label>
        <input type="number" id="donate-amount" min="1" max="50000" step="0.05" inputmode="decimal">
      </div>
      <button type="button" id="donate-submit" class="btn" data-locale="fr" data-msg-empty="Veuillez indiquer un montant." data-msg-error="Une erreur est survenue, veuillez réessayer.">Faire un don</button>
      <p id="donate-message" class="note" hidden></p>
    </div>
  </div>
</section>
```

- [ ] **Step 2: Add the script tag before `</body>`**

Find:

```html
<script src="/script.js"></script>
</body>
</html>
```

Replace with:

```html
<script src="/script.js"></script>
<script src="/donate.js"></script>
</body>
</html>
```

- [ ] **Step 3: Manually verify in a browser**

With `wrangler pages dev . --port 8788` running, open `http://localhost:8788/dons.html`. Confirm:
- The "Faire un don par carte" block renders below the QR-bill section.
- Clicking a preset amount button (e.g. "50 CHF") highlights it and fills the custom amount field with `50`.
- Clicking "Faire un don" with no amount entered shows "Veuillez indiquer un montant." without navigating away.
- Clicking "Faire un don" with an amount selected redirects to a Stripe Checkout page showing CHF and the correct amount.
- Manually visiting `http://localhost:8788/dons.html?donation=success` shows "Merci pour votre don ! ..." inline.
- Manually visiting `http://localhost:8788/dons.html?donation=cancelled` shows "Le paiement a été annulé. ..." inline.

- [ ] **Step 4: Commit**

```bash
git add dons.html
git commit -m "Add Stripe donate-by-card widget to French dons.html"
```

---

### Task 5: Replicate the donate widget into the 4 translated `dons.html` pages

**Files:**
- Modify: `en/dons.html`, `tr/dons.html`, `ar/dons.html`, `de/dons.html`

**Interfaces:**
- Consumes: same as Task 4, applied per-language with `data-locale` matching the page language.

- [ ] **Step 1: Update `en/dons.html`**

Find:

```html
    <p class="note" style="margin-top: 2rem;">Scan this code with your banking app (Swiss QR-bill payment) to donate directly. For any questions about donations or Zakat, please contact us directly.</p>
    <a href="/en/contact.html" class="btn">Contact us</a>
  </div>
</section>
```

Replace with:

```html
    <p class="note" style="margin-top: 2rem;">Scan this code with your banking app (Swiss QR-bill payment) to donate directly. For any questions about donations or Zakat, please contact us directly.</p>
    <a href="/en/contact.html" class="btn">Contact us</a>

    <div class="donate-card" data-msg-success="Thank you for your donation! A receipt has been sent to you by Stripe." data-msg-cancelled="The payment was cancelled. You can try again at any time.">
      <h3 style="color: var(--teal); font-family: Georgia, serif;">Donate by card</h3>
      <p>You can also give directly online by card, Apple Pay or Google Pay.</p>
      <div class="amount-group" role="group" aria-label="Donation amount">
        <button type="button" class="amount-btn" data-amount="20">20 CHF</button>
        <button type="button" class="amount-btn" data-amount="50">50 CHF</button>
        <button type="button" class="amount-btn" data-amount="100">100 CHF</button>
        <button type="button" class="amount-btn" data-amount="200">200 CHF</button>
      </div>
      <div class="amount-custom">
        <label for="donate-amount">Other amount (CHF)</label>
        <input type="number" id="donate-amount" min="1" max="50000" step="0.05" inputmode="decimal">
      </div>
      <button type="button" id="donate-submit" class="btn" data-locale="en" data-msg-empty="Please enter an amount." data-msg-error="Something went wrong, please try again.">Donate</button>
      <p id="donate-message" class="note" hidden></p>
    </div>
  </div>
</section>
```

Then find:

```html
<script src="/script.js"></script>
</body>
</html>
```

Replace with:

```html
<script src="/script.js"></script>
<script src="/donate.js"></script>
</body>
</html>
```

- [ ] **Step 2: Update `tr/dons.html`**

Find:

```html
    <p class="note" style="margin-top: 2rem;">Doğrudan bağış yapmak için bu kodu bankanızın uygulamasıyla tarayın (İsviçre QR-fatura ödemesi). Bağışlar veya Zekat hakkında herhangi bir sorunuz için doğrudan bizimle iletişime geçin.</p>
    <a href="/tr/contact.html" class="btn">Bize ulaşın</a>
  </div>
</section>
```

Replace with:

```html
    <p class="note" style="margin-top: 2rem;">Doğrudan bağış yapmak için bu kodu bankanızın uygulamasıyla tarayın (İsviçre QR-fatura ödemesi). Bağışlar veya Zekat hakkında herhangi bir sorunuz için doğrudan bizimle iletişime geçin.</p>
    <a href="/tr/contact.html" class="btn">Bize ulaşın</a>

    <div class="donate-card" data-msg-success="Bağışınız için teşekkür ederiz! Stripe tarafından size bir makbuz gönderildi." data-msg-cancelled="Ödeme iptal edildi. İstediğiniz zaman tekrar deneyebilirsiniz.">
      <h3 style="color: var(--teal); font-family: Georgia, serif;">Kartla bağış yapın</h3>
      <p>Ayrıca kredi kartı, Apple Pay veya Google Pay ile doğrudan çevrimiçi bağış yapabilirsiniz.</p>
      <div class="amount-group" role="group" aria-label="Bağış miktarı">
        <button type="button" class="amount-btn" data-amount="20">20 CHF</button>
        <button type="button" class="amount-btn" data-amount="50">50 CHF</button>
        <button type="button" class="amount-btn" data-amount="100">100 CHF</button>
        <button type="button" class="amount-btn" data-amount="200">200 CHF</button>
      </div>
      <div class="amount-custom">
        <label for="donate-amount">Diğer miktar (CHF)</label>
        <input type="number" id="donate-amount" min="1" max="50000" step="0.05" inputmode="decimal">
      </div>
      <button type="button" id="donate-submit" class="btn" data-locale="tr" data-msg-empty="Lütfen bir miktar girin." data-msg-error="Bir hata oluştu, lütfen tekrar deneyin.">Bağış yap</button>
      <p id="donate-message" class="note" hidden></p>
    </div>
  </div>
</section>
```

Then find:

```html
<script src="/script.js"></script>
</body>
</html>
```

Replace with:

```html
<script src="/script.js"></script>
<script src="/donate.js"></script>
</body>
</html>
```

- [ ] **Step 3: Update `ar/dons.html`**

Find:

```html
    <p class="note" style="margin-top: 2rem;">امسحوا هذا الرمز بتطبيق مصرفكم (دفع عبر فاتورة QR السويسرية) للتبرع مباشرة. لأي سؤال حول التبرعات أو الزكاة، تواصلوا معنا مباشرة.</p>
    <a href="/ar/contact.html" class="btn">تواصلوا معنا</a>
  </div>
</section>
```

Replace with:

```html
    <p class="note" style="margin-top: 2rem;">امسحوا هذا الرمز بتطبيق مصرفكم (دفع عبر فاتورة QR السويسرية) للتبرع مباشرة. لأي سؤال حول التبرعات أو الزكاة، تواصلوا معنا مباشرة.</p>
    <a href="/ar/contact.html" class="btn">تواصلوا معنا</a>

    <div class="donate-card" data-msg-success="شكرًا لتبرعكم! تم إرسال إيصال إليكم من Stripe." data-msg-cancelled="تم إلغاء الدفع. يمكنكم إعادة المحاولة في أي وقت.">
      <h3 style="color: var(--teal); font-family: Georgia, serif;">التبرع بالبطاقة</h3>
      <p>يمكنكم أيضًا التبرع مباشرة عبر الإنترنت بالبطاقة المصرفية أو Apple Pay أو Google Pay.</p>
      <div class="amount-group" role="group" aria-label="مبلغ التبرع">
        <button type="button" class="amount-btn" data-amount="20">20 CHF</button>
        <button type="button" class="amount-btn" data-amount="50">50 CHF</button>
        <button type="button" class="amount-btn" data-amount="100">100 CHF</button>
        <button type="button" class="amount-btn" data-amount="200">200 CHF</button>
      </div>
      <div class="amount-custom">
        <label for="donate-amount">مبلغ آخر (CHF)</label>
        <input type="number" id="donate-amount" min="1" max="50000" step="0.05" inputmode="decimal">
      </div>
      <button type="button" id="donate-submit" class="btn" data-locale="ar" data-msg-empty="يرجى إدخال مبلغ." data-msg-error="حدث خطأ ما، يرجى المحاولة مرة أخرى.">تبرع الآن</button>
      <p id="donate-message" class="note" hidden></p>
    </div>
  </div>
</section>
```

Then find:

```html
<script src="/script.js"></script>
</body>
</html>
```

Replace with:

```html
<script src="/script.js"></script>
<script src="/donate.js"></script>
</body>
</html>
```

- [ ] **Step 4: Update `de/dons.html`**

Find:

```html
    <p class="note" style="margin-top: 2rem;">Scannen Sie diesen Code mit Ihrer Banking-App (Schweizer QR-Rechnung), um direkt zu spenden. Bei Fragen zu Spenden oder Zakat kontaktieren Sie uns bitte direkt.</p>
    <a href="/de/contact.html" class="btn">Kontakt aufnehmen</a>
  </div>
</section>
```

Replace with:

```html
    <p class="note" style="margin-top: 2rem;">Scannen Sie diesen Code mit Ihrer Banking-App (Schweizer QR-Rechnung), um direkt zu spenden. Bei Fragen zu Spenden oder Zakat kontaktieren Sie uns bitte direkt.</p>
    <a href="/de/contact.html" class="btn">Kontakt aufnehmen</a>

    <div class="donate-card" data-msg-success="Vielen Dank für Ihre Spende! Eine Quittung wurde Ihnen von Stripe zugesandt." data-msg-cancelled="Die Zahlung wurde abgebrochen. Sie können es jederzeit erneut versuchen.">
      <h3 style="color: var(--teal); font-family: Georgia, serif;">Per Karte spenden</h3>
      <p>Sie können auch direkt online per Karte, Apple Pay oder Google Pay spenden.</p>
      <div class="amount-group" role="group" aria-label="Spendenbetrag">
        <button type="button" class="amount-btn" data-amount="20">20 CHF</button>
        <button type="button" class="amount-btn" data-amount="50">50 CHF</button>
        <button type="button" class="amount-btn" data-amount="100">100 CHF</button>
        <button type="button" class="amount-btn" data-amount="200">200 CHF</button>
      </div>
      <div class="amount-custom">
        <label for="donate-amount">Anderer Betrag (CHF)</label>
        <input type="number" id="donate-amount" min="1" max="50000" step="0.05" inputmode="decimal">
      </div>
      <button type="button" id="donate-submit" class="btn" data-locale="de" data-msg-empty="Bitte geben Sie einen Betrag ein." data-msg-error="Es ist ein Fehler aufgetreten, bitte versuchen Sie es erneut.">Spenden</button>
      <p id="donate-message" class="note" hidden></p>
    </div>
  </div>
</section>
```

Then find:

```html
<script src="/script.js"></script>
</body>
</html>
```

Replace with:

```html
<script src="/script.js"></script>
<script src="/donate.js"></script>
</body>
</html>
```

- [ ] **Step 5: Manually verify each language page in a browser**

With `wrangler pages dev . --port 8788` running, open each of:
- `http://localhost:8788/en/dons.html`
- `http://localhost:8788/tr/dons.html`
- `http://localhost:8788/ar/dons.html`
- `http://localhost:8788/de/dons.html`

For each: confirm the translated donate block renders, clicking a preset amount highlights it, and clicking the donate button redirects to a Stripe Checkout page with `locale` matching the page's language (visible in the Checkout page's own UI language).

- [ ] **Step 6: Commit**

```bash
git add en/dons.html tr/dons.html ar/dons.html de/dons.html
git commit -m "Add Stripe donate-by-card widget to EN, TR, AR, DE dons.html"
```

---

### Task 6: End-to-end test with a Stripe test card and production secret setup

**Files:** none (verification + deployment configuration only)

- [ ] **Step 1: Complete a full test payment locally**

With `wrangler pages dev . --port 8788` running and `.dev.vars` containing a valid Stripe test key, open `http://localhost:8788/dons.html`, click "50 CHF", click "Faire un don", and on the Stripe Checkout page use test card `4242 4242 4242 4242`, any future expiry, any CVC, any postal code. Confirm:
- Payment completes and redirects back to `http://localhost:8788/dons.html?donation=success`.
- The inline "Merci pour votre don !" message appears.

- [ ] **Step 2: Confirm the session appears in the Stripe test Dashboard**

Open https://dashboard.stripe.com/test/payments and confirm a CHF 50.00 payment appears, matching the test just completed.

- [ ] **Step 3: Set the production secret on Cloudflare Pages**

This step requires the user's live (or production-intended) Stripe secret key — do not fabricate or guess a value. Ask the user for it directly if not already provided, then run:

```bash
wrangler pages secret put STRIPE_SECRET_KEY --project-name=mosqueclarens
```

When prompted, paste the key. Do not print the key value in any tool output, commit, or log.

- [ ] **Step 4: Push to deploy and verify on the live Cloudflare Pages URL**

```bash
git push origin main
```

Wait for the Cloudflare Pages build to finish (check the Cloudflare dashboard or poll `https://mosqueclarens.pages.dev/dons.html`), then repeat Step 1's manual flow against `https://mosqueclarens.pages.dev/dons.html` using a Stripe test card if `STRIPE_SECRET_KEY` is still a test key, confirming the full round trip works in production.
