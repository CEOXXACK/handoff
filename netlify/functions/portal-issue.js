/* GET /api/portal/issue?session_id=&pc= — single-use redemption of a paid portal
 * unlock. One-shot via session metadata: the redeeming code is stamped into
 * metadata.paidCode at first redemption; a different code for the same session is
 * rejected. Refunded/disputed payments (metadata.revoked=1, set by the webhook)
 * are refused. Portal contents never travel here — only the code's sha256 (pc). */
const { ok, fail, handle, stripe, sha256hex, PORTAL_PRICE } = require('./common');

exports.handler = async (event) => handle(event, async () => {
  const q = event.queryStringParameters || {};
  const sid = q.session_id;
  const pc = (typeof q.pc === 'string' && /^[0-9a-f]{64}$/.test(q.pc)) ? q.pc : '';
  if (!sid) return fail(400, 'session_id required');
  if (!pc) return fail(400, 'pc required');
  try {
    const session = await stripe().checkout.sessions.retrieve(sid);
    if (!session || session.payment_status !== 'paid') {
      return fail(402, 'Session not paid');
    }
    if (session.metadata && session.metadata.revoked === '1') {
      return fail(403, 'Payment revoked');
    }
    if (!session.amount_total || session.amount_total !== PORTAL_PRICE) {
      return fail(402, 'Not a single-use portal session');
    }
    if (!session.metadata || session.metadata.kind !== 'portal_single') {
      return fail(402, 'Not a single-use portal session');
    }
    /* single use: first redeemer stamps its code (never store the code itself —
     * only its hash, so session metadata can't be abused to reconstruct the link).
     * A failed stamp is fatal: returning ok() would make every later call look like
     * a same-code replay and silently drop the one-shot guarantee. */
    const paidCode = session.metadata.paidCode || '';
    if (paidCode && paidCode !== pc) {
      return fail(409, 'Already redeemed with a different portal');
    }
    if (!paidCode) {
      try {
        await stripe().checkout.sessions.update(sid, { metadata: { kind: 'portal_single', pc, paidCode: pc } });
      } catch (e2) {
        console.error('[portal-issue] stamp failed:', e2.message);
        return fail(500, 'Verification failed');
      }
    }
    console.log(`[portal-issue] session=${sid} pc=${pc.slice(0, 12)}…${paidCode ? ' (replayed, same code)' : ' (first redemption)'}`);
    return ok({ paid: true, pc });
  } catch (e) {
    console.error('[portal-issue]', e.message);
    return fail(500, 'Verification failed');
  }
});