# Handoff

**Send client work in one link.** Client-delivery portal SaaS: studios build a branded
portal (deliverables, approvals, payment), send it as a single URL, track opens and
signoff. Free: 2 active portals / 5 deliverables each. Pro: $15/mo.

## Live

- **App:** https://ceoxxack.github.io/handoff/
- **API:** https://handoff-dq64.onrender.com (health: `/healthz`)
- Payments: Stripe Checkout subscription. License = stateless HMAC cert (14-day TTL,
  re-issued on refresh with a live subscription check → cancellations propagate with no DB).

## Repo

```
api/               Express backend (Render): checkout / license issue+refresh / portal / webhook
frontend/          app (index.html) + marketing landing + committed config.js
DEPLOY_VALUES.md   final URLs, env vars, deploy & go-live procedure
```

- Frontend host = **GitHub Pages** (branch `gh-pages`). `frontend/config.js` carries
  `BACKEND_URL` (committed — Pages has no build step). Republish after frontend edits:
  `git subtree split --prefix=frontend -b gh-pages-tmp && git push origin gh-pages-tmp:gh-pages && git branch -D gh-pages-tmp`
- Backend auto-deploys from `main` (Render blueprint in `render.yaml`).
- Checkout return URL comes from the app's posted base (origin must be in the backend
  allowlist — `*.github.io` covered in code; custom domains go in `ALLOWED_ORIGIN`).

**Why no database:** licenses are HMAC-signed certificates naming the Stripe
subscription; every refresh re-checks the subscription live with Stripe, so
cancellations/failed payments drop the member to Free within the 14-day cert TTL.
Stateless = free Render tier works fine.