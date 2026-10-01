/* POST /api/checkout/setup — $99 one-time done-for-you setup (mirror of server.js).
 * managed_payments:{enabled:false} is required on this Managed Payments account
 * for inline price_data (else Stripe rejects: product tax code missing). */
const { json, fail, handle, body, resolveBase, stripe, SETUP_PRICE } = require('./common');

exports.handler = async (event) => handle(event, async () => {
  try {
    const reqBody = body(event);
    const base = resolveBase(event, reqBody);
    if (!base) return fail(400, 'No SITE_URL and no Origin header');
    const email = (typeof reqBody.email === 'string' && reqBody.email.includes('@')) ? reqBody.email.trim() : undefined;
    const biz = (typeof reqBody.biz === 'string') ? reqBody.biz.trim().slice(0, 120) : undefined;
    const session = await stripe().checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: SETUP_PRICE,
          product_data: {
            name: 'Handoff — Done-for-you setup',
            description: 'We customize Handoff for your business: your logo, colors, and defaults configured for you.',
          },
        },
      }],
      success_url: `${base}/?setup=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/?canceled=1`,
      customer_email: email,
      managed_payments: { enabled: false },
      metadata: biz ? { biz } : {},
    });
    console.log(`[create-setup] session=${session.id} email=${email || 'n/a'} biz=${biz || 'n/a'}`);
    return json(200, { url: session.url });
  } catch (e) {
    console.error('[create-setup]', e.message, e.raw && e.raw.message ? '| raw: ' + e.raw.message : '', e.type || '');
    return json(500, { error: 'Could not start setup checkout', detail: e.message });
  }
});