/* GET /api/license/issue?session_id= — exchange a paid Checkout session for a license cert. */
const { ok, fail, handle, stripe, signLicense, subscriptionActive, LICENSE_TTL_DAYS } = require('./common');

exports.handler = async (event) => handle(event, async () => {
  const q = event.queryStringParameters || {};
  const sid = q.session_id;
  if (!sid) return fail(400, 'session_id required');
  try {
    const session = await stripe().checkout.sessions.retrieve(sid);
    if (!session || session.payment_status !== 'paid') {
      return fail(402, 'Session not paid');
    }
    const subId = typeof session.subscription === 'string' ? session.subscription : null;
    if (!subId) return fail(402, 'Session has no subscription');
    if (!(await subscriptionActive(subId))) {
      return fail(402, 'Subscription not active');
    }
    const email = (session.customer_details && session.customer_details.email) || '';
    const lic = signLicense({
      v: 1, sub: subId, cust: session.customer || undefined,
      email, iat: Date.now(),
      exp: Date.now() + LICENSE_TTL_DAYS * 864e5,
    });
    console.log(`[license-issue] sub=${subId} email=${email}`);
    return ok({ license: lic, plan: 'pro', ttlDays: LICENSE_TTL_DAYS });
  } catch (e) {
    console.error('[license-issue]', e.message);
    return fail(500, 'Verification failed');
  }
});