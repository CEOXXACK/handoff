# Handoff

**Send client work in one link.** Client-delivery portal SaaS: studios build a branded
portal (deliverables, approvals, payment), send it as a single URL, track opens and
signoff. Free: 2 active portals / 5 deliverables each. Pro: $15/mo.

## Live

- **App:** https://ceoxxack.github.io/handoff/
- **API:** https://handoff2.netlify.app (health: `/healthz`)
- Payments: Stripe Checkout subscription. License = stateless HMAC cert (14-day TTL,
  re-issued on refresh with a live subscription check → cancellations propagate with no DB).

## Repo

```
frontend/                        app (index.html) + marketing landing + committed config.js
frontend/netlify/functions/      the API as 8 Netlify Functions (Stripe ^22.6.2)
netlify.toml                     API host build + clean-path redirects
api/                             frozen Express reference (old Render backend, do not deploy)
DEPLOY_VALUES.md                 final URLs, env vars, deploy & go-live procedure
```

- App host = **GitHub Pages** (branch `gh-pages`, serves the `frontend/` subtree — free,
  no credit meter). `frontend/config.js` carries `BACKEND_URL` (committed — Pages has no
  build step). Republish after frontend edits:
  `git subtree split --prefix=frontend -b gh-pages-tmp && git push origin gh-pages-tmp:gh-pages && git branch -D gh-pages-tmp`
- API host = **Netlify** (`handoff2.netlify.app`, site linked to this repo, base
  `frontend/`). Pushing `main` auto-deploys the functions; they run behind the clean
  paths in `netlify.toml` (`/api/*`, `/webhook`, `/healthz`). Function **runtime
  invocations are not build minutes** — the meter that ran out on 2026-09-30 only
  counts deploys/builds.
- CORS is answered by every function itself (Pages → Netlify is cross-origin): the
  allowlist hardcodes `ceoxxack.github.io` + `*.github.io` pattern + `handoff2.netlify.app`,
  plus `ALLOWED_ORIGIN` for custom domains.
- Checkout `success_url` comes from the app's posted `{base}` (origin must be
  allowlisted — blocks open redirects).

**Why no database:** licenses are HMAC-signed certificates naming the Stripe
subscription; every refresh re-checks the subscription live with Stripe, so
cancellations/ failed payments drop the member to Free within the 14-day cert TTL.
Stateless = serverless works fine, and `LICENSE_SECRET` is the only secret that must
never change (it validates every existing cert).