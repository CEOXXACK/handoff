/* Handoff backend, serverless: shared helpers for all functions.
 * Ported 1:1 from api/server.js (Express on Render) — same license certs,
 * same Stripe behaviors, same origin allowlist policy. Frontend stays on
 * GitHub Pages, so every route answers CORS + OPTIONS preflight.
 */
'use strict';
const crypto = require('crypto');

/* ---- Stripe (lazy singleton; Managed Payments accounts need the basil API version) ---- */
let stripeClient = null;
function stripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY not configured');
  if (!stripeClient) {
    const Stripe = require('stripe');
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-03-31.basil' });
  }
  return stripeClient;
}

/* ---- config ---- */
function priceId(plan) {
  if (plan === 'yearly') {
    if (!process.env.STRIPE_PRICE_ID_YEARLY) throw new Error('Yearly plan not configured');
    return process.env.STRIPE_PRICE_ID_YEARLY;
  }
  if (!process.env.STRIPE_PRICE_ID) throw new Error('STRIPE_PRICE_ID not configured');
  return process.env.STRIPE_PRICE_ID;
}
const LICENSE_SECRET = process.env.LICENSE_SECRET;
const SITE_URL = (process.env.SITE_URL || '').replace(/\/+$/, '');
const LICENSE_TTL_DAYS = 14;
const SETUP_PRICE = 9900; // $99 one-time done-for-you setup
const PORTAL_PRICE = 249; // $2.49 one-time single-use portal (mark removed from one link)

/* ---- CORS: hardcoded hosts + ALLOWED_ORIGIN list (no wildcard — evil origins
 *      are denied everywhere, including as success_url bases). ---- */
function corsOriginList() {
  const raw = (process.env.ALLOWED_ORIGIN || '').trim();
  const list = (!raw || raw === '*') ? [] : raw.split(',').map(s => s.trim()).filter(Boolean);
  return list.concat([
    'https://ceoxxack.github.io',
    'https://stampofapproval.lol',
    'https://www.stampofapproval.lol',
    'https://handoff-app-6kn.pages.dev',
    'https://handoff2.netlify.app',
  ]);
}
const GITHUB_IO_RE = /^https:\/\/[a-z0-9-]+\.github\.io$/;
function originAllowed(origin) {
  return corsOriginList().includes(origin) || GITHUB_IO_RE.test(origin);
}
function corsHeaders(origin) {
  if (!origin || !originAllowed(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}
function handle(event, fn) {
  const origin = event.headers && event.headers.origin;
  const headers = corsHeaders(origin);
  if (!headers['Access-Control-Allow-Origin'] && origin) {
    console.warn('[cors] request from non-allowlisted origin:', origin);
  }
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }
  return fn();
}

/* ---- responses ---- */
function json(statusCode, obj, extraHeaders) {
  return { statusCode, headers: Object.assign({ 'Content-Type': 'application/json' }, extraHeaders), body: JSON.stringify(obj) };
}
const ok = (obj, h) => json(200, obj, h);
const fail = (statusCode, error, h) => json(statusCode, { error }, h);

/* ---- request body (Netlify event shape) ---- */
function body(event) {
  try {
    if (!event.body) return {};
    const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
    return JSON.parse(raw);
  } catch { return {}; }
}

/* ---- success_url base: Origin header first, then body.base (allowlisted), then SITE_URL.
 *      Exact port of the Express logic (blocks open redirects via the origin allowlist). ---- */
function resolveBase(event, reqBody) {
  let base = ((event.headers && event.headers.origin) || '').replace(/\/+$/, '');
  if (!base) base = SITE_URL || '';
  const bodyBase = reqBody && typeof reqBody.base === 'string' ? reqBody.base.trim() : '';
  if (bodyBase) {
    try {
      const u = new URL(bodyBase);
      const o = u.origin;
      const isAllowed = originAllowed(o);
      if (isAllowed) base = u.origin + u.pathname.replace(/index\.html$/i, '').replace(/\/+$/, '');
    } catch {}
  }
  return base;
}

/* ---- license certificates: HMAC-signed, 14-day TTL, sub re-checked live at refresh ---- */
const b64u = buf => Buffer.from(buf).toString('base64url');
function licenseSecret() {
  if (!LICENSE_SECRET || LICENSE_SECRET.length < 32) throw new Error('LICENSE_SECRET missing or too short (set 32+ random chars in env)');
  return LICENSE_SECRET;
}
function signLicense(payload) {
  const bodyStr = b64u(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', licenseSecret()).update(bodyStr).digest('base64url');
  return `${bodyStr}.${sig}`;
}
function verifyLicense(lic) {
  if (typeof lic !== 'string' || !lic.includes('.')) return null;
  const [b, sig] = lic.split('.');
  let expect;
  try { expect = crypto.createHmac('sha256', licenseSecret()).update(b).digest('base64url'); } catch { return null; }
  const a = Buffer.from(sig), c = Buffer.from(expect);
  if (a.length !== c.length || !crypto.timingSafeEqual(a, c)) return null;
  try {
    const p = JSON.parse(Buffer.from(b, 'base64url').toString('utf8'));
    if (!p.exp || Date.now() > p.exp) return null;
    return p;
  } catch { return null; }
}
function bearerToken(event) {
  return ((event.headers && event.headers.authorization) || '').replace(/^Bearer\s+/i, '');
}
async function subscriptionActive(subId) {
  const sub = await stripe().subscriptions.retrieve(subId);
  return ['active', 'trialing', 'past_due'].includes(sub.status);
}

function sha256hex(s) {
  return crypto.createHash('sha256').update(String(s), 'utf8').digest('hex');
}

module.exports = {
  priceId, SITE_URL, LICENSE_TTL_DAYS, SETUP_PRICE, PORTAL_PRICE,
  stripe, corsHeaders, handle, json, ok, fail, body, resolveBase,
  licenseSecret, signLicense, verifyLicense, bearerToken, subscriptionActive,
  sha256hex,
};