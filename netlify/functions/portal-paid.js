/* GET /api/portal/paid?sid=&pc= — live check used when a client opens a paid portal
 * link (which carries the session id as &pid=). Verifies THAT session directly:
 * paid, correct amount, portal_single kind, metadata.pc hash match, not revoked.
 * Soft-fails: anything unverified answers {paid:false} (revocation = mark returns). */
const { ok, fail, handle, stripe, PORTAL_PRICE } = require('./common');

exports.handler = async (event) => handle(event, async () => {
  const q = event.queryStringParameters || {};
  const sid = q.sid || '';
  const pc = (typeof q.pc === 'string' && /^[0-9a-f]{64}$/.test(q.pc)) ? q.pc : '';
  if (!sid || !pc) return fail(400, 'sid and pc required');
  try {
    const session = await stripe().checkout.sessions.retrieve(sid);
    const paid = !!session
      && session.payment_status === 'paid'
      && session.amount_total === PORTAL_PRICE
      && !!session.metadata
      && session.metadata.kind === 'portal_single'
      && session.metadata.pc === pc
      && session.metadata.paidCode === pc
      && session.metadata.revoked !== '1';
    return ok({ paid });
  } catch (e) {
    console.error('[portal-paid]', e.message);
    return ok({ paid: false, err: 1 });
  }
});