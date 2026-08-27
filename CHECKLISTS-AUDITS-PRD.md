# PRD — Checklist corrective actions, delivery logs, audits & alerts

**Owner:** Nina (Product) · **Status:** Draft for review · **Version:** 0.2 (scoring model changed to plain counting after Ed's review, 27 Aug)
**Notion:** PRD — Checklist corrective actions, delivery logs, audits & alerts (under Product)

> **🎯** This is an outcomes-led PRD. It gives engineering and design the principles the checklist work must hold to, the outcomes it must produce, the concept (a fail becomes an owned, evidenced piece of work), the decided build sequence, and how it reaches customers. What it deliberately leaves open: visual design detail, framework choice, and estimates. Those belong to engineering and design. Every flow described here is working in the prototype (`edify-ai-prototype` → `/checklists`, Fitzroy Espresso demo world), visually aligned to web-v2's `edi-2761-checklist-improvements`.

## 1. Why this exists

Two customers surfaced gaps in checklists that turn out to share one underlying need: **when a check fails, the fix must become a trackable piece of work owned by someone else.**

- **ELR** run a monthly ops checklist completed by one auditor (Haseeb) across ~160 stores ([CUS-55](https://linear.app/edify-systems/issue/CUS-55/allow-the-user-completing-a-checklist-to-assign-a-corrective-action-to)). A "No" answer today captures the auditor's note, but the *fix* belongs to the store — there is no way to hand it over, no evidence trail, and no way to notify only that store's people. Ewa's current setup makes checklists visible to every store, and the alternative is rebuilding the template 160 times.
- **ELR** also log daily delivery temperatures. The temperature field exists (with out-of-range prompting), but the context before it — supplier, product, arrived-in-good-condition — doesn't, and multiple deliveries per day need a repeating, tabular structure.
- **Yolk** (Ryan) want scored brand audits: severity-weighted questions grouped into sections, a pass/fail result with a critical-fail override, an action plan generated from failures, severity-routed email alerts ("a smashed window in Bahrain emails me directly"), and a PDF report to send to the site team.

These are not three features. The corrective-action loop is the foundation; audits and alerts are ways of generating and routing that work. Built separately they would diverge into two action systems and two notification models; built together they are one shape.

## 2. What we're building

One checklist system where every fail produces owned, evidenced work. An audit is not a new product — it is a checklist with scoring switched on. The shape has two sides:

| 📋 The check — the auditor's side | 🔧 The fix — the store's side |
|---|---|
| Where the checklist or audit is completed. A "No" (or an out-of-range reading) requires the completer's **issue summary** and photo, and picks who owns the fix. On audits, a live fail budget ("2 fails · 4 allowed") and a locked pass/fail result. This is the *finding* side. | Where the corrective action lives: assigned to the outlet manager or store account, moved through Open → In progress → Resolved, closed with a comment and photo evidence. An actions view lists everything outstanding. This is the *work* side. |

The principle behind the split: **the person who finds the problem and the person who fixes it are different people with different jobs.** The checklist captures the finding; the action carries the fix — with its own owner, lifecycle and evidence — and the source record isn't closed out until every action on it is resolved.

**Who it serves:**

| Persona | Example | Interaction |
|---|---|---|
| Auditor | Haseeb (ELR facilities/ops) | Completes the monthly checklist per store; writes issue summaries; assigns fixes |
| Store team | Outlet manager / store account | Receives corrective actions; describes the fix; attaches photo evidence |
| Ops manager | Ewa (ELR), area managers | Watches the actions list; reassigns; chases overdue items |
| Brand/franchise lead | Ryan (Yolk) | Receives critical-fail escalations; reads the audit PDF |

The prototype's site roles are **Admin, Manager, Employee**.

## 3. Outcomes we're optimising for

This is the heart of the PRD. Everything below should ladder to these. If a design or build decision doesn't move one of these, question it.

| Outcome | What good looks like | Signal we'd watch |
|---|---|---|
| **Every fail becomes owned work** | A "No" spawns an action with an owner, and the fix comes back with evidence. Nothing found on a checklist dies in a notes field. | Proportion of fails with a resolved action; time from raised to resolved. |
| **One template serves every site** | A checklist is built once and completed per store; nobody duplicates a template per site to control who sees or hears about it. | Templates per customer stays flat as site count grows (ELR: 1 template, not 160). |
| **The right person finds out without opening anything** | A critical fail emails the escalation list immediately; a medium fail reaches the site and area manager; a low fail waits quietly in the actions list. | Time from critical fail to first view by an escalation recipient. |
| **The score is an instrument, not an argument** | Every check counts for one; the score is the share of checks passed. The pass mark translates into a fail budget the builder states in a sentence: "a site can fail up to 4 of these 24 checks and still pass". Anyone can recompute the score standing in the kitchen. The test: a reader can explain the scoring back unprompted. | Zero score disputes; audits completed without support queries about scoring. |
| **The audit produces a defensible record** | A locked result, per-question evidence, and a PDF the brand team can attach to an email — matching what they do manually today. | Reports downloaded/sent per completed audit. |

## 4. Principles (the rules the build must hold to)

1. **A "No" always generates a corrective action.** There is no "no issue" branch. "Yes" closes the question with nothing required.
2. **Two owners, two fields.** The issue summary belongs to the person completing the checklist and is required before submit; the corrective action belongs to the store and is completed later. Never one text box doing both jobs.
3. **Actions are one system.** Checklist corrective actions and audit actions are the same entity with the same lifecycle (Open → In progress → Resolved), the same actions view, and the same resolution requirements. Audit actions additionally carry severity and points lost.
4. **Severity decides consequences, not arithmetic.** Severity routes alerts and drives the critical override; it never changes what a check scores. There are no points and no weights anywhere in the model. If a check feels too important to be one of the misses a site can afford, the answer is marking it Critical, not making it worth more.
5. **An audit is a checklist with scoring on.** One builder, one completion flow, one history. Scoring off = today's behaviour, unchanged.
6. **Critical overrides the arithmetic.** Any failed Critical question fails the audit regardless of percentage, and the result says so plainly ("Failed: 1 critical issue — overrides the score").
7. **Recipients are roles, never addresses.** Alert and notification recipients are severity → role mappings resolved per site at send time. Sites and people change; the mapping doesn't.
8. **Evidence at both ends.** The finding carries the auditor's summary and photo; the resolution carries the fixer's comment and photo. The record is defensible without anyone's memory.
9. **Not closed until the work is done.** A checklist or audit record shows closed out only when every action it raised is resolved.

## 5. The build sequence

Five projects, ordered by a single idea: **build the work loop first, then the things that generate and route the work.** A is the foundation; C and D build on it; B and E are independent of each other.

```
A. Unified corrective actions  ──►  C. Audit scoring  ──►  E. Audit report (PDF)
        │                                  │
        └──────────►  D. Alerts & notification scoping  ◄┘
B. Repeated-entry capture  (independent)
```

### Project A — Unified corrective actions

*Merges ELR's assignable corrective actions (CUS-55) with Yolk's audit action plan. They are the same loop: find the problem, assign the fix, close it in Edify.*

1. A "No" on a question configured for corrective actions opens the two-owner panel: **issue summary** (completer; required before submit; photo supported) and **assign to** (outlet manager of that site or the site's shared store account; default configurable per question — ELR were open on which, the prototype offers both).
2. Each action is a **spawned work item** carrying question text, issue summary, photo, site, source reference, raised-by/at, assignee, and (for audits) severity and points lost.
3. **Lifecycle:** Open → In progress → Resolved. Resolving requires a comment and allows a photo; photo evidence is configurable per question. Reassignment allowed at any point.
4. **Actions view:** one screen listing all actions, filterable by status, site, severity and age — the ops manager's working screen.
5. Source records surface their **closed-out state** (principle 9).

**Done when:** a checklist with two No answers produces two assigned actions, visible in the actions view and on the record; resolving the last one flips the record to closed out; submit is blocked until every fail has an issue summary.

**Prototype:** `correctiveActionsStore.ts` · `CorrectiveActionPanel` in `CompletionFlow.tsx` · `/checklists/actions` · `/checklists/actions/[id]`.

### Project B — Repeated-entry capture (delivery logs)

*ELR daily delivery temperatures. Independent of A.*

1. A new question type, **Repeated entries**: the author defines the fields each entry records (text, yes/no, temperature) — e.g. Supplier, Product, Received in good condition, Temperature °C.
2. One instance holds **many entries per day**; entries collapse to a one-line summary once complete and can be reopened or deleted.
3. **Per-entry conditional prompting:** an over-threshold temperature or a condition "No" opens an inline follow-up (what did you do + optional photo) on that entry only.
4. An entry is complete when all fields are filled and any triggered prompt answered; the question completes when every entry is.

**Done when:** three deliveries logged in one instance, the second at 7.2°C against a 5°C max, demands a follow-up note on that entry alone before submit; history shows every entry's values and notes.

**Prototype:** `GroupField`/`RepeatingRow` in `types.ts` · `RepeatingGroupInput` in `CompletionFlow.tsx` · `GroupFieldsEditor` in the builder · "Daily delivery temperatures" fixture.

### Project C — Audit scoring

*Yolk brand audits. Depends on A: failures raise actions. Decision note (27 Aug): scoring was originally severity-weighted points; Ed couldn't explain the model back and neither could we, so it changed to plain counting. Severity moved from the arithmetic to the consequences.*

**What counts as a check**

1. **"Enable scoring" toggle** at template level (principle 5). Off = today's checklist behaviour, unchanged.
2. A question is a **scored check** if it is Yes/No, or if it is a number/temperature question with at least one numeric greater-than or less-than rule attached. Text, photo, rating and repeated-entry questions are unscored and sit outside the denominator. Follow-up questions are never scored, whatever their type: they gather evidence about a fail, they aren't checks.
3. **Pass or fail, per check.** Yes/No: Yes passes, No fails. Number/temperature: the answer is tested against every threshold rule on the question, and breaching any one fails the check (rules "greater than 5" and "less than 1" mean 5.5 fails, 0.4 fails, 3 passes). An unanswered scored check has simply not passed yet: it holds the score down, but it is not a fail, so it raises no action and spends none of the fail budget.

**The arithmetic**

4. **Score** = checks passed ÷ scored checks, displayed as a rounded percentage. Every check counts for one; there are no weights.
5. **Pass/fail is decided on raw counts, never the rounded display.** A pass needs checksPassed ≥ ⌈checksTotal × passMark ÷ 100⌉ and zero Critical fails. The **fail budget** shown everywhere is the same rule read from the other end: budget = checksTotal − ⌈checksTotal × passMark ÷ 100⌉. Worked example: 24 checks at an 80% mark needs 20 passed, so the budget is 4. The rounding trap this rule avoids: 159 of 200 is 79.5%, which displays as 80%, but must fail because 159 < 160.
6. **Critical override** (principle 6): any failed Critical check fails the audit whatever the counts, and the result says so plainly ("Failed: 1 critical issue — overrides the score"). Critical checks sit outside the fail budget; the budget only ever describes non-critical headroom.
7. **Sections** (Front of house, Food safety, Brand standards…) are display grouping only: each shows passed-of-total, checks without a section fall into an implicit General bucket shown last, and nothing passes or fails per section.

**While completing**

8. The toolbar shows the **live fail budget**, recomputed on every answer: "1 fail · 2 allowed". Green while under budget, amber at exactly the budget, red once over it, and "Critical fail · audit fails" the moment a Critical check fails.
9. Failing a scored check opens the Project A capture: comment required, photo optional, assignee. A threshold breach opens the question's follow-up instead; its answer becomes the action's issue summary.

**At submit**

10. The result is computed once and **stored on the instance**: checks passed and total, rounded percentage, the pass mark it was judged against, critical fail count, pass/fail, per-section counts, and the failed question ids. Editing the template later never changes a stored result; instances still pending always score against the current template.
11. One **action per failed scored question**, carrying its severity. A check with no severity set is treated as Medium everywhere.
12. History and the record show the score badge, pass/fail, section subtotals, and closed-out state.

**Builder rules**

13. Defaults: pass mark 80%, severity Medium. Validation: pass mark between 1 and 100; scoring cannot be saved with zero scored checks; a number/temperature question with no threshold rule is flagged as unscored until one is added.
14. The **fail-budget sentence** re-translates live as the author edits: "10 checks · pass mark 80%: a site can fail up to 2 of these checks and still pass. The 3 Critical checks are the exception: failing any one of them fails the audit, whatever the score." The author never does arithmetic.

**Done when:** the fail-budget sentence re-translates the moment the pass mark or question list changes; 159 passed of 200 at an 80% mark fails despite displaying 80%; an 85% audit with one critical fail is Failed and the same audit with it passed is Passed; a failed audit creates one action per failed question with the correct severity.

**Prototype:** `scoring.ts` · builder scoring section · live score in `CompletionFlow.tsx` · "Brand standards audit" fixture.

### Project D — Alerts & notification scoping

*Merges Yolk's severity-routed alerts with ELR's "only that store's people" requirement — both resolve recipients from role mappings at send time (principle 7).*

1. **Severity routes email:** Critical → immediate email to a configurable escalation list; Medium → the site manager and the area/ops manager for that site; Low → no email, actions list only.
2. Recipients configured **per company as severity → role mappings**; role assignments already link users to sites, so "site manager" resolves per completed instance at send time.
3. **Completion notifications are site-scoped:** completing a checklist at a store notifies that store's assigned people only — one template, no per-store duplication.
4. A **settings screen** shows the severity → role mapping, editable.
5. **Email content:** site, checklist/audit name, failed question, comment, photo, link to the action. The prototype previews content; production wires delivery.

**Done when:** a Critical fail at Richmond emails the escalation roles, a Medium fail emails Richmond's manager and the area manager, a Low fail sends nothing; completing at Fitzroy notifies Fitzroy only, verified with two sites live on one template.

**Prototype:** `alertsStore.ts` · `/checklists/settings/alerts` · alerts summary on the audit result screen.

### Project E — Audit report (PDF)

*Yolk attach reports to email today. Depends on C; presentation over its locked result.*

1. One PDF per completed audit, laid out as the audit reads on screen: every question in order with answer, pass/fail, comment and photo inline.
2. **Header:** site, audit name, auditor, date, overall score, pass/fail. **Summary block up top:** score by section, fails by severity, actions generated.
3. Failed questions visually flagged; critical fails prominent.
4. Downloadable from the completed audit view; attachable/emailable.

**Done when:** the PDF of the fixture audit (70%, failed, 1 critical) matches the on-screen record — same score, same three flagged fails, photos included.

**Prototype:** `/checklists/report/[instanceId]` — print-styled HTML with a Download PDF action; production should render server-side for attachments.

## 6. Data model (as prototyped)

- `CorrectiveAction`: id, source instance/question, site, question text, issue summary + photo, raised by/at, assignee (type + name), status (`open | in_progress | resolved`), resolution note + photo, `severity?`.
- `ChecklistQuestion` gains: `correctiveActionConfig?` (trigger, default assignee, require photo evidence), `severity?`, `sectionId?`, `groupFields?` (repeated entries).
- `ChecklistTemplate` gains: `scoringEnabled?`, `passThresholdPct?` (the pass mark; the UI derives the fail budget from it), `sections?`, notify scope.
- `ChecklistInstance` gains: `scoreResult?` (checks passed/total, %, pass mark, critical fails, passed, section scores, failed question ids) — computed and locked at submit.

## 7. Scope for v1

**In scope to plan for now**

- The unified action entity, lifecycle, resolution flow and actions view (Project A).
- The two-owner corrective panel in completion, with photo evidence both ends.
- Repeated entries with per-entry prompting (Project B).
- Scoring toggle, plain check counting, the live fail-budget translation, sections, locked result with critical override (Project C).
- Severity → role alert mapping, site-scoped completion notifications, and the settings screen (Project D).
- The audit report as a rendered, downloadable artefact (Project E).

**Explicitly out of scope / later**

- A separate audits product or a second action system (principles 3 and 5 — this is the point).
- Free-form email recipient lists; recipients are role mappings only.
- Action SLAs and overdue re-escalation (open question, §9).
- Scheduling changes beyond what checklists do today.

## 8. Rough milestone shape

Directional, not committed. The shape matters more than the dates.

| Phase | Focus | Exit criteria (we move on when…) |
|---|---|---|
| **1: The work loop** | Project A end-to-end, with Project B alongside (independent). ELR's monthly checklist and delivery log both work. | A fail spawns an assigned action; the store resolves it with evidence; the record closes out; a delivery log with an out-of-range entry demands its follow-up. |
| **2: Scoring** | Project C on top of A. The Yolk brand audit runs end-to-end. | A scored audit locks its result at submit, the critical override behaves, and every fail lands in the actions view with its severity. |
| **3: Routing** | Project D. Role-mapping settings, real email delivery, site-scoped completion notifications. | Critical/Medium/Low route as specified at two sites on one template; recipients resolve from roles at send time. |
| **4: The artefact** | Project E. Server-rendered report, downloadable and attachable. | A brand lead sends the PDF of a real audit to a site team without touching engineering. |

## 9. Open questions

| Owner | Question |
|---|---|
| Product | Default assignee — outlet manager vs store account. ELR (Ewa) was open on this; the prototype offers both with outlet manager as default. Confirm before build. |
| Engineering | Email delivery — the prototype previews content only. Sending infrastructure, per-company role-mapping storage, and what happens when a role is unassigned at a site (bounce/ownership rules). |
| Engineering | PDF generation — print-styled HTML (prototype) vs server-rendered PDF. Server-side recommended if reports are emailed automatically. |
| Product + Engineering | Role model — the prototype uses Admin / Manager / Employee; confirm the mapping onto production roles and how "area/ops manager for that site" is derived. |
| Product | Action ageing/SLAs — the actions view filters by age; do overdue actions escalate (e.g. re-alert after N days)? |
| Product | Should scored checks be forced to Required? An optional scored check left unanswered lowers the score without raising an action. Forcing Required removes the ambiguity; the prototype currently allows optional scored checks. |

## 10. Success metrics

**Leading (first weeks)**

- Proportion of failed questions with an action resolved, and median raised → resolved time.
- Critical fails reaching an escalation recipient (email opened/action viewed) within the hour.
- Submit-blocked rate on missing issue summaries (should trend to zero as the pattern is learned).

**Lagging (1–3 months)**

- Templates per customer stays flat as sites grow (ELR: one monthly template, 160 stores).
- Audits closed out (all actions resolved) as a proportion of audits failed.
- Reports downloaded or emailed per completed audit.

---

### Related artefacts

- [CUS-55 — Allow the user completing a checklist to assign a corrective action](https://linear.app/edify-systems/issue/CUS-55/allow-the-user-completing-a-checklist-to-assign-a-corrective-action-to): the originating ELR requirement.
- Prototype: `edify-ai-prototype` → `/checklists` — every flow in this PRD is demonstrable there (Fitzroy Espresso demo world).
- Reference design: web-v2 branch `edi-2761-checklist-improvements` — the prototype's completion flow and builder are visually aligned to it.
