# Square menu publishing: business logic for the build

**Owner:** Nina McKenna, Head of Product
**Date:** 19 November 2026
**Follows:** Recipe variants and modifier groups (Isaac, Phase 1), PRD v0.2 in Notion
**Fills:** Phase 3, [ENG-3667](https://linear.app/edify-systems/issue/ENG-3667/phase-3-push-recipe-families-and-modifier-groups-to-the-square-catalog)
**Prototype:** `edify-ai-prototype`, Menu area, Square menu tab (`/square-menu`)

This doc explains what the feature does and the rules it follows. How it is built is the engineer's call.

---

## 1. The idea in one paragraph

A multi-site café group builds its menu once, in Edify, and Edify writes it to Square. Today the head of food builds a Latte in Edify for costing, then someone builds the same Latte again in Square for the till, then someone matches the two together on Item matching. Publishing removes the second and third steps for Square customers. Non-Square customers carry on exactly as today.

## 2. Two jobs, two pages, one set of links

- **Item matching** stays the inbound job for every POS: "this till button means this recipe or product". Lightspeed, Toast, Micros and every other till keep using it unchanged.
- **Square menu** is a new tab, shown only to Square companies that switch publishing on. It is the outbound job: "send this to the till, and tell me when the till disagrees".
- Both pages read and write the same link records. Linking a button on one shows as linked on the other.
- When Edify creates a Square item, the link exists from birth, so nobody has to match it. Matching is still needed for onboarding, for items someone builds directly in Square, and for every other POS.
- On Item matching, rows Edify published show a "Published from Edify" chip and their link is read only there; it is managed on Square menu. Companies not publishing to Square see no change at all.

## 3. Ownership rules (decided)

| Field | Who owns it | What happens when Square changes it |
| --- | --- | --- |
| Item name, sizes, modifier groups and options, allergens, sites, till category, VAT, photo, description | Edify | Flagged as Changed in Square, user decides |
| Price per size and per site, option prices | Edify | Flagged as Changed in Square, user decides, margin effect shown |
| Option prices that differ by site, when the customer keeps them in Square (section 9) | Square | Ignored. Edify resends them unchanged |
| Sold out | Square | Read only. Apps can't set it |
| Tile colour, POS layout, channels, printer routing, courses | Square | Ignored. Edify never flags these |

- Nothing Square changes is ever silently overwritten, and nothing is silently taken into Edify.
- **Nothing is mandatory unless Square requires it.** Square requires a name and at least one size. A size with no price publishes as "price entered at the till" (Square's variable pricing). A blank option price means the option is free. Every other field is optional and shows as a gap, never a blocker.
- Changes reach Square only through **review and publish** by an Admin. Saving a recipe never touches the till. This stops a GM's edit at 11am changing the till mid-lunch.

## 4. What a till item is

Recipes and products both hold things nobody sells: prep, sauces, the milk itself. So the Square menu list is curated, not derived from the recipe list.

- Each row is a **till item**. It points at exactly one recipe family or one product.
- It holds only till-facing fields: till name, kitchen name, till category, sizes, till price per size (with optional per-site prices), sites, VAT, photo, description.
- It never holds ingredients, quantities or cost. The recipe stays the one place that says how something is made.
- A recipe-family till item has one size per variant (Small, Regular, Large). Sizes come from the family and can't be added on the till item.
- A product till item carries an **amount per size**. House red sold as 175ml, 250ml and Bottle is one Square item with three sizes, each drawing a different amount from the same product. This is the same amount and unit Item matching already stores when it links a till button to a product.
- The till name defaults to the family name. Changing the till name never renames the recipe.
- Allergens on the till item are read only and come from the recipe.

### How the list gets built

1. **Existing Square merchant, day one.** The first-link flow reads the Square catalogue and turns every linked till button into a till item. Unlinked buttons arrive as "On the till only".
2. **New Square merchant, empty till.** The list starts empty. Edify suggests active standalone recipe families with a price, and products already sold at other sites.
3. **After that, on purpose.** "Add items" on the list opens a picker with Recipes and Products tabs, likely sellables first, "Show all" for components and prep. "Sell this at the till" in the recipe editor does the same for one recipe.
4. **Taking something off.** "Take off the till" removes the till item. The next publish archives it in Square. The recipe or product is untouched.

## 5. Till statuses

| Status | Meaning | What the user can do |
| --- | --- | --- |
| In sync | Square matches what Edify last published | Nothing needed |
| Ready to publish | Edify has changes Square hasn't got yet | Publish |
| Changed in Square | Someone changed an Edify-owned field in Square | Review: use Square's, keep Edify's, decide later |
| Not on the till | In Edify only, never published | Publish to create it in Square |
| On the till only | In Square, not linked to anything in Edify | Link to a recipe or product, or create a recipe from it |
| Can't publish | Breaks one of Square's own rules | Apply the named fix |

"Can't publish" is reserved for Square's rules. Today there is one: sizes carrying different modifier groups. Square attaches modifier lists to the whole item, so it can't represent "Large gets syrups, Small doesn't". The fix offered is "Attach to all sizes" or "Make Large its own recipe". Missing optional fields never use this status.

A row can be both Changed in Square and Ready to publish. Changed in Square shows first because it needs a decision.

## 6. Publish rules

- **Publish is a reviewed change set.** The sheet groups changes into New on the till, Updated and Removed from the till, and shows each change field by field.
- **Warnings name the fix.** Sizes with different groups. Removing a size (Square deletes it; recommend switching it off at every site instead). A change that will overwrite something changed in Square.
- **Fields marked Decide later are left alone** by the publish. Nothing undecided is overwritten.
- **Whole-item writes.** Square has no partial updates: every write replaces the whole item, its sizes and its modifier attachments. Leaving a size out of a write deletes it in Square. The publish must always send the full item.
- **One write at a time.** Square processes one catalogue write per merchant at a time and rejects parallel ones. The publish runs as a queue and the progress screen shows it item by item.
- **Partial failure is normal.** The receipt lists what was created, updated and removed, and any item that failed with its reason and a Retry. Items that succeeded stay published.
- **New objects** are created with temporary ids in one batch, and Square returns the real ids. Edify stores them straight away.
- **Archive, don't delete, items.** Taking an item off the till archives it in Square. Archived items stay in Square's history and keep old orders readable. Deleting is permanent and breaks references from past orders.
- **Removing a size.** Square has no archive for a single size. Recommend switching it off at every site. If the user still removes it, Square deletes it. Edify keeps its own sales history either way.
- **Items are created as food and beverage items** so they can carry allergens. Square never lets this change later. An existing Square item created as "regular" can't take allergens without being recreated; the first-link flow flags these.

## 7. Changed in Square: what is compared

- Square sends a "catalogue changed" signal whenever anyone edits the menu: Dashboard, the till, or another app. The signal carries only a time.
- Edify then asks Square for everything changed since its last check, including deletions.
- Each changed object is compared field by field with what Edify last published for it. Edify's own publishes are recognised and skipped.
- A nightly full check catches any signal that went missing.
- Only Edify-owned fields are flagged (section 3). Everything else is ignored.
- Square doesn't say who made a change, only when. Copy reads "Changed in Square on 19 Nov at 10:42".

### Where the user is prompted

- A "Changed in Square" stat tile and row status on Square menu.
- A count badge on the Menu nav item.
- A Command Centre card: "3 changes made in Square since yesterday", with Review.

### The choices, per change

- **Use Square's.** Edify updates the till item. A till name change updates the till name only, never the recipe name. A price change shows the margin effect ("£3.40 to £3.60, GP 66% to 68%").
- **Keep Edify's.** The row moves to Ready to publish. The next publish puts Edify's value back.
- **Decide later.** The row stays flagged and the publish leaves that field alone.
- **Use all Square's.** Bulk version, for after a big menu change at the till.

### Special cases

- **Option added in Square to an Edify group.** Edify asks what it does to the recipe (add an ingredient, swap an ingredient, or no recipe change) before adding it to the group. Until answered, sales of that option deplete nothing and are logged.
- **Item or size deleted in Square.** "Take it off the till in Edify too" or "Put it back on the next publish".
- **New item built in Square.** Appears as On the till only.

## 8. Link records

- Every till item, size, modifier group and option stores the Square id of the object it was published as, **per Square merchant**. A standalone company has one row per object. A franchise in Release 2 has one per franchisee merchant.
- Edify also writes its own id onto each Square object as a hidden custom attribute, set so the merchant and other apps can't edit or remove it. This lets Edify recognise its objects even if a link is lost.
- **This replaces name-based identity for Square.** Today the POS service identifies a till button by a hash of its name, vendor and type. A rename in Square therefore looks like a new button and loses its match. Publishing and change detection both depend on keying by Square id instead. Other POS vendors can keep the current approach.
- Square sizes are stored as sizes under one item, not flattened into "Latte - Large" buttons. Square modifier lists are stored as groups, which main doesn't read today.

## 9. Modifier groups at the till

### What Isaac's Phase 1 stores today

- A group is a name and a list of options. Each option has a name, an order, and the recipe change it makes: add something (extra) or swap one product for another (replacement).
- When a group is attached to a recipe, each option is copied onto that recipe as its own row. On that recipe a GM can switch an option off, change its quantity and unit, and pick which line a swap replaces ([ENG-3852](https://linear.app/edify-systems/issue/ENG-3852), [ENG-3855](https://linear.app/edify-systems/issue/ENG-3855), [ENG-3858](https://linear.app/edify-systems/issue/ENG-3858)). Every size is its own recipe in the family, so all of this works per size.
- Nothing about the till is stored yet: no option price, no selection rules, no default option, no kitchen name. [ENG-3667](https://linear.app/edify-systems/issue/ENG-3667) already plans to bring back option price and minimum and maximum selections.
- Edify's existing Square import already reads each location's own modifier price and stores it per location. The modifier library doesn't use it yet.

### What Phase 3 adds to each group

- **Selection rules.** Pick one or several, optional or required, plus "up to N" when several. Defaults come from the group's shape, as ENG-3667 says: all swaps means pick one, all extras means no limit. Mapping to Square: one and required = min 1, max 1. One and optional = min 0, max 1. Several and optional = min 0, max N (0 means no limit). Several and required = min 1, max N. Square has retired its old single or multiple setting; the minimum and maximum fields replace it and are still marked beta.
- **Option price** per option. Optional; blank means free.
- **Default option.** Not in any ticket yet.
- **Kitchen name** per option. Optional. Not in any ticket yet.
- **Per-recipe default override** (oat milk as default on the Iced latte only). Square supports this on the item's attachment.

### Rules

- **Square treats every size of an item the same.** Modifier lists attach to the whole item, so every size gets the same lists and the same options at the same price. On one item Square can only change which option is picked by default and whether an option is hidden online. It has no per-size attachment, no per-size option price, and no way to switch one option off on one item.
- **A group on some sizes and not others: can't publish.** See section 5. The fix is to attach it to every size or make that size its own recipe.
- **An option switched off on some sizes: warn, don't block.** If a GM switches oat off on Latte Large, the publish still sends oat for every Latte size, because Square can't do otherwise. The item drawer and the publish sheet both say so: "Oat milk is off for Large (16oz) in the recipe. Square offers every option on every size, so staff can still pick it. Edify logs those sales as a modifier it couldn't apply." Those sales land in the issue log ENG-3667 already plans. Blocking would stop a publish over something most operators accept, and the fix sits in the recipe, not on the till.
- **Option prices that differ by site.** Edify holds one price per option. When the first link finds a Square location charging a different option price, it asks:
  - **Keep each site's price in Square** (suggested). Edify sends its own option price as the standard price and leaves the location prices alone. Square replaces the whole object on every write, so Edify must read the location prices and send them back unchanged each time, or the write wipes them. Changes to those site prices in Square are not flagged.
  - **Charge one price everywhere.** The next publish removes the location prices, and the publish sheet says so on the group's line.
  - The choice can be changed later in the group editor's At the till card. Holding per-site option prices in Edify is a later step if customers ask for it.
- **Options with no recipe change.** Square menus usually list the base choice as a free option, such as Whole milk picked by default, and carry options that change nothing in the recipe, such as Extra hot. Isaac's model requires every option to add or swap a product, so it can't hold either. **Recommendation:** allow an option with no recipe change. It also covers "Add it, no recipe change" when someone adds an option in Square (section 7). **Question for Isaac:** confirm this, or have the publish add the recipe's own line as a free default option instead.
- **Single options outside a group.** [ENG-3917](https://linear.app/edify-systems/issue/ENG-3917) lets a GM attach one option to a recipe without a group. Square has no standalone modifiers, so the publish sends each one as a set with a single option, as ENG-3667 proposes.
- Square has no allergens on modifiers. "Add cheese" can't carry milk at the till; the recipe still knows.

## 10. Turning publishing on

1. Settings sits on the Square card in POS connection: "Publish your menu to Square: Off".
2. Turning it on shows what Edify will own and what Square keeps (section 3).
3. The Admin re-authorises Square, which adds the write permission. Nothing else is disconnected and sales keep flowing.
4. The Admin confirms which Square locations map to which Edify sites and picks the default VAT rates from the merchant's existing Square taxes, one for hot items and one for cold, using Edify's hot/cold flag. The Admin confirms the rates; Edify doesn't decide VAT treatment.
5. Edify recommends a Square permission set where only owners can edit items, so fewer changes arrive from the till. This is advice, not enforced.
6. The Square menu tab appears and the first-link flow starts.

Today, Square write permission is only requested when email orders are on. Publishing needs its own route to it.

## 11. Square concepts: what we write and what we can't

**Maps directly from Edify**
- Recipe family to Square item. Variant to size (variation), using the recipe SKU.
- Modifier group to modifier list. Option to modifier.
- The 14 UK allergens to Square's food and beverage allergens.
- Recipe sites to the Square locations where the item is available.
- Bought-in products to an item with one or more sizes.

**Edify builds these and writes them**
1. Till price per size and per site, defaulting from dine-in price.
2. Option prices, one per option. Where a site charges differently, the customer keeps that price in Square or moves to one price (section 9).
3. Selection rules, including "up to N".
4. Per-recipe default option override.
5. Till category, picked from the merchant's Square categories or created new. Edify also writes menus and menu groups.
6. Kitchen name. Till name defaults to the family name.
7. VAT from the merchant's existing Square taxes; Edify creates one only when none exists.
8. Photo and description from the recipe.
9. Nested modifiers: next, not now. Square supports them in beta; Edify needs conditional groups first.
10. Sizes carrying different groups: blocked at publish with a fix.

**Square doesn't let apps write these, so the customer sets them in Square**
- Which sites and channels a menu reaches.
- Online, kiosk and delivery visibility, including the channel setting on each modifier set.
- POS tile layout and pages (Edify sets default colour and first image only).
- Printer profiles and kitchen display settings (Edify sets the categories they route by).
- Courses, service charges, restaurant mode, device profiles.
- Combos and meal deals (alpha only).
- Sold out (workaround: Edify writes stock levels to Square, which marks items sold out at zero).
- Switching off Square Recipes, or stock is deducted twice.

**Writable but not in this release**
- Discounts and happy hour pricing: no Edify concept yet.
- Stock levels to Square: needs an extra permission, worth a follow-up.
- Per-site option prices held in Edify: Square supports them. For now they stay in Square when the customer chooses (section 9).
- Menu hours: test first.

## 12. Locking what Edify writes

- Square has no app-level lock. Anything Edify writes, the merchant can edit.
- **Now:** Square's permission sets can switch off item editing for chosen roles, in Dashboard and on the till, scoped by location. Edify recommends this at setup and flags drift for everyone else.
- **Franchise, Release 2:** Square Multi-Account Suite already locks head office items field by field at member accounts. Edify writing to the operator account could inherit those locks.
- **Needs Square:** a "managed by Edify" flag. Question 1 below.

## 13. Questions for our Square contact

Isaac already has an open thread with Square on Organizations; send these through him.

1. Can a partner app mark catalogue objects as app-managed, so they're read only in the Dashboard and POS?
2. Can apps assign menus to locations and channels, and set channel visibility, through the API? Is anything in alpha?
3. Can we get access to the Combos API alpha?
4. Do menus and menu hours created through the API reach the POS with no Dashboard step?
5. Can the Multi-Account Suite central catalogue and its locks be written through the API, and are they available in the UK?
6. What is the real write throughput per merchant for a full menu publish?

## 14. Test on a UK Square for Restaurants account before committing

The Square sandbox may not support menus, so use a real UK test account on Square for Restaurants Plus with a restaurant mode on.

- Do menus created through the API reach the till without a Dashboard step?
- Can menu hours be set through the API, and does the till respect them?
- Can apps create food and beverage items? Square's SDK comment and guide disagree.
- Does Square merge a Dashboard edit and an Edify write to the same item when they touch different fields, including sizes and modifier attachments?
- How do combos sold at the till appear on orders?

## 15. Where things stand today (19 November)

- **Main only reads from Square.** Square permissions don't include item write. The only Square writes are email orders. The menu is pulled only when someone presses Sync menu. There are no Square catalogue signals.
- **Till buttons are matched by name** (section 8). Square modifier lists aren't stored. Square sizes are flattened into separate buttons.
- **Isaac's Phase 1 is nearly done:** recipe families, variants and the modifier library, behind the `recipeVariants` switch. 3 tickets in staging, about 15 in review. No variant or modifier group screens on main yet.
- **Isaac's modifier library holds no till fields yet.** Groups store names, option order and recipe changes only (section 9).
- **Phase 2** (link existing recipes into families, [ENG-3666](https://linear.app/edify-systems/issue/ENG-3666/phase-2-link-existing-recipes-into-families-as-variants-and-suggest)) and **Phase 3** (this work) are single backlog tickets.
- **Risk:** A5, which drops the old recipe columns, is in review before the BigQuery pipeline reads the new family table. Isaac and Michael need to sequence it.

## 16. Differences from PRD v0.2

- PRD Flow 10 put a "Push to Square" button on each recipe. This replaces it: publishing has one home, the Square menu tab. The recipe editor shows a till status chip that opens the item there. The Command Centre can open the same publish sheet later.
- The PRD left modifier prices with the till. Edify now writes them.
- The prototype lets a modifier group attach to some sizes and not others. Square can't represent that, so publishing blocks it with a fix, as the PRD already says.
- The prototype holds option price, selection rules, a default option and kitchen names on each group. Isaac's Phase 1 holds none of them. ENG-3667 brings back price and the minimum and maximum; default option and kitchen name need adding to it.
- The prototype's Alt milks group has Whole milk as an option with no recipe change. Isaac's model can't hold that option yet (section 9).
