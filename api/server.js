'use strict';
/* Handoff platform API — Stripe checkout + license issuance.
 *
 * Stateless by design (Render free tier has an ephemeral disk):
 * - A "license" is an HMAC-signed certificate naming the Stripe
 *   subscription/customer it was minted from.
 * - /api/license/refresh re-checks the subscription live with Stripe
 *   before re-signing, so cancellations/failed payments take effect
 *   within LICENSE_TTL_DAYS.
 * - ?pro=1 is gone: the app unlock happens only after the backend
 *   verifies a real Stripe Checkout session and mints a cert.
 */
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
// Account runs Managed Payments — needs the basil API version, which the
// stripe v22 SDK carries natively (v16 pinned 2024-06-20 and was rejected).
stripe.apiVersion = '2025-03-31.basil';

const app = express();
app.set('trust proxy', 1);

const PORT = process.env.PORT || 3000;
const PRICE_ID = process.env.STRIPE_PRICE_ID; // recurring $15/mo price
const LICENSE_SECRET = process.env.LICENSE_SECRET; // >=32 random chars
const SITE_URL = (process.env.SITE_URL || '').replace(/\/+$/, '');
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
const LICENSE_TTL_DAYS = 14;

if (!process.env.STRIPE_SECRET_KEY) { console.error('FATAL: STRIPE_SECRET_KEY missing'); process.exit(1); }
if (!PRICE_ID) { console.error('FATAL: STRIPE_PRICE_ID missing'); process.exit(1); }
if (!LICENSE_SECRET || LICENSE_SECRET.length < 32) { console.error('FATAL: LICENSE_SECRET missing or too short (use 32+ random chars)'); process.exit(1); }

const corsOrigin = ALLOWED_ORIGIN === '*' ? true : ALLOWED_ORIGIN.split(',').concat(['https://ceoxxack.github.io', /^https:\/\/[a-z0-9-]+\.github\.io$/, 'https://handoff2.netlify.app']);
app.use(cors({ origin: corsOrigin, credentials: false }));

/* ---- webhook needs the raw body; register BEFORE express.json ---- */
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  if (!process.env.STRIPE_WEBHOOK_SECRET) return res.status(400).send('Webhook secret not configured');
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('[webhook] signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object;
        console.log(`[webhook] checkout completed session=${s.id} sub=${s.subscription} email=${(s.customer_details && s.customer_details.email) || 'n/a'}`);
        try {
          if (s.subscription && s.customer) {
            /* mint/refresh the buyer's referral code + sync their own discount */
            refCodeForCust(s.customer).catch(e => console.error('[referral-mint]', e.message));
            syncReferrerDiscount(s.customer, s.subscription).catch(e => console.error('[referral-sync]', e.message));
          }
          const refCode = (s.metadata && s.metadata.ref) || '';
          /* self-referral guard: promotion code metadata.referrer !== this buyer */
          if (refCode && s.customer) {
            const found = await stripe.promotionCodes.list({ code: refCode, active: true, limit: 1 });
            const referrerCust = found.data.length && found.data[0].metadata ? found.data[0].metadata.referrer : '';
            if (referrerCust && referrerCust !== s.customer) {
              const referrerSubs = await stripe.subscriptions.list({ customer: referrerCust, status: 'active', limit: 1 });
              if (referrerSubs.data.length) {
                const referrer = await stripe.customers.retrieve(referrerCust);
                const n = parseInt((referrer.metadata && referrer.metadata.referral_count) || '0', 10) + 1;
                await stripe.customers.update(referrerCust, { metadata: Object.assign({}, referrer.metadata, { referral_count: String(n) }) });
                await syncReferrerDiscount(referrerCust, referrerSubs.data[0].id);
                console.log(`[referral-credit] ${refCode} -> referrer ${referrerCust} now ${n} referrals`);
              }
            } else if (referrerCust === s.customer) {
              console.log(`[referral] self-referral ignored for ${s.customer}`);
            }
          }
        } catch (e) { console.error('[webhook-referral]', e.message); }
        break;
      }
      default:
        console.log(`[webhook] ${event.type} (no action)`);
    }
  } catch (e) {
    console.error('[webhook] handler error:', e.message);
  }
  res.json({ received: true });
});

app.use(express.json());

/* ---------------- helpers ---------------- */
const b64u = buf => Buffer.from(buf).toString('base64url');
function signLicense(payload) {
  const body = b64u(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', LICENSE_SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}
function verifyLicense(lic) {
  if (typeof lic !== 'string' || !lic.includes('.')) return null;
  const [body, sig] = lic.split('.');
  const expect = crypto.createHmac('sha256', LICENSE_SECRET).update(body).digest('base64url');
  const a = Buffer.from(sig), b = Buffer.from(expect);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!p.exp || Date.now() > p.exp) return null;
    return p;
  } catch { return null; }
}
async function subscriptionActive(subId) {
  const sub = await stripe.subscriptions.retrieve(subId);
  return ['active', 'trialing', 'past_due'].includes(sub.status);
}

/* ---------------- referral codes (Stripe-native, stateless) ---------------- */
/* Every Pro subscriber gets a durable personal referral code minted from their
 * Stripe customer id — no database needed; the customer object is the store.
 * Anyone who applies a referrer's code at checkout gets X% off every bill
 * while that code exists; the referrer's discount rate scales with referrals. */
const REF_DISCOUNT_PCT = 20;      // % off for the referred buyer
const REF_TIERS = [[1, 10], [4, 15], [10, 25]]; // [# referrals, % off referrer's own sub]

function refCodeFromCust(custId) {
  const hmac = crypto.createHmac('sha256', LICENSE_SECRET).update('ref:' + custId).digest('base64url');
  return ('REF-' + hmac.replace(/[-_]/g, '').slice(0, 6).toUpperCase());
}
async function refCodeForCust(custId) {
  const customer = await stripe.customers.retrieve(custId);
  const code = refCodeFromCust(custId);
  const existing = (customer.metadata && customer.metadata.referral_code) || '';
  const referrals = parseInt((customer.metadata && customer.metadata.referral_count) || '0', 10);
  const pct = REF_TIERS.filter(t => referrals >= t[0]).reduce((a, t) => t[1], 0);
  if (existing === code) return { code, referrals, pct };
  const promo = await stripe.promotionCodes.create({
    coupon: { percent_off: REF_DISCOUNT_PCT, duration: 'forever', name: 'Handoff referral — ' + code },
    code,
    max_redemptions: REF_TIERS[REF_TIERS.length - 1][0] + 40,
    metadata: { referrer: custId },
  });
  await stripe.customers.update(custId, { metadata: { referral_code: code, referral_count: String(referrals) } });
  return { code: promo.code, referrals, pct };
}
async function refPctFor(custId) {
  try {
    const customer = await stripe.customers.retrieve(custId);
    const referrals = parseInt((customer.metadata && customer.metadata.referral_count) || '0', 10);
    return REF_TIERS.filter(t => referrals >= t[0]).reduce((a, t) => t[1], 0);
  } catch { return 0; }
}

/* Keep the referrer's own subscription discount in sync with their tier.
 * Coupons use deterministic IDs so tiers reuse one coupon per pct. */
async function syncReferrerDiscount(custId, subId) {
  const pct = await refPctFor(custId);
  const sub = await stripe.subscriptions.retrieve(subId);
  const cur = parseInt((sub.metadata && sub.metadata.ref_pct) || '0', 10);
  if (pct === cur) return;
  if (pct === 0) {
    await stripe.subscriptions.update(subId, { discounts: [], metadata: Object.assign({}, sub.metadata, { ref_pct: '0' }) });
    return;
  }
  const couponId = 'ref_self_' + pct;
  try {
    await stripe.coupons.retrieve(couponId);
  } catch {
    await stripe.coupons.create({ id: couponId, percent_off: pct, duration: 'forever', name: 'Handoff referrer — ' + pct + '% off' });
  }
  await stripe.subscriptions.update(subId, { discounts: [{ coupon: couponId }], metadata: Object.assign({}, sub.metadata, { ref_pct: String(pct) }) });
}

/* ---------------- routes ---------------- */
app.get('/healthz', (req, res) => res.json({ ok: true, service: 'handoff-api' }));

/* Create a Stripe Checkout subscription session. */
app.post('/api/checkout', async (req, res) => {
  try {
    const origin = (req.headers.origin || '').replace(/\/+$/, '');
    let base = origin || SITE_URL || '';
    const bodyBase = req.body && typeof req.body.base === 'string' ? req.body.base.trim() : '';
    if (bodyBase) {
      try {
        const u = new URL(bodyBase);
        const isAllowed = (o) => {
          if (ALLOWED_ORIGIN === '*') return true;
          if (ALLOWED_ORIGIN.split(',').map(s => s.trim()).includes(o)) return true;
          if (/^https:\/\/[a-z0-9-]+\.github\.io$/.test(o)) return true;
          if (o === 'https://handoff2.netlify.app') return true;
          return false;
        };
        if (isAllowed(u.origin)) base = u.origin + u.pathname.replace(/index\.html$/i, '').replace(/\/+$/, '');
      } catch {}
    }
    if (!base) return res.status(400).json({ error: 'No SITE_URL and no Origin header' });
    const email = (req.body && typeof req.body.email === 'string' && req.body.email.includes('@')) ? req.body.email.trim() : undefined;
    const refCode = (req.body && typeof req.body.ref === 'string') ? req.body.ref.trim().slice(0, 40) : (req.query.ref || '').trim().slice(0, 40);
    let discount;
    if (refCode) {
      try {
        const found = await stripe.promotionCodes.list({ code: refCode, active: true, limit: 1 });
        if (found.data.length) {
          discount = [{ promotion_code: found.data[0].id }];
          console.log(`[create-checkout] referral code ${refCode} -> promo ${found.data[0].id} (referrer ${found.data[0].metadata && found.data[0].metadata.referrer || 'n/a'})`);
        } else {
          console.log(`[create-checkout] referral code ${refCode} not found/inactive — ignoring`);
        }
      } catch (e) { console.error('[create-checkout] ref lookup failed:', e.message); }
    }
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: PRICE_ID, quantity: 1 }],
      success_url: `${base}/?licensed=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/?canceled=1`,
      customer_email: email,
      allow_promotion_codes: true,
      ...(discount ? { discounts: discount, allow_promotion_codes: false } : {}),
      metadata: refCode ? { ref: refCode } : {},
    });
    console.log(`[create-checkout] session=${session.id} email=${email || 'n/a'}`);
    res.json({ url: session.url });
  } catch (e) {
    console.error('[create-checkout]', e.message);
    res.status(500).json({ error: 'Could not start checkout' });
  }
});

/* One-time "Done-for-you setup" upsell checkout — inline payment, no price object needed. */
const SETUP_PRICE = 9900; // $99.00
app.post('/api/checkout/setup', async (req, res) => {
  try {
    const origin = (req.headers.origin || '').replace(/\/+$/, '');
    let base = origin || SITE_URL || '';
    const bodyBase = req.body && typeof req.body.base === 'string' ? req.body.base.trim() : '';
    if (bodyBase) {
      try {
        const u = new URL(bodyBase);
        const isAllowed = (o) => {
          if (ALLOWED_ORIGIN === '*') return true;
          if (ALLOWED_ORIGIN.split(',').map(s => s.trim()).includes(o)) return true;
          if (/^https:\/\/[a-z0-9-]+\.github\.io$/.test(o)) return true;
          if (o === 'https://handoff2.netlify.app') return true;
          return false;
        };
        if (isAllowed(u.origin)) base = u.origin + u.pathname.replace(/index\.html$/i, '').replace(/\/+$/, '');
      } catch {}
    }
    if (!base) return res.status(400).json({ error: 'No SITE_URL and no Origin header' });
    const email = (req.body && typeof req.body.email === 'string' && req.body.email.includes('@')) ? req.body.email.trim() : undefined;
    const biz = (req.body && typeof req.body.biz === 'string') ? req.body.biz.trim().slice(0, 120) : undefined;
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: SETUP_PRICE,
          product_data: {
            name: 'Handoff — Done-for-you setup',
            description: 'We customize Handoff for your business: your logo, colors, and defaults configured for you.',
          },
        },
      }],
      success_url: `${base}/?setup=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/?canceled=1`,
      customer_email: email,
      managed_payments: { enabled: false },
      metadata: biz ? { biz } : {},
    });
    console.log(`[create-setup] session=${session.id} email=${email || 'n/a'} biz=${biz || 'n/a'}`);
    res.json({ url: session.url });
  } catch (e) {
    console.error('[create-setup]', e.message, e.raw && e.raw.message ? '| raw: ' + e.raw.message : '', e.type || '');
    res.status(500).json({ error: 'Could not start setup checkout', detail: e.message });
  }
});

/* Exchange a completed Checkout session for a signed license. */
app.get('/api/license/issue', async (req, res) => {
  const { session_id: sid } = req.query;
  if (!sid) return res.status(400).json({ error: 'session_id required' });
  try {
    const session = await stripe.checkout.sessions.retrieve(sid);
    if (!session || session.payment_status !== 'paid') {
      return res.status(402).json({ error: 'Session not paid' });
    }
    const subId = typeof session.subscription === 'string' ? session.subscription : null;
    if (!subId) return res.status(402).json({ error: 'Session has no subscription' });
    if (!(await subscriptionActive(subId))) {
      return res.status(402).json({ error: 'Subscription not active' });
    }
    const email = (session.customer_details && session.customer_details.email) || '';
    const custId = session.customer || undefined;
    const lic = signLicense({
      v: 1, sub: subId, cust: custId,
      email, iat: Date.now(),
      exp: Date.now() + LICENSE_TTL_DAYS * 864e5,
    });
    console.log(`[license-issue] sub=${subId} email=${email}`);
    if (custId) {
      /* mint their referral code + sync their own referral discount; never block issuance */
      refCodeForCust(custId).catch(e => console.error('[referral-mint]', e.message));
      syncReferrerDiscount(custId, subId).catch(e => console.error('[referral-sync]', e.message));
    }
    res.json({ license: lic, plan: 'pro', ttlDays: LICENSE_TTL_DAYS });
  } catch (e) {
    console.error('[license-issue]', e.message);
    res.status(500).json({ error: 'Verification failed' });
  }
});

/* Re-new an existing license after live Stripe re-check. */
app.get('/api/license/refresh', async (req, res) => {
  const lic = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const payload = verifyLicense(lic);
  if (!payload || !payload.sub) return res.status(401).json({ error: 'invalid license' });
  try {
    if (!(await subscriptionActive(payload.sub))) {
      return res.status(402).json({ error: 'subscription_inactive', plan: 'free' });
    }
    const fresh = signLicense({
      v: 1, sub: payload.sub, cust: payload.cust,
      email: payload.email || '', iat: Date.now(),
      exp: Date.now() + LICENSE_TTL_DAYS * 864e5,
    });
    console.log(`[license-refresh] sub=${payload.sub} ok`);
    res.json({ license: fresh, plan: 'pro', ttlDays: LICENSE_TTL_DAYS });
  } catch (e) {
    console.error('[license-refresh]', e.message);
    res.status(500).json({ error: 'refresh failed' });
  }
});

/* Optionally-signed setup purchase proof: session must be a paid setup session. */
app.get('/api/setup/issue', async (req, res) => {
  const { session_id: sid } = req.query;
  if (!sid) return res.status(400).json({ error: 'session_id required' });
  try {
    const session = await stripe.checkout.sessions.retrieve(sid);
    if (!session || session.payment_status !== 'paid') {
      return res.status(402).json({ error: 'Session not paid' });
    }
    if (!session.amount_total || session.amount_total !== SETUP_PRICE) {
      return res.status(402).json({ error: 'Not a setup session' });
    }
    const email = (session.customer_details && session.customer_details.email) || '';
    const cert = signLicense({
      v: 1, setup: true, sub: 'setup_' + sid, email,
      iat: Date.now(), exp: Date.now() + 3650 * 864e5,
    });
    console.log(`[setup-issue] session=${sid} email=${email}`);
    res.json({ setup: cert });
  } catch (e) {
    console.error('[setup-issue]', e.message);
    res.status(500).json({ error: 'Verification failed' });
  }
});

/* Optional: Stripe billing portal for the subscriber. */
app.post('/api/portal', async (req, res) => {
  try {
    const lic = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const payload = verifyLicense(lic);
    if (!payload || !payload.cust) return res.status(401).json({ error: 'invalid license' });
    const portal = await stripe.billingPortal.sessions.create({
      customer: payload.cust,
      return_url: (SITE_URL || `${req.protocol}://${req.get('host')}`) + '/',
    });
    res.json({ url: portal.url });
  } catch (e) {
    console.error('[portal]', e.message);
    res.status(500).json({ error: 'Could not open portal' });
  }
});

/* The caller's personal referral code + live tier (from their license). */
app.get('/api/referral', async (req, res) => {
  try {
    const lic = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const payload = verifyLicense(lic);
    if (!payload || !payload.sub) return res.status(401).json({ error: 'invalid license' });
    if (!(await subscriptionActive(payload.sub))) return res.status(402).json({ error: 'subscription_inactive', plan: 'free' });
    const custId = payload.cust;
    if (!custId) return res.status(401).json({ error: 'license has no customer' });
    const info = await refCodeForCust(custId);
    res.json(Object.assign({ buyerPct: REF_DISCOUNT_PCT }, info));
  } catch (e) {
    console.error('[referral]', e.message);
    res.status(500).json({ error: 'Could not load referral info' });
  }
});

app.listen(PORT, () => console.log(`handoff-api listening on :${PORT}`));