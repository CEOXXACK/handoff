# Deploy Guide — Handoff (own platform)

Same shape as the realtor kit: **`api/` → Render**, **`frontend/` → Netlify**.
Allow ~15 min the first time. Backend must exist before the frontend build
(Netlify needs the Render URL as `BACKEND_URL`).

---

## 1. The repo

Already done by this session: pushed to `github.com/CEOXXACK/handoff`.

---

## 2. Create the Stripe price (test first, live later)

1. https://dashboard.stripe.com → toggle **Test mode** ON (top right).
2. **Product catalog → Add product**
   - Name: `Handoff Pro`
   - Price: **$15 / month**, recurring
   - Copy the `price_...` ID shown on the price row.

---

## 3. Deploy the backend to Render

1. https://render.com → (already signed in with GitHub) → **New + → Web Service** → pick `handoff`.
2. Settings:

   | Field             | Value               |
   |-------------------|---------------------|
   | Name              | `handoff-api`       |
   | Root Directory    | `api`               |
   | Runtime           | `Node`              |
   | Build Command     | `npm install`       |
   | Start Command     | `node server.js`    |
   | Health Check Path | `/healthz`          |
   | Instance Type     | Free                |

3. **Environment** → add:

   | Key                     | Value                                                                 |
   |-------------------------|-----------------------------------------------------------------------|
   | `STRIPE_SECRET_KEY`     | `sk_test_...` (test) — later `sk_live_...`                            |
   | `STRIPE_PRICE_ID`       | `price_...` from step 2                                               |
   | `LICENSE_SECRET`        | any 40+ random chars — generate below                                 |
   | `SITE_URL`              | `https://handoff-YOURNAME.netlify.app` (no trailing slash)            |
   | `STRIPE_WEBHOOK_SECRET` | leave off for now, set in step 4                                      |
   | `ALLOWED_ORIGIN`        | your Netlify URL, same as SITE_URL                                    |

   Generate LICENSE_SECRET in any terminal:
   ```
   node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
   ```
4. **Create Web Service** → wait ~2 min → copy the URL, e.g. `https://handoff-api.onrender.com`.

## 4. Register the Stripe webhook

1. Stripe → **Developers → Webhooks → Add endpoint**
2. URL: `https://handoff-api.onrender.com/webhook`
3. Events: `checkout.session.completed`
4. Add → **Reveal** signing secret → `whsec_...`
5. Render → Environment → set `STRIPE_WEBHOOK_SECRET` → Save (service restarts).

## 5. Deploy the frontend to Netlify

1. https://app.netlify.com → **Add new site → Import an existing project** → pick `handoff`
   (not drag-and-drop this time — it must run the build to inject `BACKEND_URL`).
2. Settings (should prefill from `netlify.toml`; verify):
   - **Base directory:** `frontend`
   - **Build command:** `node inject-config.js`
   - **Publish directory:** `frontend`
3. **Environment variables:**
   - `BACKEND_URL` = `https://handoff-api.onrender.com` (from step 3)
4. Deploy → you get `https://handoff-XXXX.netlify.app`.
5. Put the final URL into Render's `SITE_URL` + `ALLOWED_ORIGIN` and redeploy the API
   (this is what makes after-payment redirects land on the app).

## 6. End-to-end test (test mode)

1. Open the Netlify URL → **Go Pro** → Stripe hosted checkout.
2. Card `4242 4242 4242 4242`, any future date, any CVC.
3. Return to `/?licensed=1&session_id=...` → plan chip flips to **Pro plan**.
4. Render logs should show `[license-issue] sub=sub_... email=...`.
5. Settings → **Manage subscription** opens the Stripe portal.
6. Cancel the subscription in the portal → within 14 days (or immediately on
   next refresh if canceled), the app drops back to Free.

Optional webhook check (needs Stripe CLI):
```
stripe listen --forward-to https://handoff-api.onrender.com/webhook
```

## 7. Going live

1. Stripe → toggle **Test mode** OFF → repeat steps 2–4 in live mode
   (new price, new webhook, live key).
2. Render env: swap `STRIPE_SECRET_KEY` → `sk_live_...`, `STRIPE_PRICE_ID` → live price,
   `STRIPE_WEBHOOK_SECRET` → live webhook secret.
3. Redeploy. Netlify needs no change (checkout session URLs are created server-side).

## 8. Old realtor-site path

`frontend/redirect-stub.html` is deployed in the realtor repo as
`frontend/handoff/index.html` after this platform goes live — it forwards
`/handoff/` visitors (including shared portal links with `#p=...` data)
to the new domain. Update its target URL to the real domain before deploying it.

---

## Troubleshooting

**Checkout button says "Checkout backend unreachable":** Render URL wrong in `BACKEND_URL`, or API asleep (free tier cold start ~30 s).

**After payment, page doesn't unlock:** Render logs will show `[license-issue]`.
If it shows 401/402, the subscription ID didn't flow — check the price used in the
checkout session matches `STRIPE_PRICE_ID`.

**"Session not paid" on return:** test-mode cards sometimes need the
`000000000000` success token if tax/promo rules block `4242...`. Check Render logs.

**CORS errors in browser console:** `ALLOWED_ORIGIN` must exactly match the
Netlify origin (scheme + host, no trailing slash).