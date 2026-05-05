# Invoice Match — Feature Documentation for PRD

## Overview

The Invoice Match area is a three-way matching workflow: **Invoice ↔ GRN (Goods Received Notice) ↔ PO (Purchase Order)**. It allows a finance/ops user to review incoming supplier invoices, resolve variances, and approve payment — which then syncs to Xero and updates ingredient costs.

---

## 1. Invoice List

**What it does:**
Displays all supplier invoices with their current match status.

### Features

- Summary cards at the top: "Auto-matched Today" (count) and "Needs Review" (count)
- Tab filtering: **All Invoices / Needs Review / Approved** — each tab shows a count badge
- Search bar: filter by invoice number or supplier name
- Table columns: Invoice #, Supplier, Date, Total, GRN (linked + suggested), Status badge, View button
- Suggested GRN shown as a sub-label on the GRN column (e.g. "+ GRN-1245 suggested")
- Clicking any row or the View button navigates to the Invoice Match detail view

### Invoice Statuses

| Status | Meaning |
|---|---|
| `Matched` | Auto-matched, no variances found |
| `Variance` | Matched but has price or quantity discrepancies requiring resolution |
| `Approved` | Fully approved, sent to Xero |
| `Parse Failed` | PDF/OCR could not be parsed |
| `Duplicate` | Duplicate invoice number detected |
| `Matching in Progress` | System is still running the match |

### Acceptance Criteria

- Invoices with status `Variance`, `Parse Failed`, or `Duplicate` appear in the "Needs Review" tab
- Count badges on tabs reflect live filtered counts
- Search is case-insensitive and matches on invoice number OR supplier name
- Clicking a row opens the Invoice Match detail view for that invoice
- A suggested GRN (not yet linked) displays in the GRN column as secondary text

---

## 2. Invoice Match Detail View

This is the core three-way matching screen.

### 2a. Header & Approve Button

- Shows invoice number + supplier name as the page title
- Subtitle confirms: "Three-way match: Invoice ↔ GRN(s) ↔ PO"
- "Approve & Sync" button top-right — **disabled** until all variances are resolved (or there are none)
- Back to Invoices link

#### Acceptance Criteria

- "Approve & Sync" is greyed/disabled when any variance is unresolved
- "Approve & Sync" is enabled when: (a) no variances exist, OR (b) all variances have a resolution selected
- Clicking "Approve & Sync" advances to the Approval Confirmation screen — it does not immediately approve

---

### 2b. Summary Cards

Five metric cards displayed in a responsive grid:

| Card | Value Shown | Colour State |
|---|---|---|
| GRN Total | Sum of all linked GRN line totals | Default |
| Invoice Total | Invoice ex-tax total + calculated tax | Default |
| GST / Tax | Total tax calculated from per-line tax rates | Default |
| Variance | Invoice total minus GRN total (with +/− sign) | Green if $0.00, Red if non-zero |
| Items Matched | X / Y lines matched | Green if all matched, Orange if partial |

#### Acceptance Criteria

- Variance card shows red when invoice > GRN total; green when matched at $0.00
- "X unmatched items" appears as sub-label when items have no GRN
- Items Matched card only appears when at least one GRN is linked

---

### 2c. Multi-GRN / Suggested GRN Banner

When an invoice has items not covered by the primary linked GRN, the system checks if a second GRN exists that covers the remaining items.

**Suggest GRN Banner (blue info banner):**
- Shows count of unmatched items
- Lists unmatched items by name and SKU
- Shows the suggested GRN: GRN number, supplier, date received, item count, PO number
- "Link [GRN number]" button — when clicked, adds the GRN to the match

**After linking:**
- Summary cards update to reflect the now-full match
- Green success banner appears: "All items now matched across X GRNs"
- The GRN panel in the split view shows grouped sections per GRN

**Manual review fallback:**
- If no suggested GRN is available and items are still unmatched, a red error banner appears: "X invoice items could not be matched to any linked GRN. Manual review required."

#### Acceptance Criteria

- Suggest banner only shows when: (a) there are unmatched lines AND (b) a suggested GRN exists AND (c) it hasn't been linked yet
- Linking a GRN is additive — previously linked GRNs remain
- After linking, if all items are now matched, the banner transitions to the green success state
- If items remain unmatched after all suggestions are exhausted, the red error banner is shown
- Linking a second GRN must update the GRN Total and Variance summary cards in real time

---

### 2d. Split View Table

The main comparison table. Left side = Supplier Invoice. Right side = toggleable between **GRN** or **PO Prices**.

**Left side (Invoice) columns:**

| Column | Description |
|---|---|
| Description | Item name + SKU |
| Qty | Invoice quantity |
| Price | Unit price |
| Total | Line total |
| Tax | Per-line dropdown: No tax / 5% / 10% / 15% / 20% — defaults to 10% |
| Tax $ | Calculated tax dollar amount for the line |

**Right side — GRN tab:**

| Column | Description |
|---|---|
| Ordered | Expected qty from PO |
| Received | Actual GRN received qty |
| Price | GRN unit price |
| Total | GRN line total |
| Tax $ | Estimated at the matching invoice tax rate |
| (variance badge) | Variance action badge |

**Right side — PO Prices tab:**

| Column | Description |
|---|---|
| Ordered | PO expected qty |
| PO Price | Price as per PO |
| Total | PO line total |
| (variance badge) | Variance action badge |

**Tab toggle:** GRN | PO Prices — switches right-side columns while keeping left side fixed.

**Multi-GRN grouping:** When multiple GRNs are linked, the right side shows a section divider row per GRN with the GRN number, received date, and a "View GRN" link.

**"View GRN" link:** Shown in the panel header when a single GRN is linked. For multi-GRN, each group header has its own View GRN link.

**Unmatched invoice lines (NO GRN rows):**
- Rendered below matched rows with a red `NO GRN` badge on the description
- Right side shows `—` for all GRN/PO columns
- Tax dropdown is still available on these lines

**Footer totals:**
- Invoice subtotal and ex-tax total
- Total tax when any tax rates are applied
- Grand total (incl. tax) row — only shown when tax > $0.00
- GRN total and PO total on the right side

#### Acceptance Criteria

- Tax dropdown defaults to 10% for all lines
- Selecting "No tax" removes the tax amount (shows `—`)
- Tax $ column and GST summary card update in real time when rates change
- Lines with unresolved variances show amber background + left accent bar
- Row highlighting clears once the variance is resolved
- Multi-GRN table shows section group headers only when more than 1 GRN is linked
- Grand total (incl. tax) row is hidden when no tax applies

---

### 2e. Variance Resolution (Inline Expand)

Each line with a variance has a **variance badge** in the last column:

- **Unresolved:** amber pill showing the variance amount (e.g. `+$0.50/unit` or `+2 units`)
- **Resolved:** green pill showing the resolution label (e.g. "Price Updated", "Short Accepted")

Clicking the badge expands an inline panel below the row (animated slide-in).

**The expand panel shows:**
- Item name, variance type badge (Price / Quantity), financial impact (+$X.XX or −$X.XX)
- Detail line: e.g. "PO/GRN: $8.00 → Invoice: $8.50 (+$0.50/unit)" or "GRN: 18 → Invoice claims: 20"
- Resolution option buttons (pill style)
- Close (✕) button

**Price variance resolution options:**

| Option | Effect |
|---|---|
| Accept & Update Cost in Edify | Updates master ingredient cost; cascades to recipe costing and GP% |
| Accept for this delivery | Pays invoice price for this delivery only; master cost unchanged |
| Dispute → Credit Note | Raises a credit note request with the supplier |

**Quantity variance resolution options:**

| Option | Effect |
|---|---|
| Credit Note | Requests a credit for the undelivered quantity |
| Accept Short | Accepts the short delivery |
| Back-order | Marks the remaining quantity as back-ordered |

**After selecting a resolution:**
- The expand panel closes automatically
- The badge changes to green with the resolved label
- The row amber highlight clears
- The badge can be clicked again to reopen and change the resolution

**Variance status banner (below table):**
- Amber: "X of Y variances resolved — click ⚠ on any highlighted row to resolve."
- Green: "All variances resolved. Ready for approval."

#### Acceptance Criteria

- Only one expand panel can be open at a time (opening a new one closes the previous)
- Selecting the currently-selected resolution deselects it (toggle/deselect behaviour)
- The Approve & Sync button must remain disabled until all variances are resolved
- The variance status banner reflects live count as resolutions are selected or deselected
- The resolved badge label must accurately map to the chosen option:
  - "Accept & Update Cost in Edify" → "Price Updated"
  - "Accept for this delivery" → "Accepted"
  - "Dispute → Credit Note" → "Disputed"
  - "Credit Note" → "Credit Note"
  - "Accept Short" → "Short Accepted"
  - "Back-order" → "Back-ordered"

---

## 3. Approval Confirmation Screen

A pre-approval review screen shown before the action is made final. Navigation here does not trigger the approval.

### Sections

**Resolution Summary:**
- Lists every variance with item name, value change, and status badge (resolved / unresolved)

**Linked GRNs** (shown only when more than 1 GRN is linked):
- Cards for each linked GRN: GRN number, item count, PO reference

**What Happens on Approval** (dynamic based on resolutions chosen):
- For each "Accept & Update Cost" resolution: `[Item] master cost updated $X.XX → $X.XX` + "Affects recipes & GP%"
- "Recipe GP% recalculated for affected recipes" (shown if any cost updates exist)
- For each "Accept for this delivery": `[Item] charged at $X.XX for this delivery. Cost stays at $X.XX`
- "Invoice pushed to Xero (account codes mapped)"
- If credit notes exist: "Credit note for $X.XX exported to Xero separately"

**Unmatched items warning** (if any):
- Amber warning box listing each unmatched item with qty × price = total
- Instructs user to confirm delivery was received through another channel before proceeding

**Final warning:**
> Approval is final. Costs update and invoice pushes to Xero. Logged for audit.

**Actions:**
- Back (returns to match screen, all resolution state preserved)
- Approve & Sync (confirms the approval)

### Acceptance Criteria

- Navigating back from confirmation does NOT reset any resolutions
- The "What Happens on Approval" list must be dynamically generated from chosen resolutions — not hardcoded
- Approval is a logged, auditable action
- If unmatched items exist, the warning section must be shown — the user can still proceed but must actively click Approve & Sync (no hard block)
- Approval confirmation screen is only reachable from the match view when canApprove is true

---

## 4. Approved State

Shown after the user confirms approval on the confirmation screen.

### Sections

**Success banner:** Full-width green banner with checkmark, "Invoice Approved", and a summary sentence reflecting what happened (cost updates, delivery-only prices, etc.)

**Approval Summary card:**
- Invoice #, Supplier, Approved By (user name), Xero Status ("Queued for sync"), Credit Notes count + value (if any), Total

**Ingredient Costs Updated card** (only if "Accept & Update Cost" resolutions were used):
- Per item: name, old price → new price, % change badge, number of recipes affected

**Accepted for This Delivery Only card** (only if "Accept for this delivery" resolutions were used):
- Per item: name, charged price, master cost unchanged message

**Actions:**
- Back to Invoices (primary)
- View in Xero (secondary)

### Acceptance Criteria

- "Queued for sync" Xero status reflects the pending sync state (not yet confirmed synced)
- Ingredient Costs Updated card only renders if that resolution type was used
- Delivery-only card only renders if that resolution type was used
- "Recipes affected" count on cost update rows must pull from real recipe linkage data (prototype uses mock values)
- "View in Xero" should deep-link to the specific approved invoice in Xero
- Approved invoice status in the invoice list must update to `Approved` after this flow completes

---

## 5. Data Model

### Key Types

```ts
Invoice {
  id: string
  invoiceNumber: string
  supplier: string
  date: string
  total: number           // ex-tax
  grnNumbers: string[]    // linked GRNs
  suggestedGRN?: string   // system-suggested GRN to link
  status: InvoiceMatchStatus
  lines: InvoiceLine[]
  variances: MatchVariance[]
}

InvoiceLine {
  id: string
  description: string
  sku: string
  qty: number
  unitPrice: number
  lineTotal: number
}

MatchVariance {
  id: string
  itemName: string
  sku: string
  type: 'price' | 'qty'
  invoiceValue: number
  grnValue: number
  poValue: number
  impact: number          // financial impact in $
}

PriceResolution = 'Accept & Update Cost in Edify' | 'Accept for this delivery' | 'Dispute → Credit Note'
QtyResolution   = 'Credit Note' | 'Accept Short' | 'Back-order'
```

### Key Utility Functions (will need real API equivalents)

| Function | Description |
|---|---|
| `getGRNsForInvoice(invoice, extraGRNs[])` | Returns GRN objects for all linked GRN numbers |
| `getSuggestedGRN(invoice)` | Returns a suggested GRN to link based on unmatched items |
| `getUnmatchedInvoiceLines(invoice, extraGRNs[])` | Returns invoice lines with no matching GRN SKU |
| `invoiceGRNTotal(invoice, extraGRNs[])` | Calculates total value from all linked GRN lines |
| `needsReviewCount()` | Count of invoices in Variance, Parse Failed, or Duplicate status |
| `autoMatchedCount()` | Count of invoices in Approved or Matched status |

---

## 6. Out of Scope for Prototype (implied for production)

- PDF parsing / OCR for incoming invoices (`Parse Failed` state is mocked)
- Duplicate detection logic (`Duplicate` state is mocked)
- Actual Xero API sync and deep-linking
- Real-time recipe GP% recalculation triggered by cost updates
- User authentication and approver role permissions
- Audit log storage for approvals
- Back-order management workflow post-approval
- Credit note generation and dispatch to supplier
- Account code mapping for Xero push
