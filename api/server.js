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
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: PRICE_ID, quantity: 1 }],
      success_url: `${base}/?licensed=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/?canceled=1`,
      customer_email: email,
      allow_promotion_codes: true,
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
    const lic = signLicense({
      v: 1, sub: subId, cust: session.customer || undefined,
      email, iat: Date.now(),
      exp: Date.now() + LICENSE_TTL_DAYS * 864e5,
    });
    console.log(`[license-issue] sub=${subId} email=${email}`);
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

app.listen(PORT, () => console.log(`handoff-api listening on :${PORT}`));