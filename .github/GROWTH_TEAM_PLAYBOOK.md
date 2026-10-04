# Handoff Growth Team Playbook

## Mission

Find repeatable ways to reach people who regularly deliver client work, confirm that Handoff solves a problem they will pay to fix, and build a measurable path toward $3,000/month. This is a target for experiments, not a promised result. Do not scale paid traffic until customer fit, activation, and unit economics have evidence behind them.

## Product Facts and Audience Hypothesis

Handoff is a client-delivery portal for studios: deliverables, approvals, and payment in one link. Free supports 2 active portals and 5 deliverables per portal; Pro is $15/month; a single-use paid portal is $9. The app is a static frontend on GitHub Pages with a Netlify Functions API. Portal content is designed to stay in the browser.

Initial audience hypothesis: independent designers, web/design studios, photographers, video creators, and other client-service freelancers who repeatedly send deliverables and chase approvals or payment. This is a hypothesis to compare across segments, not a validated market conclusion.

## What Counts as a Qualified Prospect

A prospect is qualified when discovery confirms most of these signals:

- They personally deliver digital work to paying clients at least several times a month.
- They coordinate deliverables, revisions/approval, and payment across multiple links, messages, or tools.
- This workflow creates a recent, concrete cost: delays, follow-up time, confusion, missed payment, or a poor client experience.
- They can choose or influence the workflow/tool purchase.
- They are willing to try a real portal with a current or upcoming client, or discuss paying if it works.

Curiosity, social engagement, a page visit, or a compliment alone is not purchase intent. Record disqualifying needs too, such as required team seats, file hosting, integrations, or features Handoff does not currently provide.

## Team Responsibilities

- **Web Polish and Growth Lead:** own the customer journey, landing-page clarity, activation friction, and experiment backlog. Coordinate specialist reviews and keep product claims accurate.
- **Paid Growth Strategist:** research channel fit and costs, estimate funnel economics as ranges, design capped tests, and identify when organic/customer discovery is a better next dollar.
- **Handoff Code Expert:** instrument only approved, privacy-conscious measurement; fix implementation friction; protect checkout, licenses, portal privacy, and deployment boundaries; report test evidence.
- **Mobile and Team Coordinator:** test whether mobile demand is real before proposing native apps; coordinate work owners, independent checks, platform research, and decisions.

## First Discovery Sprint

1. Recruit 15 people across three initially distinct segments (five each): independent designers/web creators, photographers/video creators, and small creative studios. These are interview targets, not a statistically representative sample.
2. Ask about the last real client handoff: what was sent, which tools were involved, where approval/payment stalled, what they did next, and what the delay cost. Avoid pitching until the workflow is understood.
3. Show the current product only after the workflow questions. Ask the participant to try a realistic portal task, explain what they expect to happen, and state what would prevent adoption or payment.
4. Log segment, workflow frequency, existing workaround, pain evidence, role in purchase, product-fit gaps, adoption intent, and follow-up permission. Do not collect client files or sensitive data.
5. Review the evidence together. Choose one segment/problem to focus the landing page and one low-cost channel experiment. If fewer than half of a segment report the target pain as frequent and costly, do not call it validated; revise the hypothesis and run another small batch.

### Interview Invitation

Use a personal introduction or a community's approved research channel. Personalize the role/context; do not bulk-send or scrape contacts.

> Hi [name] — I'm researching how independent [role] deliver finished work and collect client approvals. Could I ask you about your most recent handoff in a 15-minute conversation? This is research, not a sales call; I want to understand the current workflow and where it gets frustrating. I can show you the current Handoff product at the end if useful. No client files or sensitive information needed. Would [time option] work?

If they decline, thank them and stop. Ask separately before recording, quoting, or following up. Never present an interviewee as a customer or testimonial without explicit permission.

### Minimal Prospect Log

Track only what is needed to learn and follow up with permission: segment, source/context, date, role in purchase, handoff frequency, current workaround, recent pain/cost, critical missing requirement, trial commitment/date, permission to follow up, and next owner/action. Keep names/contact details only when needed for a consented follow-up; do not add client data or sensitive personal information.

## Decision and Accuracy Checks

Every proposed experiment must include:

- **Hypothesis:** a falsifiable audience/message/channel claim.
- **Evidence:** source or observed customer statements, with dates and sample size.
- **Cost cap:** maximum cash spend and owner approval before any paid commitment.
- **Measurement:** one primary outcome and a privacy-respecting attribution method.
- **Decision rule:** pre-set continue, revise, or stop threshold.
- **Risks:** product gaps, sample bias, platform policy, privacy, or misleading claims.
- **Independent check:** a second relevant specialist verifies calculations, copy claims, and acceptance criteria before launch.

Do not treat impressions, likes, or unqualified signups as success. Early primary outcomes should be qualified conversations, completed first portal, client-open/approval behavior where measured lawfully, and paid conversion. Report denominators and time window.

## Revenue Math

If the target means $3,000 in monthly recurring revenue from Pro alone, the simple steady-state requirement is 200 active subscribers at $15/month before churn, fees, taxes, refunds, and discounts. The $9 one-time portal unlock contributes one-time revenue, not MRR. Always label which target is being modeled and show churn and acquisition assumptions separately.

## Team Handoff Format

Use a short handoff with: **Question / Context / Deliverable / Evidence required / Constraints / Owner / Acceptance check**. Return decisions as **Finding / Evidence / Confidence / Impact / Recommended owner / Next action / Open question**. If specialists disagree, show the disagreement and what test would resolve it; never manufacture consensus.

## Guardrails

- No guaranteed revenue claims, fabricated customer evidence, fake testimonials, spam, scraped personal data, or uncapped advertising.
- Do not change pricing, payment flows, production credentials, tracking behavior, or privacy claims without explicit owner approval.
- Do not recommend a native Android/iOS build without evidence of a mobile-specific unmet need and an approved maintenance budget.
- Check `DEPLOY_VALUES.md` before release advice; frontend and API deployments follow different paths, as documented there.
