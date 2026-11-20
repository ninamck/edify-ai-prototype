# Floor tasks in Command Centre

For Stefan and Gio. Written for the prototype on branch `feat/floor-tasks`.

A team member says or types a task in Command Centre and Edify does it: "3 croissants out of date", "add 6 toasties", "Natoora's here, 12 items, none missing". Edify stages the task, reads it back, and nothing changes until someone confirms. Voice records or starts things. Anything that accepts stock or moves it between sites is confirmed on screen.

Every rule below was read from Edify Main (`../edify`). Each task in `lib/floorTasks/registry.ts` lists the Main files it came from, so you can check the prototype against the real thing. Where the prototype stops short of Main, or Main stops short of what we need, the task says so.

## Running it

1. Add `AI_GATEWAY_API_KEY` to `.env.local` and restart `npm run dev`. On Vercel the deployment's OIDC token is used instead, so no key is needed there. `FLOOR_TASKS_MODEL` overrides the model, which defaults to `anthropic/claude-sonnet-5.5`.
2. Without a key, `/api/command` runs in demo mode: `lib/floorTasks/demoReader.ts` reads the sentence with set patterns and calls the same tools the model would, so the cards, rules and undo are identical. The response carries `engine: "demo"`, but the chat looks the same either way. Anything the patterns don't recognise answers `route: "other"` and goes to the existing chat. `FLOOR_TASKS_ENGINE=demo` forces demo mode with a key, and a failed model call falls back to it.
3. Demo mode is for showing the flow, not for judging language. The patterns were tuned on the test phrases, so they read all 164, but new phrasings, several tasks in one sentence and long follow-up conversations are where the model earns its place.
4. `/dev/floor-tasks` has 10 to 12 test phrases per task. "Send" sends a phrase through `/api/command`, the same as the chat, and checks the right tool was called. The banner says whether the model or demo mode answered. "Stage directly" calls the tool with known arguments, so the cards and Main's rules can be checked on their own.
5. `node scripts/check-floor-tasks.mjs` runs 40 checks of the tools and the site store against Main's rules. `node scripts/check-demo-reader.mjs` runs every test phrase through demo mode (`--all` lists each one). Neither needs a model or a browser.

## How a task flows

1. The chat sends the words, the last 8 turns of the floor conversation and a snapshot of the site to `POST /api/command`. A pre-filter skips the model for messages with no floor words in them, so analytics questions don't pay for the round trip.
2. The model gets one tool per task, shaped like Main's `toolFactory` in `backend/src/common/ai/tool.ts`: a name, a description, a zod shape and a handler. Tool descriptions carry Main's `STAGE_WITHOUT_ASKING` wording word for word.
3. Tools never write. They resolve names against the snapshot, apply Main's rules and either stage a proposal, ask one question, or refuse in the first sentence with the way forward. This is the same pattern as Main's `scope.record()` in `backend/src/common/ai/staged.ts`.
4. If the words weren't a floor task, the model calls `not_a_floor_task` and the chat runs its usual flows: analytics, recipes, supplier import and the rest.
5. The browser confirms the proposal and applies it. The result is a receipt with what changed, the new figure and an undo where Main has one.

Each task has a tier, and the device decides how it is confirmed.

| Tier | Tasks | On the app | On a headset |
|---|---|---|---|
| Ask it | Stock, arriving, left to make, allergens | Answers, stages nothing | Answers, stages nothing |
| Say it | Waste, on hand, hot add, production step, par, request stock, quick count, checklist answer, basket add, undo | Card, or a typed "yes" | Spoken "yes" |
| Show it | Accept delivery, send transfer, accept transfer, one-off day | Card | Goes to Waiting for you |

Waiting for you sits by the composer. An item there stays until someone reviews and confirms it, dismisses it, or the trading day ends. Several tasks in one sentence come back as one readback: "Two things: ... Save both?".

## The tasks

Who can do what is shown as Team member or Manager. Par and on hand are confirmed against Main (`set-lsl-par-level-permission.handler.ts` and the manager-role migration). The other grants need Gio to confirm, see Open decisions.

### Log waste (Say it, everyone)
`POST /waste`, permission CreateWaste.
- Lines can be products, master products, recipes or sub-recipes, each in one of its own units. "3 croissants" on a box of 12 records 0.25 boxes.
- Reasons are the site's waste reasons. Edify maps the words: "out of date" is Beyond expiry date, "dropped" is Damaged, "stale" is No longer fresh, "staff meal" is Used by Staff, "Too Good To Go" is Third Party food waste app. No reason given means No Reason.
- Today or yesterday only without EditWasteDate.
- Unusually large: worth at least £5, the item has at least 3 lines in the last 90 days, and more than 5 times their median. The card becomes "Record waste anyway?" and still saves.
- Undo deletes the line. Main asks "Why are you deleting this?" and needs 3 to 500 characters, so Edify asks for the reason before it deletes.

### Update what's on hand (Say it, everyone, two routes)
- A manager's figure sets on hand outright: `PUT /live-stock-levels/:id/quantity`, Admin and Manager only.
- A team member can't set on hand in Main. Their "I have 5 chicken breasts" goes in as a quick count on a count list that holds the item, with only that item counted. Main applies counted items only, so nothing else moves.
- If no count list at the site holds the item, a team member can't record it. Edify says so and names the two ways forward: ask a manager, or add the item to a count list.
- Refused while a full stocktake is being counted, with Main's copy.
- No undo in Main. Edify offers to set it back to the old figure, which is a new update.

### Add to hot production (Say it, everyone)
`PATCH /production/:siteId/batch-daily-productions`.
- Current or next batch only, as Main's Add dialog offers. The batch can be named: "the 12 o'clock", "1pm", "next".
- Cumulative: the new made figure is what was made plus what was added. A line not made yet is recorded as made, with a warning.
- Only recipes already on the batch. Up to 1000 per line. Not offered when PCR is on for the site.
- Cold-bench runs have no add in Main, so "add 10 to the wraps" on a cold bench is refused.
- No undo in Main. A wrong figure is fixed in the availability modal.

### Start or finish production (Say it, everyone)
`start-production` and `complete-production` on the daily production.
- A run can't be completed before it is started. "Done" on an unstarted run does both, in order.
- The bench runs in sequence: a run can't start until earlier runs are finished.

### Set a par level (Say it, Manager)
`PUT /live-stock-levels/:id/par-level`. Main saves par with no confirm. Edify still reads it back, because a misheard number changes every order after it.

### Ask another site for stock (Say it, everyone)
`POST /transfer-requests`. Moves no stock; the other site sends it as a transfer. Undo cancels it while it is still Requested.

### Start a quick count (Say it, everyone)
`POST /count-lists/:id/quick-counts`. Needs a count list. Starting on a list with an open count carries on with it. Blocked during a full stocktake. Submitting updates on hand for counted items only and doesn't change COGS. Undo discards the open count.

### Answer a checklist question (Say it, everyone)
`POST /checklists/:id/response/:logId`.
- A tick is stored as yes or no. Temperatures between -100 and 1000 °C.
- Follow-ups open when their rule fires, for example above 5 °C. Edify asks the follow-up straight away, unless the person says they'll answer it later.
- Saving one answer saves progress. It doesn't complete the checklist. Main lets a checklist be edited the same day, so the undo is to answer again.

### Add to the basket (Say it, Manager)
`POST /predictive-orders/:id/items`, permission ManagePredictiveOrder.
- Refused if the product is already on the order ("change its quantity instead") or the order's supplier doesn't supply it, with Main's copy.
- A removed line comes back instead of being added twice. Stock units round up to whole packs.
- Adding never sends. Placing orders stays its own on-screen step.
- The line shows on the assisted-ordering basket page straight away.

### Accept a delivery (Show it, everyone)
`PUT /deliveries/:id/accept`.
- Only orders that have gone to the supplier. The delivered date can't be before yesterday.
- If the site needs a supplier reference, the card won't accept without one: "Delivery must include a Supplier Reference".
- Edify checks the spoken item count against the PO's lines and total units. If they don't match, it stops and lists the lines rather than guessing.
- Short lines: any remaining quantity stays pending. Request credit emails the supplier's accounts address, so it is always an on-screen tick box.
- No undo. An accepted delivery can't be un-accepted.

### Send a transfer (Show it, everyone)
`POST /transfers`. Creating a transfer sends it, and the sender's stock goes down straight away. More than is on hand is allowed after "Send anyway?". Undo cancels while pending and the stock comes back.

### Accept an incoming transfer (Show it, everyone)
`PUT /transfers/:id/accept`. Only the receiving site, and not before the sent date. Damaged, Temperature out of range and Quality issue are written off at the sending site. Incorrect item, Missing and Other go back to the sender.

### Plan a busy or quiet day (Show it, Manager)
Main's `propose_demand_adjustment` tool, then approve. Starts tomorrow at the earliest and no more than 28 days ahead, covers 14 days at most, 0 to 300% of usual. People hear "one-off change", never "demand adjustment". Undo stages a new one at 100%.

### Undo (Say it, same permission as the task)
"Undo", "scrap that" or the Undo button on a receipt. Undo follows what Main allows for each task. Where Main has none, Edify says so and offers the manual fix.

### Ask it
What's on hand against par, what's arriving today, what's left to make, and a recipe's allergens. Read-only, from the same snapshot.

## Where Main needs work

These came out of reading Main. None is built in the prototype's backend, because there isn't one.

1. **No ad-hoc count of one item.** A team member can only record on hand through a count list that holds the item. If floor staff should be able to say "I have 5 chicken breasts" for anything, Main needs either a single-item count or a rule that adds the item to a list.
2. **No add on a cold-bench run.** Hot batches have an add; bench runs don't.
3. **No draft transfer.** "Start a transfer" in the brief implies a draft. Main's create sends.
4. **A short delivery line can't close without a credit request.** The prototype lets it stay pending.
5. **Checklist mandatory questions are only enforced on screen.** A voice answer goes straight to the API, so the server has to check before completion.
6. **Either site can accept a transfer on the server.** The screen limits it to the receiving site; the API should too.
7. **Start and complete production only need ViewProductions.** That's a read permission doing a write.
8. **The trading day ends at midnight.** Waiting for you clears at 23:59 local. Sites that trade past midnight need a real end of day.

## Open decisions

1. **Role grants.** Gio to confirm who holds CreateTransferRequest, CreateTransfer, UpdateTransfer, UpdateDelivery, ManageStockTake and AnswerChecklist by default. The prototype gives all of them to team members, and par, basket and one-off days to managers only.
2. **Where voice waste lands.** In the prototype it is logged in the floor-task store, not on the /log-waste page, which runs on its own stand-in products. In Main it goes to `POST /waste` like any other waste.
3. **Snapshot on the server.** The prototype sends a snapshot of the site from the browser. In Main the tools should read live data themselves, the way the predictive-order tools do. Stefan's call on how.
4. **The model.** Sonnet is the default because the tools do the rules and the model only maps words to calls. Worth running `/dev/floor-tasks` against a faster model before settling.

## Files

- `lib/floorTasks/registry.ts`: one entry per task, with tier, slots, Main endpoint, permission, roles, confirm copy, undo, rules, Main files and differences.
- `lib/floorTasks/tools/`: the tools, one file per area, and `scope.ts` with the Main-shaped `toolFactory`.
- `lib/floorTasks/prompt.ts`: the instructions, with Edify's product voice block word for word.
- `app/api/command/route.ts`: the model call, and the switch to demo mode.
- `lib/floorTasks/demoReader.ts`: the demo mode patterns, and the sentences for Ask it answers.
- `lib/floorTasks/world/`: the site's data for the prototype (seed and store) and how each task is applied.
- `lib/floorTasks/voice.ts`: yes, no and undo matching, confirm mode per device, readbacks.
- `components/Feed/floorTasks/`: the card, the Waiting for you bar, the chat hook and the test page.
- `lib/floorTasks/evalPhrases.ts`: the test phrases.
