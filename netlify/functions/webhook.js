/* POST /webhook — Stripe webhook. Needs the RAW body for signature verification:
 * on Netlify that's event.body, base64-decoded when isBase64Encoded. Mirror of
 * server.js (which used express.raw). The app is fully stateless — the handler
 * only logs; license issuance is pull-based via /api/license/issue. */
const { stripe, json } = require('./common');

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
      default:
        console.log(`[webhook] ${ev.type} (no action)`);
    }
  } catch (e) {
    console.error('[webhook] handler error:', e.message);
  }
  return json(200, { received: true });
};