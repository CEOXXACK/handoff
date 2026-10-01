# Deploy Guide — Handoff (own platform)

**Superseded 2026-09-30.** This document described the old Render + Netlify-frontend
deployment and the original 2026-08 first deploy. It is kept only for history.

The current architecture, env vars, webhook URL change, and go-live procedure live in
**`DEPLOY_VALUES.md`** (single source of truth).

Current shape: **`frontend/` app → GitHub Pages** (static, free, no credit meter),
**`frontend/netlify/functions/` API → Netlify Functions on the `handoff2` site**
(runtime is not metered by build minutes).