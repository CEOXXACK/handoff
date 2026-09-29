# Handoff

Single-file client-delivery portals ("send client work in one link"). This repo is the whole platform:

```
api/         Render backend — Stripe Checkout subscriptions + license issuance
frontend/    Netlify static — the app (index.html) + marketing landing page
DEPLOY.md    exact click-through deploy guide
```

**Product model:** Free plan = 2 active portals × 5 deliverables. Pro $15/mo = unlimited, no Handoff mark, brand colors. Pro unlocks only after a verified Stripe subscription issues a signed license to that browser. Studios who self-host Handoff for their own clients can still point checkout at their own Payment Link (Settings → checkout field) — the platform backend simply isn't used then.

**Why no database:** licenses are HMAC-signed certificates naming the Stripe subscription. Every refresh re-checks the subscription live with Stripe, so cancellations/failed payments drop the member to Free within the 14-day cert TTL. Stateless = free Render tier works fine.