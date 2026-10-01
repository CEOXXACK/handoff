/* POST /api/checkout/portal — single-use portal unlock: $9 one-time payment that
 * removes the Handoff mark from ONE portal link. The browser sends only a SHA-256
 * hash of the portal code (never the portal contents), bound into session metadata
 * so the paid unlock is tied to exactly one link. managed_payments:{enabled:false}
 * is required on this Managed Payments account for inline price_data. */
const { ok, fail, handle, body, resolveBase, stripe, PORTAL_PRICE } = require('./common');

exports.handler = async (event) => handle(event, async () => {
  try {
    const reqBody = body(event);
    const base = resolveBase(event, reqBody);
    if (!base) return fail(400, 'No SITE_URL and no Origin header');
    const pc = (typeof reqBody.pc === 'string' && /^[0-9a-f]{64}$/.test(reqBody.pc)) ? reqBody.pc : '';
    if (!pc) return fail(400, 'pc (sha256 hex) required');
    const session = await stripe().checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: PORTAL_PRICE,
          product_data: {
            name: 'Handoff — single-use portal',
            description: 'Removes the Handoff mark from one portal link. One-time payment.',
          },
        },
      }],
      success_url: `${base}/?portalgold=1&session_id={CHECKOUT_SESSION_ID}&pc=${pc}`,
      cancel_url: `${base}/?canceled=1`,
      managed_payments: { enabled: false },
      metadata: { kind: 'portal_single', pc },
    });
    console.log(`[create-portal-checkout] session=${session.id} pc=${pc.slice(0, 12)}…`);
    return ok({ url: session.url });
  } catch (e) {
    console.error('[create-portal-checkout]', e.message, e.raw && e.raw.message ? '| raw: ' + e.raw.message : '', e.type || '');
    return fail(500, 'Could not start checkout');
  }
});