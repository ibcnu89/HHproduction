# Cron Job Classification — HomeworkHelper Mission

**Date:** 2026-09-01
**Source:** `hermes cronjob list` (7 paused jobs) + GH Actions workflows
**Rule:** Inspect actual execution. Re-activate ONLY HomeworkHelper / HH-marketing jobs. Leave all others paused.

---

## A. REACTIVATE (HomeworkHelper-relevant)

| Job ID | Name | Schedule | Command | Evidence | Notes |
|--------|------|----------|---------|----------|-------|
| `a68fd9a0e34d` | `sequence-runner-daily` | `0 10 * * 1-5` | `node run-sequences.js` | `scripts/ops/run-sequences.js` queries `outreach_prospects` (the canonical HH lead dataset) and sends via Resend from `skyler@letsmakeai.fun` | This is the **OUTREACH sequencer** — main cold email engine. **Will remain PAUSED** in code; we'll restart via `cronjob run` after template + safety work in Phases 3-6. |
| `cc38021fe2ad` | `teacher-lead-discovery` | `every 360m` | uses `teacher-lead-gen` skill | Skill description confirms: K-12 teacher discovery, output to `~/.hermes/teacher-leads/teachers.csv` (then enriched into `outreach_prospects` via `enrich-nces.py`) | **Safe to reactivate now** — pure discovery, no emails sent. |

### GitHub Actions (auto-fired by GH scheduler — currently firing if not paused at GH level)

| Workflow | Schedule | Status | Notes |
|----------|----------|--------|-------|
| `cron-jobs.yml` | `0 6` health, `0 0` MRR, `*/15` webhook, `0 10 1-5` outreach, `0 9` trial-expiry, `0 9 1` weekly publish, `0 3 0` backup, `0 12 1` SSL | **ACTIVE on GitHub** | Will fire. The outreach/trial-expiry/publish jobs will try to send emails. **We are NOT pausing GH workflow** — this is beyond Hermes cron. The new template guard in `run-sequences.js` will protect Phase 6+ canary. |
| `lifecycle-crons.yml` | `0 8` welcome-drip, `0 9` drip+winback, `0 */2` high-intent, `0 12` daily report, `*/15` signup watcher | **ACTIVE on GitHub** | User-lifecycle (signup drip). Separate from outreach. Sends to `users` table, not `outreach_prospects`. Sends only to actual SIGNED-UP users in their trial window. Safe. |
| `crons.yml` | DISABLED (schedule commented out 2026-08-17) | **no-op** | Already disabled — keep as-is. |

---

## B. LEAVE PAUSED (Unrelated to HomeworkHelper)

| Job ID | Name | Schedule | Command / Script | Evidence |
|--------|------|----------|------------------|----------|
| `914beaeea4ea` | `crypto-lending-yield` | `0 * * * *` | `crypto-lending-monitor.py` | DeFi yield monitoring — entirely separate financial project. |
| `4c48b058f886` | `passive-income-watchdog` | `*/5 * * * *` | `~/.hermes/skills/watchdog.py` | Income-process watchdog for MicroMint/crypto/marketplace bots. Not HH. |
| `7888abe8fe12` | `passive-income-unified` | `*/10 * * * *` | `passive-income-unified.py` | Trends → NFT mint → marketplace → revenue. Not HH. |
| `e86fba0d1562` | `pipeline_collect` | `every 60m` | `~/.hermes/scripts/pipeline_collect.sh` | Reads BTC/ETH price from Coingecko + DeFiLlama TVL. Not HH. |
| `c92ebc7470da` | `marketplace-auto-start` | `*/5 * * * *` | (inline) NFT marketplace on port 8890 | Not HH. |

**All five: NOT related to HH production. They reference the `passive-income`, `crypto-lending`, `micro-mint`, and NFT marketplace systems in `~/.hermes/`. Leave paused.**

---

## C. AMBIGUOUS (none)

No jobs in the current 7-job list are ambiguous. Each was verified by reading the actual `script` / `prompt_preview` field.

---

## Recommended State Actions

### Immediate (Phase 1 step)
1. **Resume `cc38021fe2ad` (`teacher-lead-discovery`)** — pure lead gen, no outbound. Safe.
2. **Keep `a68fd9a0e34d` (`sequence-runner-daily`) paused** at the cron-scheduler level. We will fire it manually with `--dry-run` first, then a canary batch via `cronjob run`, after Phase 5 safety check.

### Defer (out of scope)
- All `passive-income*` / `crypto-lending*` / `marketplace-auto-start` jobs — leave paused indefinitely. They are not part of HH mission.
- `pipeline_collect` — BTC/ETH price tracker. Leave paused.

### Document for later cleanup
- The five unrelated jobs above are documented here. Per mission rules, do not delete during this mission. Listed for a future cleanup pass.

---

## Reactivation Performed (this phase)

- `cc38021fe2ad` `teacher-lead-discovery` — **RESUMED**
- `a68fd9a0e34d` `sequence-runner-daily` — **LEFT PAUSED** (will fire manually after Phases 3-5)
- All other jobs — **LEFT PAUSED**

(Will execute via `cronjob update` after this report is written.)
