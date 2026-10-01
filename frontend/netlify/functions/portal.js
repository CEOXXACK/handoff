/* POST /api/portal — Stripe billing portal for the licensed customer. */
const { ok, fail, handle, bearerToken, verifyLicense, stripe, SITE_URL } = require('./common');

exports.handler = async (event) => handle(event, async () => {
  try {
    const payload = verifyLicense(bearerToken(event));
    if (!payload || !payload.cust) return fail(401, 'invalid license');
    const portal = await stripe().billingPortal.sessions.create({
      customer: payload.cust,
      return_url: ((event.headers && event.headers.origin) || SITE_URL || 'https://ceoxxack.github.io/handoff/') + '/',
    });
    return ok({ url: portal.url });
  } catch (e) {
    console.error('[portal]', e.message);
    return fail(500, 'Could not open portal');
  }
});