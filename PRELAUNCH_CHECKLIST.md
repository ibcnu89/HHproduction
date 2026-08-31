# HHproduction Pre-Launch Checklist

**Target Launch Date:** August 1, 2026 (Back-to-School season)
**Current Status:** All systems built, ready for verification

---

## Infrastructure ✅

### Railway Deployment
- [ ] Service running at `https://hhproduction-production.up.railway.app`
- [ ] Health endpoint `/health` returns 200
- [ ] Custom domain configured (if applicable)
- [ ] SSL certificate valid (auto via Railway)

### Database (Neon PostgreSQL)
- [ ] Connection pooling configured
- [ ] Migrations applied (`mrr_snapshots`, `outreach_prospects`, `scheduled_content`, `marketing_spend`, `content_performance`, `outreach_templates`)
- [ ] Backup strategy verified (weekly pg_dump)

### Environment Variables (Railway)
- [ ] `DATABASE_URL` - Neon pooled connection
- [ ] `GEMINI_API_KEY` - Google AI Studio
- [ ] `JWT_SECRET` / `JWT_REFRESH_SECRET` - 64-char random strings
- [ ] `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` - OAuth configured
- [ ] `STRIPE_SECRET_KEY` - Live key
- [ ] `STRIPE_WEBHOOK_SECRET` - From Stripe Dashboard
- [ ] `STRIPE_PRICE_ID` - `price_1TtFrED2UVcHtOLDoTU4YZ2c` ($20/mo)
- [ ] `RESEND_API_KEY` - `re_xxxxxxxxxxxxx` (get from Resend dashboard)
- [ ] `DISCORD_OPS_WEBHOOK` - For ops alerts
- [ ] `APP_URL` - `https://hhproduction-production.up.railway.app`

---

## Stripe Configuration ✅

### Products & Pricing
- [ ] Product: "HomeworkHelper Pro" (prod_UtHaku2ITtZJbU)
- [ ] Price: $20.00/month recurring (price_1TtFrED2UVcHtOLDoTU4YZ2c)
- [ ] Trial period: 7 days (configured in checkout session)

### Webhooks
- [ ] Endpoint: `https://hhproduction-production.up.railway.app/api/billing/webhook`
- [ ] Events selected:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_failed`
- [ ] Signing secret added to Railway env vars
- [ ] Test webhook delivery successful (use Stripe CLI)

### Billing Portal
- [ ] Portal configuration: customer can update payment method, cancel subscription, view invoices
- [ ] Portal URL accessible from app settings page

---

## Core Flows ✅

### Authentication
- [ ] Email/password registration → trial starts
- [ ] Email/password login → cookie set
- [ ] Google OAuth → account link/create → trial starts
- [ ] 401 → refresh → retry pattern working
- [ ] Logout clears cookies
- [ ] Session persists across browser refresh

### Billing
- [ ] `/settings` page shows trial status with countdown
- [ ] "Start Free Trial" → Stripe Checkout → success redirect
- [ ] "Manage Subscription" → Stripe Portal → returns to settings
- [ ] Trial ending email (24h before) → portal link
- [ ] Payment failure email → portal link
- [ ] Webhook updates user record correctly

### Grading
- [ ] Image upload → OCR extraction → grading
- [ ] Custom rubric upload → reuse
- [ ] Batch grading (30 papers)
- [ ] CSV export → gradebook import
- [ ] Standards alignment (IL Learning Standards)

---

## Content & Marketing ✅

### Content Templates (in `/content/scheduled/`)
- [ ] Launch blog post: "How I Cut My Grading Time 80%"
- [ ] Onboarding email Day 0: Welcome + first grade in 5 min
- [ ] Onboarding email Day 2: Custom rubrics
- [ ] Onboarding email Day 3: Batch grading workflow
- [ ] Onboarding email Day 7: Trial ending reminder
- [ ] Social calendar: 30 days of X/LinkedIn/Reddit content

### Outreach Templates (in DB `outreach_templates`)
- [ ] Template v1: "Quick question about your grading workload"
- [ ] Template v2: "Your Tuesday night grading pile"

### Prospect Database (`outreach_prospects`)
- [ ] Schema created with status tracking
- [ ] Indexes on status, next_followup
- [ ] Ready for manual entry or scraping

---

## Monitoring & Ops ✅

### Cron Jobs (defined in `.smtm/projects/hhproduction/crons.json`)
- [ ] Daily health check (6 AM)
- [ ] Stripe webhook verify (every 15 min)
- [ ] MRR snapshot (midnight)
- [ ] Daily outreach batch (Mon-Fri 10 AM)
- [ ] Trial expiry notify (9 AM)
- [ ] Weekly content publish (Mon 9 AM)
- [ ] Weekly SEO rank check (Wed 8 AM)
- [ ] DB backup verify (Sun 3 AM)
- [ ] SSL cert check (1st of month)

### Discord Alerts
- [ ] `DISCORD_OPS_WEBHOOK` configured
- [ ] MRR snapshot daily
- [ ] Outreach batch summary
- [ ] Trial expiry notifications
- [ ] Critical failure alerts

### Database Monitoring
- [ ] MRR snapshots table
- [ ] Marketing spend tracking
- [ ] Content performance tracking

---

## Legal & Compliance ✅

- [ ] Terms of Service at `/terms`
- [ ] Privacy Policy at `/privacy`
- [ ] FERPA/COPPA considerations documented (no student PII stored)
- [ ] Stripe tax configuration (if applicable)
- [ ] Cookie consent banner (if required)

---

## Quality Gates (Tier 2 - Pre-Launch) ✅

Run these before August 1:

### Security Audit
- [ ] `npm audit --audit-level=high` - no critical vulns
- [ ] Secrets scan: no keys in repo
- [ ] CSP headers configured
- [ ] HSTS, X-Frame-Options, Referrer-Policy set
- [ ] Stripe webhook signature verification tested

### Performance Budget
- [ ] Lighthouse CI: LCP < 2.5s, CLS < 0.1, TBT < 200ms
- [ ] Bundle size < 250KB gzipped
- [ ] API p95 < 500ms

### Accessibility (WCAG 2.1 AA)
- [ ] axe-core scan: 0 violations
- [ ] Keyboard navigation: all interactive elements reachable
- [ ] Focus indicators visible
- [ ] Color contrast 4.5:1 text, 3:1 UI
- [ ] Reduced motion respected

### E2E Test Flows (Playwright)
- [ ] Signup → Trial → Grade → Export
- [ ] Login → Settings → Billing → Portal
- [ ] Trial expiry → Payment update → Access restored
- [ ] Batch grade 30 papers → CSV export

---

## Launch Day (August 1) 🚀

### Morning (8 AM)
- [ ] Verify all systems green
- [ ] Post launch announcement (X, LinkedIn, Reddit)
- [ ] Send Day 0 onboarding email to waitlist
- [ ] Activate outreach cron (Mon-Fri 10 AM)

### Day 1 Monitoring
- [ ] Watch trial signups (target: 30)
- [ ] Watch checkout completions (target: 5)
- [ ] Monitor Discord alerts
- [ ] Check Stripe dashboard for failed payments

### Week 1 Targets
- [ ] 100 trial signups
- [ ] 15 paid conversions
- [ ] < 5% trial→paid conversion (early)
- [ ] 0 critical bugs

---

## Post-Launch (Week 2-4)

- [ ] Run `/money-strategy iterate` to benchmark against competitors
- [ ] Optimize onboarding based on drop-off points
- [ ] Add department/team licensing tier
- [ ] Build admin dashboard for support
- [ ] Plan Google Classroom integration

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Founder/Engineer | Skyler | | |
| Ops/Monitoring | (Automated) | | |

**Ready for launch?** ☐ Yes ☐ No — Blockers: _______________