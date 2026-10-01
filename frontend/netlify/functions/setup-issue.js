/* GET /api/setup/issue?session_id= — signed proof of a paid $99 setup purchase. */
const { ok, fail, handle, stripe, signLicense } = require('./common');

exports.handler = async (event) => handle(event, async () => {
  const q = event.queryStringParameters || {};
  const sid = q.session_id;
  if (!sid) return fail(400, 'session_id required');
  try {
    const session = await stripe().checkout.sessions.retrieve(sid);
    if (!session || session.payment_status !== 'paid') {
      return fail(402, 'Session not paid');
    }
    if (!session.amount_total || session.amount_total !== SETUP_PRICE) {
      return fail(402, 'Not a setup session');
    }
    const email = (session.customer_details && session.customer_details.email) || '';
    const cert = signLicense({
      v: 1, setup: true, sub: 'setup_' + sid, email,
      iat: Date.now(), exp: Date.now() + 3650 * 864e5,
    });
    console.log(`[setup-issue] session=${sid} email=${email}`);
    return ok({ setup: cert });
  } catch (e) {
    console.error('[setup-issue]', e.message);
    return fail(500, 'Verification failed');
  }
});