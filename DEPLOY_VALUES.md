# Handoff — deploy values

## FINAL ARCHITECTURE (2026-09-30, post-migration)

| Piece | Where | URL |
|---|---|---|
| Frontend app + landing | **GitHub Pages** (`gh-pages` branch of CEOXXACK/handoff, serves `frontend/` subtree) | `https://ceoxxack.github.io/handoff/` |
| Backend API | Render web service `handoff-api` | `https://handoff-dq64.onrender.com` |
| Health check | `GET /healthz` | → `{"ok":true,"service":"handoff-api"}` |
| Stripe (test mode) | price `price_1UL8EKP11tr0MdT3HWEfXymJ` (Handoff Pro $15/mo) · webhook `we_1UL8EnP11tr0MdT3ThsoxowN` → `…/webhook` | sandbox acct_1U5icFP11tr0MdT3 |
| License cert secret | `LICENSE_SECRET` (Render env) | unchanged at go-live |

Netlify is GONE for Handoff (build minutes exhausted 2026-09-30; the `handoff2` site can be deleted). The old realtor site no longer contains or links any `/handoff/` paths (scrubbed in realtor-launchkit `fbcc85b`).

## Deploying a change

- **Frontend (index.html, config.js, landing):** edit in `frontend/` on `main` → commit → push → **also republish Pages**:
  ```
  git subtree split --prefix=frontend -b gh-pages-tmp
  git push origin gh-pages-tmp:gh-pages
  git branch -D gh-pages-tmp
  ```
- **Backend (api/server.js):** commit + push `main` — Render auto-deploys (~2 min).
- Pages has **no build step**: `frontend/config.js` must stay committed with the `BACKEND_URL` baked in.
- Backend CORS allowlist hardcodes `*.github.io` + `handoff2.netlify.app` + `ALLOWED_ORIGIN` — frontend host changes need no Render edit.
- Checkout `success_url` comes from the app's own posted address (`{base}` payload, origin must be allowlisted) — adding a custom domain needs no backend change, just the allowlist regex already covers `*.github.io`-style origins; for a truly custom domain add it to `ALLOWED_ORIGIN` (comma-separated).

## Render env vars (authoritative list)

`STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `LICENSE_SECRET`, `STRIPE_WEBHOOK_SECRET`, `SITE_URL` (unused if Origin header present — kept as fallback), `ALLOWED_ORIGIN` (fallback; Pages origins hardcoded server-side).

## Go-live (live mode) — do in order

1. Stripe dashboard, test mode OFF:
   - Product catalog → `Handoff Pro` → recurring $15/mo → copy live `price_…`
   - Developers → Webhooks → + endpoint `https://handoff-dq64.onrender.com/webhook`, event `checkout.session.completed` → copy live `whsec_…`
   - Developers → API keys → reveal `sk_live_…`
2. Render → Environment → swap exactly three values: `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET` → Save (auto-redeploy).
3. Smoke test with a REAL card ($15, refund yourself after): Go Pro → real checkout → Pro chip in studio → Manage subscription opens live portal.
4. Optional cleanup: delete `handoff2` Netlify site; cancel old test subscriptions; archive test-mode price/webhook.

## Test-mode quirks worth remembering

- Stripe CLI on this machine is pinned to the SANDBOX and cannot see test-mode (sk_test) sessions — verify backend behavior via direct HTTP or the dashboard, never the CLI.
- `4242 4242 4242 4242` works; occasionally Stripe wants 3DS → use `4000 0000 0000 3220` instead.
- Render free tier sleeps ~30–60 s on cold start; frontend now toasts + retries through it.