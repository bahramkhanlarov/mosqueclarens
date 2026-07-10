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
