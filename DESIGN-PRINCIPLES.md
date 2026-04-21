# Edify Design Principles

> These principles guide every screen, interaction, and decision in Edify. Our users — kitchen managers, site leads, ops teams — are on their feet, context-switching constantly, and time-poor. The software must work harder than they do.

---

## 1. Fewer Clicks, Less Thinking

**Every unnecessary step is a cost.** Edify users are mid-service, dealing with deliveries, managing teams, and handling real problems. Every extra tap, confirmation screen, or navigation jump is time stolen from their actual job.

- Decisions default to the most likely answer — users confirm or adjust, they don't fill in from blank
- Smart defaults are pre-populated everywhere (Quinn pre-selects allergens, sites, product class, batch sizes)
- Common actions are one tap from where the user already is — no hunting through menus
- Progressive disclosure: show only what's needed now, reveal more only if asked
- Flows complete in the same context they started — no jumping to new pages for sub-tasks

**The test:** Could a harried manager complete this in under 30 seconds without looking up from their phone?

---

## 2. Earn the Habit — Be Easier Than the Workaround

People only adopt new software if it's genuinely easier than what they're already doing (WhatsApp groups, notebooks, spreadsheets). If Edify creates friction, they'll route around it and never come back.

- Every flow must be faster than the manual alternative
- Confirmations replace data entry — tap to agree, only type to override
- The system does the calculation, the user just reviews
- Errors are caught before submission, not after — the software is the expert
- When something would take effort (e.g. looking up a supplier, calculating food cost %) Quinn does it automatically

**The test:** If a user skips Edify for this task, what are they doing instead? Make Edify faster than that.

---

## 3. Conversational Over Transactional

Traditional back-office software is forms-first. Edify is conversation-first. Quinn meets users where they are — in plain language — and translates intent into structured data behind the scenes.

- Quinn asks one question at a time, in natural language
- Choices are presented as tappable options, not typed inputs
- Structured data (recipes, GRNs, production settings) is built up through conversation, not form-filling
- The user always knows what's happening next — Quinn narrates the process
- Confirmation messages summarise what was done in human terms, not system terms

**The test:** Could someone complete a task in Edify the first time with zero training?

---

## 4. Status Is Always Visible

Users shouldn't have to search for the answer to "where are we?" Every screen shows the current state clearly. Ambiguity in operations costs money.

- Coloured status pills (green = matched/complete, amber = needs attention, red = error/dispute) on every list item
- Summary cards always show totals, counts, and completion percentage at a glance
- In-progress actions show a clear stepper or progress indicator
- Notification badges on the sidebar show pending work without navigating in
- The done state is explicitly confirmed (green success banner + summary of what was saved)

**The test:** Can a manager glance at a screen for 3 seconds and know what needs their attention?

---

## 5. Surface the Right Things, Hide the Rest

Information overload is as damaging as information absence. Edify surfaces what matters now and hides complexity behind one more tap.

- The command centre shows today's priorities — not everything
- Detailed settings (allergens, batch multipliers, closing ranges) appear only when users are setting up, not in daily use
- Secondary information (expected vs. received quantities, cost breakdowns) uses visual hierarchy: bold for what matters, muted for context
- Modals and side panels for anything that would distract from the primary task
- Responsive design: mobile shows card view (the essentials), desktop shows table view (the full picture)

**The test:** Is anything on this screen unnecessary for the user's current goal?

---

## 6. Errors Are Expected — Handle Them Gracefully

Operations are messy. Deliveries don't match invoices. Quantities are short. Prices change. The software should anticipate this and make resolution fast, not punishing.

- Discrepancies are highlighted immediately, not buried
- When a match fails, Quinn suggests the most likely fix (e.g. "Link GRN-1245?" for an unmatched invoice line)
- Users are given clear, human choices at decision points — not error codes
- Price variances offer two resolution paths (update system-wide cost vs. accept for this delivery only) — acknowledging that not every variance is permanent
- Approval always shows a "what happens next" summary so users can commit with confidence

**The test:** When something goes wrong, does the user know what to do in under 10 seconds?

---

## 7. Consistent, Learnable Patterns

Once a user learns one pattern in Edify, it should work the same everywhere. Cognitive load drops and speed increases.

- The same card anatomy across every list (status pill, title, metadata, action)
- Pill-based multi-select for choices wherever possible (sites, allergens, categories)
- The same +/− stepper for any numeric quantity (receiving, batch sizes, multipliers)
- Green confirms, amber warns, red alerts — consistent everywhere
- Every flow ends with the same structure: a green success banner + summary card

**The test:** Does a user who knows the recipe flow already understand the production flow?

---

## 8. Respect the Environment

Edify is used in kitchens, at loading docks, and on shop floors — not at a desk. The UI must work in noisy, fast, physically demanding contexts.

- Large tap targets — nothing important smaller than 40×40px
- High contrast text — warm dark brown (`#3A3028`) on white, always readable under bright kitchen lights
- Bold typography for the numbers that matter (quantities, prices, totals)
- Minimal data entry — scanning, tapping, and confirming beats typing
- Mobile-first card views that work one-handed

**The test:** Could someone use this screen with floury hands at arm's reach on a mounted tablet?

---

## Look & Feel Reference

### Colour

| Token | Value | Role |
|---|---|---|
| `--color-accent-active` | `#224444` | Primary actions, selected states, buttons |
| `--color-accent-deep` | `#1a3636` | Quinn, hover on primary |
| `--color-bg-surface` | `#FFFFFF` | Page background |
| `--color-bg-hover` | `#F5F4F2` | Row hover, section headers |
| `--color-text-primary` | `#3A3028` | All primary body text |
| `--color-text-secondary` | `#6B5E55` | Labels, metadata, secondary copy |
| `--color-success` | `#15803D` | Confirmed, matched, approved |
| `--color-warning` | `#92400E` | Needs attention, price variance |
| `--color-error` | `#B91C1C` | Dispute, mismatch, short delivery |

The palette is **warm not cold** — warm whites and warm browns instead of grey tones. This keeps the UI approachable and human, appropriate for food and hospitality.

### Typography

**Plus Jakarta Sans** — geometric sans, slightly humanist. Modern and precise without feeling corporate or clinical. Set with antialiasing for screen clarity.

- **Page titles / totals:** 18–22px, weight 700
- **Card labels:** 13–14px, weight 600
- **Body / secondary:** 12–13px, weight 400
- **Pills / badges / labels:** 10–12px, weight 600–700, uppercase for section headers

### Radius Scale

| Token | Value | Used for |
|---|---|---|
| `--radius-nav` | 16px | Sidebar, large floating cards |
| `--radius-card` | 10px | Content cards, modals |
| `--radius-item` | 9px | List rows, small cards |
| `--radius-badge` | 8px | Status pills, tags |

Generous radii throughout — rounded corners signal approachability and reduce visual harshness.

### Elevation & Depth

- **Sidebar:** `box-shadow: 0 2px 12px rgba(58,48,40,0.10)` — visible lift, warm toned not grey
- **Cards:** `border: 1px solid var(--color-border-subtle)` + subtle shadow — depth without drama
- **Modals:** backdrop blur + shadow — clear modal context without heavy dark overlays
- No heavy drop shadows, no gradients on surfaces — flat but tactile

### Spacing

- Consistent **12px padding/gap** as the base unit at page level
- **14–16px padding** inside cards and list items
- **8px gap** between inline elements (pills, chips, buttons)
- Breathing room is intentional — a crowded screen signals complexity

### Interaction Patterns

| Pattern | When to use |
|---|---|
| **Pill multi-select** | Choosing from a set (sites, allergens, categories) |
| **+/− Stepper** | Any numeric quantity (stock received, batch size) |
| **Confirm / Not now** | Decisions that have a clear default yes |
| **Inline action buttons** | Flowing actions within a chat or card context |
| **Status badge** | Every list item that has a state |
| **Green success banner** | Always at the end of a completed flow |

---

*These principles exist to protect the user's time and lower the barrier to adoption. When in doubt, ask: "Is this easier than what they'd do without us?"*
