/* POST /api/checkout — subscription session (mirror of server.js /api/checkout). */
const { ok, fail, handle, body, resolveBase, stripe, priceId } = require('./common');

exports.handler = async (event) => handle(event, async () => {
  try {
    const reqBody = body(event);
    const base = resolveBase(event, reqBody);
    if (!base) return fail(400, 'No SITE_URL and no Origin header');
    const email = (typeof reqBody.email === 'string' && reqBody.email.includes('@')) ? reqBody.email.trim() : undefined;
    const session = await stripe().checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId(), quantity: 1 }],
      success_url: `${base}/?licensed=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/?canceled=1`,
      customer_email: email,
      allow_promotion_codes: true,
    });
    console.log(`[create-checkout] session=${session.id} email=${email || 'n/a'}`);
    return ok({ url: session.url });
  } catch (e) {
    console.error('[create-checkout]', e.message);
    return fail(500, 'Could not start checkout');
  }
});