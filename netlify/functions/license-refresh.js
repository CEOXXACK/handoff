/* GET /api/license/refresh — re-sign a license after a live Stripe subscription re-check. */
const { ok, fail, handle, bearerToken, verifyLicense, signLicense, subscriptionActive, LICENSE_TTL_DAYS } = require('./common');

exports.handler = async (event) => handle(event, async () => {
  const payload = verifyLicense(bearerToken(event));
  if (!payload || !payload.sub) return fail(401, 'invalid license');
  try {
    if (!(await subscriptionActive(payload.sub))) {
      return fail(402, 'subscription_inactive');
    }
    const fresh = signLicense({
      v: 1, sub: payload.sub, cust: payload.cust,
      email: payload.email || '', iat: Date.now(),
      exp: Date.now() + LICENSE_TTL_DAYS * 864e5,
    });
    console.log(`[license-refresh] sub=${payload.sub} ok`);
    return ok({ license: fresh, plan: 'pro', ttlDays: LICENSE_TTL_DAYS });
  } catch (e) {
    console.error('[license-refresh]', e.message);
    return fail(500, 'refresh failed');
  }
});