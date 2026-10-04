# Handoff Customer Acquisition Research

**Research date:** 2026-10-01  
**Decision:** Start with founder-led customer discovery and a low-cost organic pilot. Do not scale paid ads yet.

## Recommendation

First test independent web and brand designers who deliver client work repeatedly, already host files elsewhere, and need a single place for delivery notes, approvals, and payment links. This is a product-fit hypothesis, not a validated segment. Recruit through warm introductions, relevant design/freelance communities where participation is permitted, and referrals from current clients. Conduct workflow interviews before pitching; then observe prospects create and send a real portal.

This segment is a better initial test than broad creative targeting because Handoff packages links rather than hosting files and the current product is intentionally lightweight. Larger studios or media teams may require collaboration, revision, storage, or integration features that have not been established as product strengths.

Do not purchase traffic until the team has evidence that the landing promise matches the product, can identify qualified activation, and has a defensible acquisition-cost limit. There is no reliable universal CPC or CAC for these platforms: actual auction prices depend on geography, competition, targeting, creative, and objective. The user has not yet specified a target geography or approved an advertising budget.

## Product and Funnel Facts to Reconcile

- The primary app includes a built-in landing route in `frontend/index.html`; `frontend/landing.html` is a separate static page. Verify which URL is actually distributed and indexed before changing or advertising the marketing page.
- The built-in app landing describes the free tier and $15/month Pro plan. `DEPLOY_VALUES.md` also documents a $9 one-time portal unlock.
- `frontend/index.html` additionally offers a $99 one-time done-for-you setup from the Pro flow, backed by `frontend/netlify/functions/checkout-setup.js`. This offer is not in `README.md` or `DEPLOY_VALUES.md`. Confirm it is currently available and align public copy and support capacity before promoting it.
- The frontend source presents a no-cookies/no-tracking promise. A source search found no obvious analytics or ad-pixel integration in the frontend. Do not silently add third-party tags; begin with an opt-in interview/pilot log or approve privacy-conscious measurement explicitly.
- The free-plan Handoff mark can create a product-led discovery path through client portals. Treat that as a hypothesis; measure portal recipients who voluntarily try the product only after a privacy-respecting measurement plan exists.

## Channel Comparison

| Channel | Fit for first qualified prospects | Cost and control evidence | Recommendation |
| --- | --- | --- | --- |
| Warm referrals and founder-led conversations | High learning value; lets the team screen for recurring client handoffs and observe real behavior | Cash spend can be zero; founder time is the real cost. Avoid scraped lists and unsolicited bulk messages. | Start here. Recruit 15 interviews across three small segments; use permission-based introductions. |
| Design/freelance communities and helpful demos | Good audience context; can surface experienced users and objections | Usually no media cost, but requires sustained useful participation and community-rule compliance. | Participate before promoting. Share a practical client-handoff checklist or demo only where allowed. |
| Partner referrals (design educators, independent consultants, template makers) | Potentially high trust and qualification | Negotiated referral fee or reciprocal value; no known conversion baseline yet. | Interview 3 potential partners after the initial customer interviews; do not promise commissions before unit economics are known. |
| Search content and organic SEO | Good for explicit needs such as client approval, delivery, or handoff templates | Cash cost low; time-to-rank and search volume are unknown. Validate terms in Search Console/Keyword Planner rather than inventing demand. | Publish one useful template/checklist aimed at the validated segment; link to a working demo and free start. |
| Google Search Ads | Potentially high intent if exact query demand exists | Google uses advertiser-set average daily budgets; for most campaigns the daily spending limit is 2x average daily budget and monthly limit is 30.4x. No fixed CPC/CAC is provided by this guidance. | Consider only after keyword demand and landing conversion are checked. If approved, use a tightly scoped, short-duration campaign with a pre-set total cap and monitor account spend. |
| Meta Ads | Broad creative reach; intent is less certain for a narrow B2B workflow | Meta says daily budgets are averages and may fluctuate up to 75% above on some days; weekly spend is bounded at 7x the daily budget. Lifetime budgets are described as total-run caps. | Defer broad prospecting. If tested later, use a lifetime budget and show a concrete portal workflow, not generic SaaS creative. |
| TikTok Ads | Possible fit for short creator workflow demonstrations | TikTok's budget guidance, last updated July 2026, says campaign budgets must exceed $50 and ad-group daily budgets must exceed $20. | Do not use for a tiny validation test. Revisit only if organic demos show audience response and the owner accepts the platform floor. |
| LinkedIn website retargeting | Potentially relevant professional audience, but not a cold-start solution | LinkedIn says website audiences need at least 300 matched member accounts to activate; its Insight Tag is required and audiences build from installation onward. | Defer. Current traffic appears unlikely to meet the threshold, and tag use would conflict with the current no-tracking promise unless reviewed and approved. |

## Two-Week Customer Validation Sprint

### Week 1: Learn the real workflow

1. Recruit 15 interviewees: five independent web/brand designers, five photographers/video creators, and five small creative studios. Treat these as directional convenience samples, not market estimates.
2. Ask about their most recent client delivery: what was delivered, how files and payment were handled, where approval stalled, what follow-up took, and what they did next. Do not lead with a product pitch.
3. After workflow questions, show the actual product and ask the person to create a realistic portal. Observe confusion and missing requirements. Ask whether they would use it for a current client and what would block that decision.
4. Record the last observed behavior, recurring frequency, current workaround, cost of the pain, purchase authority, fit gaps, adoption commitment, and source of the introduction. Do not store client work or sensitive customer data.
5. The web lead and code specialist reconcile the live marketing page, offer/pricing claims, and activation steps. Growth checks interview evidence independently before selecting a segment.

### Week 2: Prove a small behavior loop

1. Choose one segment only if interview notes show repeated, costly handoff friction and a current product fit. A small interview sample is directional; do not call it statistically validated.
2. Invite five qualified participants to use Handoff for a real upcoming handoff, with consent and no fabricated endorsement. Offer hands-on setup only if the $99 service is confirmed and the owner approves capacity.
3. Observe these milestones manually: qualified person reached, first portal created, portal shared, client action completed, return use, and willingness to pay. Report numerator, denominator, dates, and cohort; do not use page views as the success metric.
4. Improve one landing-page message or onboarding friction evidenced by those sessions. Recheck it with a second reviewer and test on mobile and desktop before release.
5. Only then consider one paid channel. Search is the first paid candidate if exact high-intent queries exist; otherwise continue referrals, communities, partner discovery, and useful organic content. Require owner-approved cash cap, one primary outcome, a pre-set stop rule, and a way to attribute the pilot without breaking privacy promises.

## Qualification and Sales Conversation

Ask:

1. “Walk me through the last time you delivered finished work to a client.”
2. “How often do you do that, and what tools or links are involved?”
3. “Where did approval, clarification, or payment slow down last time?”
4. “How much follow-up did it take, and what happened because of the delay?”
5. “Who chooses tools for this workflow, and what would make changing it too risky?”
6. “Would you try this on an upcoming client delivery? What would you need to see first?”

Qualified signal: a paying service provider owns or influences the decision, performs this workflow repeatedly, can describe a recent costly friction, and agrees to a real trial or a concrete follow-up. A compliment, click, or hypothetical “I might use it” is not qualified intent.

## Revenue Scenarios and Guardrails

- $3,000 monthly recurring revenue at $15/month requires 200 active Pro subscribers before churn, discounts, payment fees, taxes, refunds, and support costs.
- 334 $9 one-time portal purchases produce $3,006 of one-time gross revenue in that period; this is not MRR.
- 31 $99 setup purchases produce $3,069 of one-time gross revenue, but each requires service delivery and capacity. This is not MRR and must be confirmed as a current offer.
- Do not set an allowable CAC until retention, gross margin, support burden, refunds, and the intended payback period are known. Use an owner-approved test cap in the meantime, not an invented break-even point.
- Do not commit ad spend, contact prospects, add tracking tags, change prices, or make customer claims without owner authorization.

## Sources

All sources accessed 2026-10-01. Platform costs vary by auction and account; official budget controls below are not cost-per-customer forecasts.

- U.S. Small Business Administration, market research and competitive analysis: <https://www.sba.gov/business-guide/plan-your-business/market-research-competitive-analysis>
- Google Ads Help, average daily budgets and spend limits: <https://support.google.com/google-ads/answer/6385083?hl=en>
- Google Ads Help, setting and changing campaign average daily budgets: <https://support.google.com/google-ads/answer/2375420?hl=en>
- Meta Business Help, campaign/ad-set and daily/lifetime budget behavior: <https://www.facebook.com/business/help/214319341922580>
- TikTok for Business, budget types and minimum budget guidelines (page says updated July 2026): <https://ads.tiktok.com/help/article/budget?lang=en>
- LinkedIn Help, website retargeting setup and 300-member activation threshold: <https://www.linkedin.com/help/lms/answer/a420433>
- LinkedIn Help, matched-audience data and privacy notes: <https://www.linkedin.com/help/lms/answer/a420298>
