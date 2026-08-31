# Command Centre flow map: what each flow collects, what it misses, and the contract the AI must hold to

**Owner:** Nina (Product) · **Status:** Working reference for the Command Centre build · **Date:** 30 Aug 2026

This document maps every Command Centre flow in the AI prototype field-by-field against the production forms in web-v2, then states the conversational contract per entity: what the AI must ask, what it may infer with a stated default, and what it offers without forcing. It is the field-level layer under the three Notion build specs, written so Stefan can build the natural-language flows knowing exactly which fields matter, when they block creation, and where the numbers must be visible.

Companion documents in Notion, under [Command Centre](https://app.notion.com/p/edifysoftware/Command-Centre-387c88a034db80f78de6f93b40c2bd80):

- [Build spec: Recipe create & update](https://app.notion.com/p/3bfc88a034db817392f4fe2aefd4e5b7)
- [Build spec: Product create & update](https://app.notion.com/p/3bfc88a034db81b78177c992ad64d62f)
- [Build spec: Supplier create & update, and catalogue ingestion](https://app.notion.com/p/3bfc88a034db81a88439dc8aadffd2a2)
- [Decision note: what we build, in what order (4 Aug)](https://app.notion.com/p/3b3c88a034db80609c16d5de4dcd49dd)

The specs carry the business logic and locked constraints (staged decisions, no auto-apply, dual attribution, undo, allergens always explicitly confirmed). This document carries the fields. Where they touch, the spec wins.

**Sources.** Prototype flows: `components/Feed/Feed.tsx`, `components/Feed/commands/` (registry, parsers, runner, cards), `components/Feed/recipeWizardTemplates.ts`. Prototype manual forms: `app/recipes/intake/manual/page.tsx`, `components/Suppliers/SupplierDrawer.tsx`, `app/suppliers/products/[id]/page.tsx`. Production truth: `edify/web-v2/src/features/recipes/recipe-edit-schema.ts`, `.../suppliers/supplier-form-schema.ts`, `.../products/product-form-schema.ts`, plus the production settings drawer schema at `.../features/production/recipe/schema.ts`.

---

## 1. Flow inventory

Every Command Centre flow that creates or edits data. Routing today is keyword and regex matching in `parsers.ts` plus bespoke detectors in `Feed.tsx`; a real model replaces that in production, but the steps and fields below are the design it must reproduce.

| Flow | Entry phrases (today) | Steps in order | What it writes |
|---|---|---|---|
| **Recipe create** | "Create a recipe", "add avocado toast to the menu", chip, `?flow=recipe` | Greeting → ingredient card (edit qty, add from catalogue, remove) → target food cost % → margin explorer (lock price) → packaging → allergens confirm → sites → save → supplier-link offer → done receipt → optional production walkthrough | Nothing. Receipt only; the recipe never lands in the store. Fixed in the upgraded build (§7) |
| **Recipe edit** | "swap X for Y in Z", "remove X from Z", `/recipe` | Pick recipe → pick action (swap, add, remove) → pick ingredient → new ingredient (name, optional qty and UoM) → summary with scope (all sites or one) | Mutates the recipe's ingredient list in `recipeStore` |
| **Product add or replace** | "add a new product", "replace X with Y", `/product` | Purpose (add vs replace) → new product info (name, supplier pick or new) → optional new-supplier details → pick replaced product (replace only) → pack details (type, qty, cost, unit; currently skippable) → pick recipes → summary (scope, master link opt-in) | Upserts `Product`, optional `Supplier` and `MasterProduct`, mutates chosen recipes |
| **Product from sheet** | Attach a file + "add this product" | Extraction card (name, supplier, category, pack, tax, allergens, master match all pre-filled) → sites multi-select → confirm | Product + recipe links via the extraction mock |
| **New supplier + catalogue** | "new supplier with their catalogue" | Extraction card (supplier details + SKU table, rows editable and removable) → sites → confirm | Supplier + products from the mock sheet |
| **Supplier field edit** | "update Agility lead time to 3 days", `/supplier` | Single card: cut-off time, lead time, minimum order value, delivery days, email, phone | Updates those six `Supplier` fields |
| **Menu** | "take X off the menu", "set X price to £Y" | Single card: 86 or restore, set or adjust price | Recipe dine-in price, availability |
| **Production settings** | "set batch sizes for X" | Single card: batch min and max, shelf life, prep time, carry over, closing cutoff | Recipe production fields |
| **Waste log** | "log 3 muffins as expired" | Single card: product, qty, UoM, reason | Waste entry |
| **Stock count** | "count 12 oat milks" | Single card: item, qty, location | Count entry with expected variance |
| **Site setup** | "set up the new Manchester site" | Pick sites → copy template → team roles → range tiers → production schedule → benches → go live | Sites into the register |
| **POS match check** | Quick action | Suggestion list, per-row apply or skip | Match overrides |
| **Integrity fixes** | "fix wrong recipe costs" | Findings card → batch review → apply with partial failure | Scripted fixes |
| Demo flows (Chagee tea swap, coffee-bean sheet swap, stock-take storage areas) | Scripted phrases | Bespoke card sequences | Scripted demo writes |

Not covered by any create flow today: purchase orders, stocktakes as sessions, par levels, checklists. The checklists PRD owns that area separately.

---

## 2. Recipe: field matrix

Production's recipe form is a one-click create followed by a single edit page (profile, ingredients, packaging, allergens, instructions, pricing sidebar) plus a production settings drawer. Only name is required to exist; publish needs name, category and at least one ingredient.

Key: ✅ collected · ⚙️ defaulted, not surfaced · ➖ not present · 📄 display only

| Field | Production (web-v2) | Prototype manual builder | Command Centre flow (before upgrade) |
|---|---|---|---|
| Name | ✅ required | ✅ required | ⚙️ template match; unknown names fall back to the avocado toast baseline |
| Status | ✅ default Draft | ✅ default Draft | ➖ |
| Product class | ✅ optional | ✅ required to publish | ⚙️ from template, stated in copy |
| Recipe yield + UoM | ✅ optional | ✅ default 1 serving | 📄 badge only, not editable |
| Recipe type (hot/cold) | ✅ drives VAT | ✅ category default | ⚙️ `vatHot` on template |
| Sub-recipe flag | ✅ | ✅ | ➖ |
| Count in stocktake | ✅ | ✅ | ➖ |
| Exclude from COGS | ✅ | ✅ | ➖ |
| Ingredients: source pick | ✅ product, master or sub-recipe, required | ✅ typed refs | ✅ catalogue typeahead on add; template rows carry no ref |
| Ingredients: quantity + UoM | ✅ required | ✅ | ✅ qty editable |
| Ingredients: yield loss % | ✅ default 0 | ➖ | ➖ |
| Ingredients: key ingredient | ✅ via drawer | ✅ | ➖ |
| Bakers % | ✅ toggle | ➖ | ➖ |
| Variable ingredients | ✅ extra or replacement | ✅ variants model | ➖ (swaps are cost suggestions, not stored variants) |
| Packaging lines | ✅ picker, qty, channel flags | ✅ | ✅ include or skip, template options only |
| Allergens | ✅ 14 list | ✅ | ✅ auto-detected then confirmed |
| Instructions | ✅ optional | ✅ optional | ➖ |
| Photo / attachments | ✅ S3 upload | ✅ optional | ➖ (photo exists in the product flow only) |
| Sites | ✅ | ✅ default Fitzroy | ✅ |
| Sale price (base, ex VAT) | ✅ | ➖ | ➖ |
| Margin % | ✅ must be under 100 | ✅ default 70 | ⚙️ implied by target COGS |
| VAT % | ✅ default 20 | ✅ default 20 | ⚙️ 20% hot, 0% cold, never shown as a field |
| Channel GM and SRP (dine-in, takeaway, delivery) | ✅ editable cascade | ✅ three SRPs + commission | 📄 suggested prices shown; only dine-in locked |
| Delivery commission % | ✅ | ✅ | 📄 fixed 30% |
| Live cost display | ✅ ingredient, unit, packaging cost, GM per channel | ✅ PriceCard (costs stubbed to 0 on create) | ✅ margin explorer: line costs, total, COGS ladder, weekly GP projection |
| Tags (AM/PM/VEG) | ✅ production drawer | ✅ | ➖ |
| Production visibility | ✅ per site | ✅ | ➖ |
| Production type (bakery, hot chef) | ✅ | ✅ | ➖ |
| Prep time | ✅ seconds | ✅ | Optional walkthrough only |
| Shelf life value + unit | ✅ stored minutes | ✅ | Optional walkthrough only |
| Batch min / max / multiple | ✅ min and multiple required | ✅ | Optional walkthrough only |
| Allow carry-over | ✅ | ✅ | Optional walkthrough only |
| Recipe category (production) | ✅ drawer only | ✅ | Optional walkthrough only |
| Closing cutoff | ➖ (not in production schema) | ✅ | Optional walkthrough only |
| Production reference, used for | ✅ | ✅ | ➖ |
| POS mapping | Separate POS matching feature | On type, not the form | Separate POS match flow. Correct: keep it out of create |
| Nutrition / dietary flags | Do not exist on recipes | ➖ | ➖. Correct: Nutritics owns nutrition |

**The two findings that matter.**

1. **The flow never saves.** The wizard's receipt says "live in Edify" but nothing is written to `recipeStore`. The manual builder and the flow cannot be compared in the library because only one of them produces a recipe.
2. **Production settings are optional.** The recipe build spec is explicit: production settings are a required, surfaced step on create, never skippable, because silently defaulted settings break the production planner later. Today the walkthrough is a post-save offer the user can decline.

On price visibility: the flow does show cost and margin (the margin explorer is the strongest pricing surface in either prototype), but it prices one channel backwards from a target COGS %. Production prices three channels forwards: margin %, VAT %, target GM and SRP per channel, delivery commission. The upgraded flow keeps the target as the entry point (the spec says target food cost is an input, never an invention) and adds the per-channel read-back so the user sees dine-in, takeaway and delivery prices with GM before saving, the way web-v2's pricing sidebar shows them.

---

## 3. Product: field matrix

Production separates the **master product** (the company's concept of a thing; recipes reference it, stocktakes count it, it carries the base UoM) from the **supplier product** (one supplier's sellable version with pack and price). The build spec requires the entity type stated on every surface because the distinction confuses everyone.

| Field | Production (web-v2) | Prototype product page | Command Centre flow (before upgrade) |
|---|---|---|---|
| Name | ✅ required | ✅ | ✅ |
| Status | ✅ default Available | ✅ | ⚙️ Available |
| Supplier | ✅ (form context) | ✅ | ✅ pick existing or create new |
| Supplier product code | ✅ required, unique per supplier, live check | ✅ | ➖ written as empty string |
| Product class / category | ✅ optional | ✅ | ⚙️ copied from replaced product, or Other |
| Product tags | ✅ | On type, not UI | ➖ |
| Master product link | ✅ optional | ✅ | Opt-in checkbox on replace only |
| Pack type | ✅ required | ✅ Pack or Single | ✅ but the whole pack step is skippable |
| Pack quantity | ✅ required, ≥ 1 | ✅ | ✅ skips to 1 |
| Pack cost | ✅ required | ✅ ex VAT | ✅ skips to 0 |
| Unit cost display | ✅ pack cost ÷ pack qty | ✅ | ➖ |
| VAT rate | ✅ optional 0–100 | ✅ | ➖ 0 or copied silently |
| Single unit type | ✅ required | ✅ Each, kg, L, g, ml | ✅ |
| Volume or weight per unit + UoM | ✅ paired | ✅ | ➖ |
| Alternative UoMs (up to 2) | ✅ | ✅ | ➖ |
| Sites | ✅ default all supplier sites | ✅ | Sheet-import flow only |
| Allergens contains / traces | ✅ two lists | ✅ | Sheet extraction only, never confirmed as a step |
| Nutrition (9 values per 100g) | ✅ optional | ✅ | ➖ |
| Allow split pack | ✅ mutex with force multiples | ✅ | ➖ |
| Force pack multiples | ✅ | ✅ | ➖ |
| Exclude from COGS | ✅ | ✅ | ➖ |
| Use actual for theoretical COGS | ✅ | ✅ | ➖ |
| Photo | ➖ | ➖ | ✅ optional, not persisted to the model |
| Master product create | name required, class, category, UoM required | ✅ | ➖ (master created implicitly on link) |

**The finding that matters: the pack step is skippable.** Skipping writes pack quantity 1 and cost 0. A pack quantity of 1 where a sleeve of 50 was meant is the audit's canonical error (the £3.42 sleeve), and the product build spec calls pack structure the highest-risk field class. The one field group the flow lets you skip is the one that corrupts COGS.

The supplier product code gap matters for a different reason: it is required and uniqueness-checked in production, and it is how invoice lines reconcile back to catalogue items. A product created without one will surface downstream in Dolfin's matching.

---

## 4. Supplier: field matrix

The supplier build spec: the lightest surface in the family, do not over-build it. The contract below keeps creation to two required fields.

| Field | Production (web-v2) | Prototype supplier drawer | Command Centre flow (before upgrade) |
|---|---|---|---|
| Name | ✅ required | ✅ | ✅ |
| Status | ✅ default Active | ✅ | ⚙️ Available |
| Categories | ✅ | ✅ | ⚙️ inherited or Other |
| Contact name | ✅ | ➖ | ➖ |
| Contact phones (up to 4) | ✅ | ✅ one | ✅ edit flow only |
| Order email | ✅ **required**, POs send to it | ✅ one email | Optional in create; edit flow only |
| CC emails (up to 25) | ✅ | ➖ | ➖ |
| Accounts emails (up to 4) | ✅ credit requests | ➖ | ➖ |
| Send order to email / API + URL | ✅ | ➖ | ➖ |
| Minimum order value | ✅ | ✅ | ✅ edit flow only |
| Auto-update product prices | ✅ | ➖ | ➖ |
| Sites | ✅ confirm if empty | ✅ | ⚙️ inherited or empty |
| Company account number | ✅ | ➖ | ➖ |
| Site account numbers | ✅ | ➖ | ➖ |
| Cut-off times: per-delivery-day grid (available, order day, order time) | ✅ | Single cut-off time + delivery days | Single cut-off + delivery days, edit flow only |
| Site cut-off exceptions | ✅ | ➖ | ➖ |
| Notes | ✅ max 2000 | ➖ | ➖ |
| Lead time (days) | **Does not exist** | ✅ | ✅ asked on create |
| Currency + FX rate | Not on form | ✅ demo | ➖ |
| Address, payment terms | Address is DB-only; payment terms do not exist | ➖ | ➖ |

**The finding that matters: the prototype asks for a field production cannot store.** Lead time days does not exist on the production supplier. Production's model is the cut-off grid: each delivery day carries the order day and time that serves it, which encodes lead time implicitly. The upgraded flow drops the lead-time question from supplier creation and collects the ordering schedule in production's shape (delivery days, each with its order-by day and time). The reverse gap: order email is required in production because purchase orders send to it, and the flow currently treats it as optional.

---

## 5. The conversational contract

The layer Stefan builds against. Three tiers per field, one principle behind them: **the user might not want to add every setting, but the user might need to.** Tier one blocks the save. Tier two is stated back in the draft so silence means consent to a visible value, never to a hidden one. Tier three is reachable in one tap and never nagged.

How a natural-language prompt maps on: everything the user's prompt already contains is extracted and lands in the draft as tier-two (visible, editable, attributed to them: "you said £3.20"). The AI only asks about tier-one fields the prompt did not cover. It never asks about tier three; those live behind "anything else to set?" on the draft.

### Recipe create

| Tier | Fields | Behaviour |
|---|---|---|
| **Must ask** | Name · ingredients (drafted, each editable with qty and UoM, catalogue-linked) · yield (suggested, confirmed: kitchen knowledge, never invented) · target food cost % (an input, never an invention) · allergens (auto-detected, then explicitly confirmed per the spec's hard constraint) · sites | The save is unreachable until each has a confirmed value |
| **Infer and confirm** | Status (Draft) · product class · hot/cold and the VAT % it implies · channel prices from the target (dine-in, takeaway, delivery SRP, each channel's cost including its flagged packaging) · delivery commission · packaging suggestion | Every inferred value is visible in the draft with its reasoning ("hot food, so 20% VAT dine-in"). Correcting is one tap |
| **Offer** | Yield loss % per ingredient (asked once, right after the ingredient card, skippable) · variable ingredients (extra or replacement, per web-v2's model) · production settings (prep time, shelf life, batch min/max/multiple, carry-over, category — offered after save, defaults stand if declined) · instructions · photo · sub-recipe flag · count in stocktake · exclude from COGS · tags · key ingredients · production reference | Never forced, never buried. Nina's call (31 Aug): production settings are offered, not required — this supersedes the recipe build spec's "required on create" line, which should be updated in Notion |

### Product create (supplier product; master product stated separately on every card)

| Tier | Fields | Behaviour |
|---|---|---|
| **Must ask** | Entity intent (new supplier product vs new master) · name · supplier · supplier product code · pack type · pack quantity · pack cost · single unit type | Pack structure is never skippable and never silently defaulted: a defaulted pack quantity is the sleeve error. Ambiguity ("6×1L" vs "case of 6") is a question, not a guess |
| **Infer and confirm** | Category and class · VAT rate from category (food 0%, alcohol and non-food 20%) · master product link via duplicate detection ("looks like your existing Oat Milk, link it?") · sites (all supplier sites) · status Available · unit cost read-back (pack cost ÷ pack quantity, always shown) | Duplicate detection runs before create, per the product spec |
| **Offer** | Volume or weight per unit + UoM · alternative UoMs · allergens contains and traces · nutrition · split pack · force multiples · exclude from COGS · use actual for theoretical · tags · photo | Allergens extracted from a sheet always render as an explicit confirm, never land silently |

### Supplier create

| Tier | Fields | Behaviour |
|---|---|---|
| **Must ask** | Name · order email | Order email is where purchase orders go; a supplier without one cannot be ordered from |
| **Infer and confirm** | Status Active · sites (confirm when empty) · categories (from what they supply) · send-order-to-email on | |
| **Offer** | Contact name · phones · CC and accounts emails · minimum order value · ordering schedule (per delivery day: order-by day and time) · company and site account numbers · auto price updates · API ordering · notes | Kept light per the spec. The catalogue lands via ingestion, not field questions |

Field changes the AI never makes silently, at any confidence, in any flow: allergens, pack structure, UoM, price. Each is either explicitly confirmed by the human or not changed. This restates the specs' hard constraints at field level.

### Update flows

Updates stage only the fields the user asked to change; the diff shown is the complete diff; the AI never tidies adjacent fields in passing. The recipe edit and supplier edit flows follow this today and it stays. Cost impact renders on every update that touches cost, pack, unit or price, before the confirm is reachable ("this takes the recipe from £1.84 to £2.03 per portion, 28% to 31% food cost").

---

## 6. Pricing behaviour during recipe creation

The gap raised: adding a recipe through the Command Centre gives no price visibility the way the current set-up does. What the flow must show, and when:

1. **From the first ingredient card:** per-line cost and running total, updating as quantities change. The prototype's margin explorer already does this; it arrives one step too late (after the target ask) and works from template costs, not the catalogue. Costs come from the live catalogue: supplier pack cost ÷ pack quantity, or the master's weighted average once deliveries exist. The arithmetic is visible per link in the chain (supplier price → master cost → line cost → per-portion via yield), because a reviewer can judge "does a flat white take 200ml of milk" instantly but cannot verify a UoM conversion in their head.
2. **At the pricing step:** target food cost % in, then the full channel read-back: dine-in SRP ex and inc VAT with GM, takeaway with its VAT treatment, delivery with commission and net. All three editable; editing an SRP re-states the GM it implies, matching web-v2's cascade.
3. **Before the save:** cost per portion, food cost % against target, and the three channel prices sit on the confirm card. No recipe saves without its economics on screen.

---

## 7. What the prototype now does (as built, 30 Aug)

The three upgrades in this piece of work are done. The field matrices above (columns marked "before upgrade") stand as the gap analysis; this section is the record of what closed.

**Recipe flow** (`Feed.tsx` recipe wizard), reworked 31 Aug to sit closer to the production flow:

- The ingredient card edits name, yield, and per-row quantity and UoM (metric pairs convert so the line cost never moves). A yield-loss step follows: one % per ingredient, skippable, costed the way web-v2 does it (net quantity in, gross quantity paid for).
- A variable-ingredients step mirrors web-v2's model exactly: Extra (layers on the base build) or Replacement (swaps a named base ingredient), with quantity, UoM and yield loss. No own price, no channel flags, no min/max — none of those exist in production.
- Packaging moved before pricing, because takeaway and delivery packaging feed those channels' prices. Each packaging row carries web-v2's three channel flags (dine in, takeaway, delivery) and only flagged rows count toward that channel's cost.
- Packaging is suggest-then-extend: the AI proposes the top rows with a quantity each (labelled "Suggested"), every row has an editable qty and a UoM selector (web-v2's unit list), and a catalogue search below the list adds any Packaging-category product beyond the suggestions. Line cost is qty × unit cost; channel prices and the save summary both use it.
- The pricing card is stripped to what matters: food cost per serve, the target food cost % with a four-rung ladder showing the dine-in price at each %, and the price per channel with each channel's packaging included, VAT, and delivery net after 30% commission. The per-ingredient cost list and the cheaper-swap suggestions are gone (swaps parked for now, per Nina).
- Production settings are optional again: offered after the save with the recipe defaults standing if declined. Taking the walkthrough patches the saved recipe. This is Nina's decision and supersedes the build spec's "required on create".
- The ingredient card carries the three flags production keeps on the recipe profile (sub-recipe, count in stocktake, exclude from COGS) behind a collapsed "Recipe settings" expander (31 Aug). Each flag shows a one-line plain-English explanation, because the labels are accounting jargon to a GM. Defaults are the common case: counted, included in COGS, sold on its own. When a flag differs from its default the collapsed row names it, so a toggled setting never hides. The save writes all three; they previously saved as hard-coded defaults.
- Count in stocktake carries a coupling the toggle copy deliberately never mentions: the backend gates every production planner query on the flag, so a recipe with it off can never appear on the planner (`production-planning.service.ts`, `production-recipe-utils.ts`). The flow reconciles this in the background instead (31 Aug): taking the production walkthrough sets the flag on when patching the saved recipe, because configuring batches is the user declaring "this is batch-made stock". If that overrides an explicit untick, the done message states the change in one line with the route to reverse it, per the contract rule that silence is only ever consent to a visible value. Nina's call: the coupling is a data-model quirk a GM should not have to reason about, so it is never explained on the toggle, only resolved.
- Confirming writes a real `Recipe` into `recipeStore` with per-channel prices, yield loss on the ingredient lines and any variable ingredients, so chat-created recipes appear in the library next to manually built ones.
- The supplier-link offer still follows the save, and the done receipt states whether the supplier was linked and whether production was configured.

**Product flow** (cards under `commands/cards/`, runner in `useCommandRunner.tsx`):

- Pack details are no longer skippable. Supplier product code, pack quantity and pack cost are required; the confirm stays disabled until all three are valid. The sleeve error path is closed.
- The pack card now also carries VAT rate, sites, volume or weight per unit, allergens contains and traces, and up to two alternative UoMs, with the advanced flags (split pack, force multiples, exclude from COGS, use actual for theoretical COGS) behind an expander. Unit cost renders live as pack cost ÷ pack quantity.
- In replace mode the card pre-fills VAT, sites and allergens from the product being replaced, stated back as defaults the user can change.
- The summary card states the entity ("New supplier product"), and the confirmed product persists every collected field, not just name and pack.

**Supplier flows:**

- Creation (inside the product wizard's new-supplier step) requires name plus order email, because a supplier without an order email cannot be ordered from. Contact name, phone and minimum order value sit behind "More details", never forced. The lead-time question is dropped from the form; the field survives on the type only so older demo data still renders.
- The `Supplier` model gains contact name, accounts email, company account number and notes. The field-edit command (`/supplier` and natural-language sentences) parses, stages, diffs and saves all four alongside the original six, and the activity log shows them.
- The catalogue-import flow's extraction card and commit now carry contact name, accounts email and account number from the supplier sheet, so an imported supplier lands with the same field coverage as a hand-created one.

Still open in the prototype, deliberately: the cut-off grid per delivery day (the prototype keeps the single cut-off + delivery days shape; production's grid is specced in §4 and the contract), CC emails, site account numbers, site cut-off exceptions, API ordering, and nutrition on products. These are documented gaps, not oversights; none blocks the conversational contract.

## 8. Known prototype shortcuts (do not copy into production)

- **Routing is keyword and regex matching** (`parseCommand`, confidence ≥ 0.6, plus bespoke detectors). Production replaces this with the model; the flows and tiers above are the behavioural spec, not the parser.
- **Recipe drafting is template-based**: two templates (avocado toast, chicken mayo), fuzzy name lookup, unknown dishes fall back to avocado toast. Production drafts from the model plus the customer's catalogue.
- **Sheet extraction is mocked**: any attachment resolves to the bacon or Atlas Drinks fixtures. Production extraction is Stefan's build, with Beth's edge cases as the test set (hard deadline: before she leaves in October).
- **No staging table, no undo, no dual attribution** in the prototype. The specs lock all three for production; the prototype demonstrates the confirm surfaces only.

## 9. Open questions

| Owner | Question |
|---|---|
| Nina | Channel prices on recipe create: must the user confirm all three, or is dine-in confirmed with takeaway and delivery defaulted from it? The contract above defaults them visible; confirm before Stefan builds. |
| Nina + Stefan | The production drawer's per-site production visibility: ask per site on create, or default all sites and offer the split? Prototype defaults all. |
| Stefan | Where extraction meets the tiers: a sheet that fills a tier-one field still needs it confirmed. Is that per-field or one draft-level confirm? Prototype treats the draft confirm as sufficient except allergens, pack structure, UoM and price, which are always per-field. |
| Gio / Dave | Supplier product code uniqueness: the live check web-v2 runs on the code field needs an API the Command Centre flow can call mid-conversation. |
| Nina | Master product creation through chat: the contract covers supplier products fully; master-only creation (name, category, base UoM) is three questions. Worth its own entry phrase, or only ever reached via duplicate detection? |

---

## 10. Handover note for Stefan

You are building the natural-language layer that replaces the prototype's keyword routing. Everything in this document except §8 is behavioural spec; §8 is the list of shortcuts you must not copy.

**Read in this order.** The decision note (what we build, in what order), then the three build specs, then this document. The specs carry the locked constraints: staged decisions only, no auto-apply, dual attribution on every write, undo, allergens always explicitly confirmed. This document carries the field-level contract those constraints apply to. Where they disagree, the spec wins; tell me where they disagree, because I wrote both.

**Every word the AI says follows `EDIFY-PRODUCT-VOICE.md`** (this repo, mirrored in Notion). Its §10 prompt block is versioned and goes into the Command Centre system prompt verbatim: the doc and the block change together, so take the block from the doc, never a copy. The prototype's hard-coded copy already follows it; generated copy must too.

**What the prototype gives you.** Working confirm surfaces for every flow in §1, with the full field set as of the §7 upgrades. Run it, type the entry phrases, and watch what the cards ask, state back and offer. The prototype's flows are the interaction design; the parsers are not. `parsers.ts` is regex standing in for you.

**The contract in one paragraph.** Extract everything the user's prompt contains and stage it visibly, attributed to them. Ask only for tier-one fields the prompt did not cover. State tier-two defaults back with their reasoning so silence is consent to a visible value. Put tier three behind one "anything else to set?". Never silently write allergens, pack structure, UoM or price at any confidence: those four always get an explicit per-field confirm.

**Business logic you need that lives outside this doc.** Recipe costing arithmetic (supplier pack cost ÷ pack quantity → master cost → line cost → per-portion via yield) and the channel price cascade (margin %, VAT %, per-channel GM and SRP, delivery commission) both follow web-v2: `recipe-edit-schema.ts` and the pricing sidebar are the reference implementations. Supplier ordering schedule is a per-delivery-day grid, not a lead time; the prototype simplifies this and production must not.

**The extraction test set.** Sheet ingestion ships against Beth's edge cases, before she leaves in October. That date is the hard constraint on sequencing; the conversational flows can follow ingestion if they must, per the decision note.

**Before you build, I owe you answers** to the Nina-owned rows in §9: channel-price confirmation depth, per-site production visibility, and whether master-only creation gets its own entry phrase. Chase me if they are not resolved by the time you pick this up.

Technical calls (staging table shape, model choice, where the uniqueness check API lives, how mid-conversation validation calls work) are yours and Gio's. Flag anything in the contract that fights the architecture rather than working around it quietly.
