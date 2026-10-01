# Handoff — deploy values

## FINAL ARCHITECTURE (2026-09-30, migrated off Render)

| Piece | Where | URL |
|---|---|---|
| Frontend app + landing | **GitHub Pages** (`gh-pages` branch of CEOXXACK/handoff, serves `frontend/` subtree) | `https://ceoxxack.github.io/handoff/` |
| Backend API | **Netlify Functions** on site `handoff2` (base `frontend/`) | `https://handoff2.netlify.app` |
| Health check | `GET /healthz` | → `{"ok":true,"service":"handoff-api (netlify fn)"}` |
| Stripe (test mode) | price `price_1UL8EKP11tr0MdT3HWEfXymJ` (Handoff Pro $15/mo) · update the test webhook endpoint URL to `https://handoff2.netlify.app/webhook` | acct_1U5icFP11tr0MdT3 |
| License cert secret | `LICENSE_SECRET` (Netlify env) | **copy unchanged from Render** — changing it voids every existing cert and silently downgrades all Pro users |

**Why:** Render credits ran out until end of October; Netlify function *runtime*
invocations are not metered by build minutes (the thing that ran out). GitHub Pages is
static-only, so it cannot host the API. The `handoff2` Netlify site was repurposed as
the API host instead of being deleted — it was already in the CORS allowlist.

## Env vars (Netlify site `handoff2`, authoritative list — copy values from Render env)

| Var | Notes |
|---|---|
| `STRIPE_SECRET_KEY` | copy from Render unchanged |
| `STRIPE_PRICE_ID` | copy from Render unchanged |
| `LICENSE_SECRET` | **copy from Render unchanged** — never regenerate |
| `STRIPE_WEBHOOK_SECRET` | from the webhook endpoint (see webhook URL change below) |
| `SITE_URL` | optional fallback; Origin header is normally present |
| `ALLOWED_ORIGIN` | optional; `*.github.io` + `handoff2.netlify.app` are hardcoded in the functions |
| `BACKEND_URL` | optional; if unset, `inject-config.js` regenerates `config.js` with it — set it to `https://handoff2.netlify.app` (or rely on the committed `config.js`, which already has it) |

## Webhook URL change (Stripe dashboard)

Developers → Webhooks → existing endpoint `https://handoff-dq64.onrender.com/webhook`
→ **Update endpoint URL** to `https://handoff2.netlify.app/webhook` (test mode now,
live endpoint again at go-live). Event stays `checkout.session.completed`.

## Deploying a change

- **App (index.html, config.js, landing):** edit in `frontend/` on `main` → commit → push → **also republish Pages**:
  ```
  git subtree split --prefix=frontend -b gh-pages-tmp
  git push origin gh-pages-tmp:gh-pages
  git branch -D gh-pages-tmp
  ```
- **API (frontend/netlify/functions/*):** commit + push `main` — Netlify auto-deploys the functions (~1 min).
- Pages has **no build step**: `frontend/config.js` must stay committed with `BACKEND_URL` baked in
  (Netlify's `inject-config.js` regenerates it from env at deploy; the committed value is the Pages source of truth).

## Go-live (live mode) — do in order

1. Stripe dashboard, test mode OFF:
   - Product catalog → `Handoff Pro` → recurring $15/mo → copy live `price_…`
   - Developers → Webhooks → + endpoint `https://handoff2.netlify.app/webhook`, event `checkout.session.completed` → copy live `whsec_…`
   - Developers → API keys → reveal `sk_live_…`
2. Netlify → `handoff2` site → Environment → swap exactly three values: `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET` → Save → triggers redeploy.
3. Smoke test with a REAL card ($15, refund yourself after): Go Pro → real checkout → Pro chip in studio → Manage subscription opens live portal.
4. Then suspend/delete the Render service `handoff-api`.

## Test-mode quirks worth remembering

- Stripe CLI on this machine is pinned to the SANDBOX and cannot see test-mode (sk_test) sessions — verify backend behavior via direct HTTP or the dashboard, never the CLI.
- `4242 4242 4242 4242` works; occasionally Stripe wants 3DS → use `4000 0000 0000 3220` instead.
- Netlify Functions have no cold-start sleep like Render's free tier; if a function is cold, expect a ~1-2 s spin-up, not a minute.
- Old Render URL `https://handoff-dq64.onrender.com` must be updated nowhere in the app — `frontend/config.js` is the single source of `BACKEND_URL`.

## Verification (2026-09-30)

18/18 harness checks pass (`C:\Users\HP\.qwen\tmp\ho-fn-harness.cjs`) against real
Stripe test mode with a real trial subscription lifecycle: checkout sessions mint,
evil-origin `base` injection blocked, license refresh 200 on active sub / 402 after
cancellation / 401 on tampered cert, portal opens with a real customer license,
webhook validates signed payloads (base64 body) and rejects forged signatures,
CORS preflight honored for allowlisted origins only.