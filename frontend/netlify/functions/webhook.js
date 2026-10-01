/* POST /webhook — Stripe webhook. Needs the RAW body for signature verification:
 * on Netlify that's event.body, base64-decoded when isBase64Encoded. Mirror of
 * server.js (which used express.raw). License issuance is pull-based via
 * /api/license/issue; this handler revokes paid single-use portal unlocks
 * (session metadata.revoked=1) on refund/dispute. */
const { stripe, json } = require('./common');

/* payment_intent → checkout session id (metadata.checkout_session when present,
 * else lookup — Checkout Sessions created from a PaymentIntent don't back-fill PI metadata). */
async function sessionForPI(piId) {
  try {
    const pi = await stripe().paymentIntents.retrieve(piId);
    if (pi.metadata && pi.metadata.checkout_session) return pi.metadata.checkout_session;
  } catch { /* fall through to list lookup */ }
  try {
    const list = await stripe().checkout.sessions.list({ payment_intent: piId, limit: 1 });
    return (list.data && list.data[0] && list.data[0].id) || null;
  } catch { return null; }
}
async function revokeSessionForPI(piId, why) {
  const target = await sessionForPI(piId);
  if (!target) return;
  try {
    await stripe().checkout.sessions.update(target, { metadata: { revoked: '1' } });
    console.log(`[webhook] ${why} → revoked session=${target}`);
  } catch (e) { console.error(`[webhook] ${why} revoke:`, e.message); }
}

exports.handler = async (event) => {
  const sig = event.headers && (event.headers['stripe-signature'] || event.headers['Stripe-Signature']);
  if (!process.env.STRIPE_WEBHOOK_SECRET) return json(400, { error: 'Webhook secret not configured' });
  let raw = event.body || '';
  if (event.isBase64Encoded) raw = Buffer.from(raw, 'base64').toString('utf8');
  let ev;
  try {
    ev = stripe().webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('[webhook] signature verification failed:', err.message);
    return json(400, { error: `Webhook Error: ${err.message}` });
  }
  try {
    switch (ev.type) {
      case 'checkout.session.completed': {
        const s = ev.data.object;
        console.log(`[webhook] checkout completed session=${s.id} sub=${s.subscription} email=${(s.customer_details && s.customer_details.email) || 'n/a'}`);
        break;
      }
      /* revoked paid single-use unlocks (metadata.revoked=1) are refused by /api/portal/issue */
      case 'charge.refunded': {
        const ch = ev.data.object;
        const piId = typeof ch.payment_intent === 'string' ? ch.payment_intent : (ch.payment_intent && ch.payment_intent.id);
        if (piId) await revokeSessionForPI(piId, 'refund');
        break;
      }
      case 'charge.dispute.created': {
        const dp = ev.data.object;
        const piId = typeof dp.payment_intent === 'string' ? dp.payment_intent : (dp.payment_intent && dp.payment_intent.id);
        if (piId) await revokeSessionForPI(piId, 'dispute');
        break;
      }
      case 'charge.dispute.closed': {
        const dp = ev.data.object;
        if (dp.status !== 'won') break;
        const piId = typeof dp.payment_intent === 'string' ? dp.payment_intent : (dp.payment_intent && dp.payment_intent.id);
        if (piId) {
          const target = await sessionForPI(piId);
          if (target) {
            await stripe().checkout.sessions.update(target, { metadata: { revoked: null } });
            console.log(`[webhook] dispute won → revoked flag cleared session=${target}`);
          }
        }
        break;
      }
      default:
        console.log(`[webhook] ${ev.type} (no action)`);
    }
  } catch (e) {
    console.error('[webhook] handler error:', e.message);
  }
  return json(200, { received: true });
};