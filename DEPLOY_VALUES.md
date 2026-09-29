# Handoff — deploy values (test mode)

Fill-in tracker. Mark each ✅ as you go.

## Pre-filled for you (done via CLI)
- [x] Stripe test price: `price_1UL8EKP11tr0MdT3HWEfXymJ` ($15/mo, "Handoff Pro monthly", product prod_VLptLy2ILYbpgs)
- [x] Stripe webhook endpoint: `we_1UL8EnP11tr0MdT3ThsoxowN` (events: checkout.session.completed, url placeholder)
- [x] Webhook signing secret: `whsec_iPPPrH0RbwdVX3HXGF93FJpCdoETRkvp`
- [x] LICENSE_SECRET generated: `7u9pStOx90ikO19bDrn6jjYKktvEqQplPCAG2m0dFKE`
- [x] Render blueprint pushed (`render.yaml` — price ID pre-set)

## YOUR VALUES (fill in as you deploy)
| What | Where | Value |
|---|---|---|
| Stripe SECRET key (test) | dashboard.sk_test | `sk_test_` ______________________ |
| Render service URL | after step 2 | `https://_____________________.onrender.com` |
| Netlify site URL | after step 3 | `https://_____________________.netlify.app` |
| Final webhook URL | step 4 | set endpoint we_1UL8... → render URL + `/webhook` |

---

## STEP 2 — Render (clicks: ~6)

1. Open https://dashboard.render.com → sign in with GitHub if asked.
2. Click **New +** → **Blueprint**.
3. In "Connect a repository", pick **CEOXXACK/handoff** → **Connect**.
   Render reads `render.yaml` and shows a service called **handoff-api**.
4. It will ask for the 5 `sync: false` values — paste exactly:

   | Prompt (env var) | Paste |
   |---|---|
   | `STRIPE_SECRET_KEY` | your `sk_test_...` from Stripe dashboard → Developers → API keys → Secret key (reveal) |
   | `LICENSE_SECRET` | `7u9pStOx90ikO19bDrn6jjYKktvEqQplPCAG2m0dFKE` |
   | `SITE_URL` | `https://handoff-YOURSITE.netlify.app` *(temporary — fixed in step 3b)* |
   | `ALLOWED_ORIGIN` | same as SITE_URL for now |
   | `STRIPE_WEBHOOK_SECRET` | `whsec_iPPPrH0RbwdVX3HXGF93FJpCdoETRkvp` |

   (STRIPE_PRICE_ID is already baked in.)
5. Click **Apply** (page bottom). Wait ~2 min for "Live".
6. Copy your service URL from the top of the page → write it above as the "Render service URL".
7. Quick check: open `https://<that-url>/healthz` in a browser → should show `{"ok":true,"service":"handoff-api"}`.

## STEP 3 — Netlify (clicks: ~7)

1. Open https://app.netlify.com → **Add new site** → **Import an existing project**.
2. Choose **Deploy with GitHub** → authorize if asked → pick **CEOXXACK/handoff**.
3. Site settings — confirm they match (they should prefill from netlify.toml):
   - **Base directory:** `frontend`
   - **Build command:** `node inject-config.js`
   - **Publish directory:** `frontend`
4. Click **Show advanced** → **New variable**:
   - Key: `BACKEND_URL`
   - Value: `https://<your-render-url>.onrender.com` (from step 2.6 — no trailing slash)
5. **Deploy** → wait for "Published" (~1 min).
6. Note your URL: `https://<something>.netlify.app`.

### 3b — Point Render + webhook at the real Netlify URL (important!)

7. Render dashboard → your service → **Environment** → edit two vars:
   - `SITE_URL` → `https://<your-netlify>.netlify.app`
   - `ALLOWED_ORIGIN` → same
   → **Save changes** (auto-redeploys).
8. Stripe dashboard → **Developers → Webhooks** → click endpoint `we_1UL8EnP11tr0MdT3ThsoxowN` → **Update details** → URL:
   - `https://<your-render-url>.onrender.com/webhook`
   → Save. (Signing secret stays the same — no Render change needed.)

## STEP 4 — Test the whole thing (test mode)

1. Open your Netlify URL.
2. Click **Go Pro** (or Upgrade → Continue to secure checkout).
3. Stripe checkout page → card `4242 4242 4242 4242`, any future expiry, any CVC, any email → **Subscribe**.
4. You should land back on your Netlify URL with the plan chip showing **Pro plan**.
   - If it doesn't: Render → Logs tab should show `[license-issue] sub=... email=...`. Paste any error you see into chat.
5. Settings → **Manage subscription** → Stripe billing portal opens → **Cancel subscription** → back to the app, in ≤ a few minutes/next refresh the chip returns to Free.
6. Bonus: Render → Logs will show `[webhook] checkout.session.completed` lines.

## STEP 5 — Go live (when you're ready to charge real cards)

1. Stripe dashboard → toggle **Test mode OFF**.
2. I redo the test-mode steps in live mode from the CLI: create live price + live webhook endpoints (`stripe keys` can't mint the live `sk_live_` — that one you paste into Render yourself).
3. Render → Environment → swap three values:
   - `STRIPE_SECRET_KEY` → `sk_live_...`
   - `STRIPE_PRICE_ID` → new live price id
   - `STRIPE_WEBHOOK_SECRET` → new live whsec
   → Save (redeploys). Netlify needs no change.
4. Real card test: subscribe with your own card, refund yourself in the dashboard, cancel the sub.
5. `frontend/redirect-stub.html` (realtor repo) — replace `handoff-YOURSITE.netlify.app`
   with the final Netlify URL, then deploy it in the realtor repo so old `/handoff/`
   links forward correctly.

## Troubleshooting quick map

| Symptom | Where to look |
|---|---|
| "Checkout backend unreachable" | Render URL wrong in BACKEND_URL, or free-tier cold start — wait 30s, retry |
| Paid but chip still Free | Render → Logs: look for `[license-issue]` — any error there, paste it |
| "Session not paid" on return | check Render logs; Stripe test cards occasionally need `4000000000003220` (3DS success) instead of 4242 |
| CORS error in browser console | `ALLOWED_ORIGIN` must exactly equal the Netlify origin (https, no slash) |
| /healthz works, /api/checkout 500 | `STRIPE_PRICE_ID` or key invalid — verify in dashboard |