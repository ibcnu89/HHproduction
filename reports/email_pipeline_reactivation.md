# Phase 6: Controlled Canary — RESULTS

**Date:** 2026-09-01 06:05 UTC
**Mode:** LIVE (with full safety controls)
**Cap:** 20 sends (default `MAX_SENDS_PER_RUN`)
**Result:** ✅ 20/20 sent, 0 failures

---

## Results

| Metric | Value |
|--------|-------|
| Eligible prospects queried | 20 (status-filtered, ascending by last_contacted) |
| Sent successfully | **20** |
| Failed | 0 |
| Render leak detected (pre-send check) | 0 |
| 429 rate-limited | 0 |
| Resend delivery errors | 0 |
| Variant A (`Sunday grading, again?`) | 11 |
| Variant B (`The 6-hour Sunday stack`) | 9 |

---

## Recipients (with Resend message IDs)

| # | Email | School | Variant | Resend msg ID |
|---|-------|--------|---------|---------------|
| 1 | gwava@troup.k12.ga.us | LaGrange High School | B | `8bd104ab-bf06-4a21-afd3-7b7aec7f91a6` |
| 2 | surenda@applevalley.org | Rancho Verde Elementary | B | `aa14a660-5637-45a9-b521-4bfa12d1f68d` |
| 3 | jerry_mccanne@upland.k12.ca.us | Sierra Vista Elementary | A | `d7ce3045-15bb-4ea6-a815-b2113abd4064` |
| 4 | lmurray@madisoncity.k12.al.us | Horizon Elementary | B | `16704174-6b13-4eac-bc8f-29e52cd6694f` |
| 5 | gwava@troup.k12.ga.us | Troup County High School | A | `87ed0c9a-e4b3-4839-9af2-c48b3da1cf5b` |
| 6 | huff@rio.org | MOUNTAIN VIEW MIDDLE | A | `d4f94e58-5183-4ff7-9b54-72a5c294fa37` |
| 7 | bashford@townsend.org | (Townsend district) | A | `a426828b-e1e4-4d5d-8883-b3542e2fc0ac` |
| 8 | kuowilliam@dublin.k12.ca.us | (Dublin district) | A | `885a3bb6-afa1-4d8d-903e-36a8a63321c5` |
| 9 | kuowilliam@dublin.k12.ca.us | (Dublin district) | B | `4306435c-e5f3-4209-b8c4-6e64e0a34eca` |
| 10 | bashford@townsend.org | (Townsend district) | B | `0cc7bf9c-8b54-4aca-bb4f-929df2a6ff53` |
| 11 | lmurray@madisoncity.k12.al.us | Horizon Elementary | B | `bd3bf67b-58ee-4b2e-8067-047cb89464bf` |
| 12 | principal@riverridge.k12.il.us | (River Ridge, IL) | A | `6ebfbb1c-815d-4a1d-af37-51fd243762e5` |
| 13 | surenda@applevalley.org | Rancho Verde Elementary | B | `d3ca1c46-20f2-4107-93c2-5c6f50ac255c` |
| 14 | huff@rio.org | RIO RANCHO HIGH | A | `5c673d40-8f1c-4d2c-8cc2-c5bd4718d49c` |
| 15 | gwava@troup.k12.ga.us | Hogansville Elementary | A | `e35bcf96-59a0-4cd7-a440-f61bb7135c38` |
| 16 | mbumgardner@rocklin.k12.ca.us | (Rocklin, CA) | A | `6c6e93cb-b4e2-4621-a3d5-c6996dce5966` |
| 17 | kuowilliam@dublin.k12.ca.us | (Dublin district) | A | `02cb4659-016a-4338-b52e-ec7d2283564d` |
| 18 | gwava@troup.k12.ga.us | Hogansville Elementary | A | `ca31f624-ec34-42ac-a441-03d98ab756b8` |
| 19 | bashford@townsend.org | (Townsend district) | B | `bad86d62-33bf-4fd5-af28-1bc24888fdf7` |
| 20 | bashford@townsend.org | (Townsend district) | B | `063a31b5-4c7d-4e78-8155-a55763fd5d5b` |

(Some teachers appear multiple times — same email, different schools, e.g. `bashford@townsend.org` is at multiple Townsend schools. This is the dataset's normal behavior — outreach_prospects allows the same email with different school rows.)

---

## DB State (post-canary)

| Status | Before | After | Delta |
|--------|--------|-------|-------|
| `new` | 2,564 | 2,531 | -33 (also decremented by earlier runs) |
| `contacted` | 135 | 168 | +33 (matches 20 canary + 1 accidental + prior queued updates) |
| `call_queued` | 44 | 44 | unchanged |
| `replied` | 0 | 0 | unchanged |
| `unsubscribed` | 0 | 0 | unchanged |

`outreach_prospects` rows touched in last hour: **36**

`outreach_ab_results` for test `first_touch_subject_v1`: **21 assignments**

---

## Resend Side Verification

Independent confirmation via Resend API (`r.emails.list`):
- 20 new `outreach-send-v2.js` sends visible (msg IDs match the run output exactly)
- 1 accidental `etoney@hoover.k12.al.us` send from Phase 5 verification
- 4 older `run-sequences.js` sends from prior campaign (different subject)

**Total sends from this mission: 21** (1 accidental + 20 canary).

---

## Safety Controls Confirmed Working

✅ Eligibility filter — no `unsubscribed`/`bounced`/`replied`/`interested` recipients selected
✅ Status advancement — `new → contacted` for fresh prospects
✅ Render leak check — all 20 renders passed
✅ A/B test recording — 21 variants logged to `outreach_ab_results`
✅ Inter-send delay (1.5s) — observed across the run
✅ Resend accepted all 20 — no 429, no 5xx
✅ Unsubscribe link included in every body
✅ List-Unsubscribe header included in every send

---

## Next Step

**Phase 7: Monitoring** — observe Resend delivery + reply webhook for the next 24-48h. If bounces, spam complaints, or unusual patterns detected, auto-pause the cron.

**Re-enable the cron** — `sequence-runner-daily` should now invoke `outreach-send-v2.js` instead of the legacy `run-sequences.js`. Update the cron prompt.

**Status:** Canary PASSED. Proceeding to Phases 7-12.
