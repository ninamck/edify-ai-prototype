'use client';

/**
 * The brain of the chat-command framework.
 *
 * `useCommandRunner` owns three pieces of state per session:
 *   • cmdStates    — id → pending | confirmed | cancelled
 *   • cmdArgs      — id → the live args (cards mutate these in-place)
 *   • cmdReceipts  — id → receipt object once the command executes
 *   • cmdUndone    — id → true once Undo has been clicked
 *
 * It exposes `runCommand(intent, opts)` for the caller (the Feed
 * sendMessage path or a chip click) to kick off a command, plus the
 * per-message handlers used by the renderers (`confirmWaste`,
 * `confirmStock`, etc.).
 *
 * The runner doesn't render anything itself — it pushes ChatMsg
 * entries into the parent's `messages` array via `setMessages`, and
 * the Feed's existing message renderer knows how to draw each
 * `cardMsgType`.
 */

import { useCallback, useRef, useState } from 'react';
import { findRecipe, updateRecipe } from '@/components/Recipe/recipeStore';
import { findSupplier, upsertSupplier } from '@/components/Suppliers/store';
import type { Supplier, DayOfWeek } from '@/components/Suppliers/fixtures';
import {
  appendWasteEntry,
  removeWasteEntry,
  getProduct as getWasteProduct,
  WASTE_REASONS,
  type WasteReasonId,
} from '@/components/Waste/wasteData';
import { saveCount, removeCount } from '@/components/Stock/countStore';
import type { CommandIntent, CommandReceipt, AmbiguityChoice } from './types';
import { getCommand } from './registry';
import type {
  RecipeEditKind,
  ProductionField,
  MenuAction,
  SupplierField,
} from './parsers';
import type { Recipe } from '@/components/Recipe/libraryFixtures';
import {
  startTask,
  completeTask,
  cancelTask,
  markTaskUndone,
  setTaskSnapshot,
  type TaskKind,
  type StoredChatMessage,
} from '@/components/Feed/taskHistoryStore';

// We import the parent's ChatMsg shape indirectly — Feed.tsx defines
// it locally. The runner only needs a structural subset, so we duck-
// type it here.
interface RunnerChatMsg {
  id: string;
  role: 'user' | 'quinn';
  text: string;
  msgType?: string;
  /** Carries the runtime-resolved args we want the renderer to read
   *  for command cards. */
  cmdArgsJson?: string;
  /** For ambiguity picker — encodes the choices array. */
  cmdChoicesJson?: string;
  /** Echoes the command id so the renderer knows which switch arm to
   *  pick. */
  cmdId?: string;
  /** Optional baked-in state + receipt data — populated when a thread
   *  is restored from a history snapshot. Live messages leave these
   *  undefined and rely on the runner's state map / receipts ref. */
  cmdState?: 'pending' | 'confirmed' | 'cancelled';
  cmdReceiptData?: {
    headline: string;
    detail?: string;
    href?: string;
    hrefLabel?: string;
  };
}

export type CardState = 'pending' | 'confirmed' | 'cancelled';

interface UseCommandRunnerArgs {
  setMessages: React.Dispatch<React.SetStateAction<RunnerChatMsg[]>>;
  setChatStarted: (b: boolean) => void;
  setChatMinimized: (b: boolean) => void;
  /** Optional hook called when a fresh task starts — used by Feed to
   *  reset any in-flight recipe / production / analytics flows so the
   *  new task isn't polluted by leftover state. */
  onFreshTask?: () => void;
}

interface RunCommandOpts {
  /** Already-rendered user message text (so we don't echo it). When
   *  unset, we don't echo. */
  userText?: string;
  /** When true (default), clears the existing chat thread before
   *  showing the new task's card. Set to false for continuations
   *  (e.g. when re-running after an ambiguity pick). */
  freshTask?: boolean;
}

export function useCommandRunner({ setMessages, setChatStarted, setChatMinimized, onFreshTask }: UseCommandRunnerArgs) {
  const [cmdStates, setCmdStates] = useState<Record<string, CardState>>({});
  const [cmdUndone, setCmdUndone] = useState<Record<string, boolean>>({});

  // We keep receipts in a ref since they hold non-serialisable
  // closures (the undo callback). The renderer reads via getReceipt(id).
  const receiptsRef = useRef<Record<string, CommandReceipt>>({});
  function getReceipt(id: string): CommandReceipt | undefined {
    return receiptsRef.current[id];
  }
  function setReceipt(id: string, r: CommandReceipt) {
    receiptsRef.current[id] = r;
  }

  // Task-history wiring. Every `runCommand` call opens a Task in the
  // persisted history store; confirm handlers complete it, cancel
  // marks it cancelled, undo marks it undone. We track:
  //   • activeTaskIdRef  — the in-flight task for the current chat
  //   • receiptToTaskRef — receipt msgId → task id, so undo can find
  //     the right history entry to flip.
  //   • cmdStatesRef     — mirror of cmdStates so we can read sync
  //     during a setMessages updater (state setters can't).
  const activeTaskIdRef = useRef<string | null>(null);
  const receiptToTaskRef = useRef<Record<string, string>>({});
  const cmdStatesRef = useRef<Record<string, CardState>>({});

  /** Single-source-of-truth setter for cmdStates so the mirror ref
   *  always matches React state. Use this instead of calling
   *  `setCmdStates` directly. */
  const writeCmdState = useCallback((msgId: string, state: CardState) => {
    cmdStatesRef.current = { ...cmdStatesRef.current, [msgId]: state };
    setCmdStates(cmdStatesRef.current);
  }, []);

  /** Bake the runtime card states + receipts into a plain message
   *  array, so a snapshot is self-contained (no runtime ref lookups
   *  needed when it's restored later). */
  const bakeMessagesForSnapshot = useCallback((msgs: RunnerChatMsg[]): StoredChatMessage[] => {
    return msgs.map((m) => {
      const baked: StoredChatMessage = {
        id: m.id,
        role: m.role,
        text: m.text,
        msgType: m.msgType,
        cmdId: m.cmdId,
        cmdArgsJson: m.cmdArgsJson,
        cmdChoicesJson: m.cmdChoicesJson,
        cmdState: cmdStatesRef.current[m.id] ?? m.cmdState,
      };
      const r = receiptsRef.current[m.id];
      if (r) {
        baked.cmdReceiptData = {
          headline: r.headline,
          detail: r.detail,
          href: r.href,
          hrefLabel: r.hrefLabel,
        };
      } else if (m.cmdReceiptData) {
        baked.cmdReceiptData = m.cmdReceiptData;
      }
      return baked;
    });
  }, []);

  const snapshotIntoTask = useCallback(
    (taskId: string, msgs: RunnerChatMsg[]) => {
      setTaskSnapshot(taskId, bakeMessagesForSnapshot(msgs));
    },
    [bakeMessagesForSnapshot],
  );

  // ── Helpers ──────────────────────────────────────────────────────

  const pushQuinn = useCallback(
    (text: string) => {
      const id = `q-cmd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setMessages((prev) => [...prev, { id, role: 'quinn', text }]);
      return id;
    },
    [setMessages],
  );

  const pushCard = useCallback(
    (commandId: string, msgType: string, args: Record<string, unknown>) => {
      const id = `q-card-${commandId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setMessages((prev) => [
        ...prev,
        {
          id,
          role: 'quinn',
          text: '',
          msgType,
          cmdId: commandId,
          cmdArgsJson: JSON.stringify(args),
        },
      ]);
      writeCmdState(id, 'pending');
      return id;
    },
    [setMessages],
  );

  const pushAmbiguity = useCallback(
    (commandId: string, prompt: string, choices: AmbiguityChoice[]) => {
      const id = `q-amb-${commandId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setMessages((prev) => [
        ...prev,
        {
          id,
          role: 'quinn',
          text: prompt,
          msgType: 'cmd-ambiguity',
          cmdId: commandId,
          cmdChoicesJson: JSON.stringify(choices),
        },
      ]);
      writeCmdState(id, 'pending');
      return id;
    },
    [setMessages],
  );

  const pushReceipt = useCallback(
    (receipt: CommandReceipt, sourceCardId: string) => {
      const id = `q-rcpt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setReceipt(id, receipt);
      const taskId = activeTaskIdRef.current;
      const receiptMsg: RunnerChatMsg = {
        id,
        role: 'quinn',
        text: receipt.headline,
        msgType: 'cmd-receipt',
        cmdId: sourceCardId,
        // Bake the receipt onto the message itself so a restored
        // snapshot can render without re-populating receiptsRef.
        cmdReceiptData: {
          headline: receipt.headline,
          detail: receipt.detail,
          href: receipt.href,
          hrefLabel: receipt.hrefLabel,
        },
      };
      setMessages((prev) => {
        const next = [...prev, receiptMsg];
        // Snapshot the full thread (including the just-added receipt)
        // into the active task. Done inside the updater so we capture
        // the final messages array atomically.
        if (taskId) snapshotIntoTask(taskId, next);
        return next;
      });
      // Upgrade the active task in the history store: title becomes
      // the receipt headline (more descriptive than the launch title),
      // status flips to completed, auto-pinned. Also remember the
      // receipt→task mapping so undo can flip the right entry later.
      if (taskId) {
        completeTask(taskId, {
          title: receipt.headline,
          subtitle: receipt.detail,
          receipt: {
            headline: receipt.headline,
            detail: receipt.detail,
            href: receipt.href,
            hrefLabel: receipt.hrefLabel,
          },
        });
        receiptToTaskRef.current[id] = taskId;
      }
      return id;
    },
    [setMessages, snapshotIntoTask],
  );

  const pushUserEcho = useCallback(
    (text: string) => {
      setMessages((prev) => [...prev, { id: `u-cmd-${Date.now()}`, role: 'user', text }]);
    },
    [setMessages],
  );

  // ── Public entry: kick off a command ─────────────────────────────

  const runCommand = useCallback(
    (intent: CommandIntent, opts: RunCommandOpts = {}) => {
      const cmd = getCommand(intent.commandId);
      if (!cmd) return;
      setChatStarted(true);
      setChatMinimized(false);

      // Fresh tasks start with a clean slate — the chip / new NL
      // invocation shouldn't pile onto whatever the user was doing
      // before. Continuations (ambiguity pick) opt out via
      // freshTask: false.
      if (opts.freshTask !== false) {
        setMessages([]);
        cmdStatesRef.current = {};
        setCmdStates({});
        setCmdUndone({});
        receiptsRef.current = {};
        receiptToTaskRef.current = {};
        onFreshTask?.();

        // Open a new history entry. Title is the command label + the
        // most descriptive arg we have so far (recipe name, supplier
        // name, etc.). The title is upgraded to the receipt headline
        // on completion, but the pending entry still reads sensibly
        // if the user bails halfway.
        const { title, subtitle } = describeTask(intent);
        const t = startTask({ kind: cmd.id as TaskKind, title, subtitle });
        activeTaskIdRef.current = t.id;
      }

      if (opts.userText) pushUserEcho(opts.userText);

      // Ambiguity first.
      if (intent.ambiguous && intent.ambiguous.length > 1) {
        const prompt =
          intent.commandId === 'recipe-edit' || intent.commandId === 'production' || intent.commandId === 'menu'
            ? 'A few recipes match — which one?'
            : intent.commandId === 'supplier'
              ? 'A few suppliers match — which one?'
              : 'A few products match — which one?';
        pushAmbiguity(intent.commandId, prompt, intent.ambiguous);
        return;
      }

      // Queue → fan out into multiple cards (multi-item).
      if (intent.queue && intent.queue.length > 1) {
        pushQuinn(`Logging ${intent.queue.length} items — confirm each below.`);
        for (const argSet of intent.queue) {
          pushCard(cmd.id, cmd.cardMsgType, argSet);
        }
        return;
      }

      // Recipe edit is a multi-step wizard rather than a single card,
      // so route it through its own launcher. The launcher decides
      // which step to start at based on what args the parser already
      // pulled out of the user's text.
      if (intent.commandId === 'recipe-edit') {
        startRecipeEditWizard(intent.args);
        return;
      }

      // Single. Ask for missing requireds first if there are any "hard
      // miss" args (e.g. command was launched from a slash with no
      // detail). When the field is something the card can prompt for
      // inline (productId, itemId, recipeId, field), we still open the
      // card — its empty state guides the user.
      const inlinePromptable = new Set([
        'productId',
        'itemId',
        'recipeId',
        'field',
        'kind',
        'action',
        'supplierId',
      ]);
      const hardMisses = cmd.requiredArgs.filter(
        (a) => intent.args[a] === undefined && !inlinePromptable.has(a),
      );

      if (hardMisses.length > 0) {
        // Ask the first hard-miss; the card will fill the rest.
        pushQuinn(cmd.promptFor(hardMisses[0], intent.args));
        pushCard(cmd.id, cmd.cardMsgType, intent.args);
        return;
      }

      pushCard(cmd.id, cmd.cardMsgType, intent.args);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pushAmbiguity, pushCard, pushQuinn, pushUserEcho, setChatMinimized, setChatStarted],
  );

  // ── Recipe-edit wizard ───────────────────────────────────────────
  //
  // The wizard advances one step at a time. Each step emits a Quinn
  // prompt + a step card; tapping a step card confirms it, echoes the
  // user's pick as a chat bubble, and queues the next step. Args
  // accumulate across steps in `cmdArgsJson`.

  const startRecipeEditWizard = useCallback(
    (args: Record<string, unknown>) => {
      const recipeId = args.recipeId as string | undefined;
      const recipeName = args.recipeName as string | undefined;
      const kind = args.kind as RecipeEditKind | undefined;
      const fromName = args.fromName as string | undefined;
      const toName = args.toName as string | undefined;

      if (!recipeId) {
        pushQuinn('Sure — which recipe would you like to update?');
        pushCard('recipe-edit', 'cmd-recipe-pick-recipe', {});
        return;
      }
      if (!kind) {
        pushQuinn(`Got it — ${recipeName ?? 'that recipe'}. What do you want to change?`);
        pushCard('recipe-edit', 'cmd-recipe-pick-action', { recipeId, recipeName });
        return;
      }
      if ((kind === 'swap' || kind === 'remove') && !fromName) {
        pushQuinn(kind === 'swap' ? 'Which ingredient do you want to swap?' : 'Which ingredient do you want to remove?');
        pushCard('recipe-edit', 'cmd-recipe-pick-ingredient', { recipeId, recipeName, kind });
        return;
      }
      if ((kind === 'add' || kind === 'swap') && !toName) {
        pushQuinn(kind === 'swap' ? `Swap ${fromName} for what?` : 'What would you like to add?');
        pushCard('recipe-edit', 'cmd-recipe-new-ingredient', { recipeId, recipeName, kind, fromName });
        return;
      }
      // Everything filled in — jump straight to the summary.
      pushQuinn('Here\u2019s what I\u2019ll do — review and confirm.');
      pushCard('recipe-edit', 'cmd-recipe-summary', { recipeId, recipeName, kind, fromName, toName, qty: args.qty, uom: args.uom });
    },
    [pushCard, pushQuinn],
  );

  const pickRecipeForEdit = useCallback(
    (msgId: string, recipeId: string, recipeName: string) => {
      writeCmdState(msgId, 'confirmed');
      pushUserEcho(recipeName);
      pushQuinn(`Got it — ${recipeName}. What do you want to change?`);
      pushCard('recipe-edit', 'cmd-recipe-pick-action', { recipeId, recipeName });
    },
    [pushCard, pushQuinn, pushUserEcho],
  );

  const pickRecipeActionForEdit = useCallback(
    (msgId: string, args: { recipeId: string; recipeName: string }, kind: RecipeEditKind) => {
      writeCmdState(msgId, 'confirmed');
      const verb = kind === 'swap' ? 'Swap an ingredient' : kind === 'add' ? 'Add an ingredient' : 'Remove an ingredient';
      pushUserEcho(verb);
      if (kind === 'add') {
        pushQuinn('What would you like to add?');
        pushCard('recipe-edit', 'cmd-recipe-new-ingredient', { ...args, kind });
      } else {
        pushQuinn(kind === 'swap' ? 'Which ingredient do you want to swap?' : 'Which ingredient do you want to remove?');
        pushCard('recipe-edit', 'cmd-recipe-pick-ingredient', { ...args, kind });
      }
    },
    [pushCard, pushQuinn, pushUserEcho],
  );

  const pickRecipeIngredientForEdit = useCallback(
    (
      msgId: string,
      args: { recipeId: string; recipeName: string; kind: RecipeEditKind },
      ingredientName: string,
    ) => {
      writeCmdState(msgId, 'confirmed');
      pushUserEcho(ingredientName);
      if (args.kind === 'remove') {
        pushQuinn(`Remove ${ingredientName} from ${args.recipeName} — ready to apply?`);
        pushCard('recipe-edit', 'cmd-recipe-summary', { ...args, fromName: ingredientName });
      } else {
        pushQuinn(`Swap ${ingredientName} for what?`);
        pushCard('recipe-edit', 'cmd-recipe-new-ingredient', { ...args, fromName: ingredientName });
      }
    },
    [pushCard, pushQuinn, pushUserEcho],
  );

  const submitRecipeNewIngredient = useCallback(
    (
      msgId: string,
      args: { recipeId: string; recipeName: string; kind: RecipeEditKind; fromName?: string },
      input: { name: string; qty?: number; uom?: string },
    ) => {
      writeCmdState(msgId, 'confirmed');
      const echo = input.qty != null ? `${input.name} (${input.qty}${input.uom ?? ''})` : input.name;
      pushUserEcho(echo);
      pushQuinn('Here\u2019s the change — review and confirm.');
      pushCard('recipe-edit', 'cmd-recipe-summary', {
        ...args,
        toName: input.name,
        qty: input.qty,
        uom: input.uom,
      });
    },
    [pushCard, pushQuinn, pushUserEcho],
  );

  // ── Cancel ───────────────────────────────────────────────────────

  const cancelCard = useCallback((msgId: string) => {
    writeCmdState(msgId, 'cancelled');
    // Any cancel in the wizard collapses the whole task. The user's
    // intent was "bail" — the history list should reflect that rather
    // than a half-done pending entry.
    const taskId = activeTaskIdRef.current;
    if (taskId) {
      cancelTask(taskId);
      // Snapshot the thread (with the just-cancelled state baked
      // in) by peeking at messages inside a no-op setMessages updater.
      setMessages((prev) => {
        snapshotIntoTask(taskId, prev);
        return prev;
      });
    }
  }, [setMessages, snapshotIntoTask, writeCmdState]);

  // ── Confirm handlers, one per command ────────────────────────────
  // Each commits the mutation and pushes a receipt.

  const confirmWaste = useCallback(
    (
      msgId: string,
      final: { productId: string; qty: number; uom: string; reasonId: WasteReasonId },
    ) => {
      const product = getWasteProduct(final.productId);
      if (!product) return;
      const reason = WASTE_REASONS.find((r) => r.id === final.reasonId);
      const entry = appendWasteEntry({
        productId: final.productId,
        qty: final.qty,
        uom: final.uom,
        reasonId: final.reasonId,
      });
      const value = (product.unitCost * final.qty).toFixed(2);
      const receipt: CommandReceipt = {
        headline: `Logged · ${final.qty} ${product.name}${final.qty === 1 ? '' : 's'}`,
        detail: `${reason?.label ?? 'No reason'} · £${value}`,
        href: '/log-waste',
        hrefLabel: 'Open log',
        undo: () => {
          removeWasteEntry(entry.id);
        },
      };
      writeCmdState(msgId, 'confirmed');
      pushReceipt(receipt, msgId);
    },
    [pushReceipt],
  );

  const confirmStock = useCallback(
    (
      msgId: string,
      final: {
        itemId: string;
        itemName: string;
        qty: number;
        uom: string;
        location?: string;
        expectedQty: number | null;
      },
    ) => {
      const entry = saveCount({
        itemId: final.itemId,
        itemName: final.itemName,
        qty: final.qty,
        uom: final.uom,
        location: final.location,
        expectedQty: final.expectedQty,
      });
      const variance = final.expectedQty !== null ? final.qty - final.expectedQty : null;
      const varianceCopy =
        variance === null
          ? ''
          : variance === 0
            ? ' · matches expected'
            : ` · expected ${final.expectedQty}, variance ${variance > 0 ? '+' : '−'}${Math.abs(variance)}`;
      const receipt: CommandReceipt = {
        headline: `Saved count · ${final.qty} ${final.uom} ${final.itemName}`,
        detail: `${final.location ? final.location + varianceCopy : varianceCopy.replace(/^ · /, '')}`,
        href: '/stock?tab=stocktake',
        hrefLabel: 'Open stocktake',
        undo: () => {
          removeCount(entry.id);
        },
      };
      writeCmdState(msgId, 'confirmed');
      pushReceipt(receipt, msgId);
    },
    [pushReceipt],
  );

  const confirmRecipeEdit = useCallback(
    (
      msgId: string,
      final: {
        recipeId: string;
        recipeName: string;
        kind: RecipeEditKind;
        fromName?: string;
        toName?: string;
        qty?: number;
        uom?: string;
        scope: 'all' | 'site';
        siteLabel?: string;
      },
    ) => {
      const recipe = findRecipe(final.recipeId);
      if (!recipe) return;
      // Snapshot the old recipe for Undo.
      const before = recipe;
      const next: Recipe = { ...recipe };

      // We don't have a real ingredient editor here — for the
      // prototype we operate on the legacy `ingredients` array
      // (string-shaped) because that's what every fixture has. This
      // way the read-only drawer reflects the change.
      const list = [...(next.ingredients ?? [])];
      if (final.kind === 'remove' && final.fromName) {
        const idx = list.findIndex((i) => i.name.toLowerCase().includes(final.fromName!.toLowerCase()));
        if (idx >= 0) list.splice(idx, 1);
      } else if (final.kind === 'swap' && final.fromName && final.toName) {
        const idx = list.findIndex((i) => i.name.toLowerCase().includes(final.fromName!.toLowerCase()));
        if (idx >= 0) {
          list[idx] = { ...list[idx], name: final.toName };
        } else {
          list.push({ name: final.toName, qty: '', supplier: '' });
        }
      } else if (final.kind === 'add' && final.toName) {
        const qtyStr = final.qty !== undefined ? `${final.qty}${final.uom ?? ''}` : '';
        list.push({ name: final.toName, qty: qtyStr, supplier: '' });
      }
      next.ingredients = list;
      updateRecipe(next);

      let headline: string;
      if (final.kind === 'swap')        headline = `Swapped · ${final.fromName} → ${final.toName} on ${final.recipeName}`;
      else if (final.kind === 'remove') headline = `Removed · ${final.fromName} from ${final.recipeName}`;
      else                              headline = `Added · ${final.toName} to ${final.recipeName}`;

      const detail = final.scope === 'site' ? `Just ${final.siteLabel}` : 'Applied to all sites';

      const receipt: CommandReceipt = {
        headline,
        detail,
        href: `/recipes/${final.recipeId}/edit`,
        hrefLabel: 'Open recipe',
        undo: () => {
          updateRecipe(before);
        },
      };
      writeCmdState(msgId, 'confirmed');
      pushReceipt(receipt, msgId);
    },
    [pushReceipt],
  );

  const confirmProduction = useCallback(
    (
      msgId: string,
      final: {
        recipeId: string;
        recipeName: string;
        field: ProductionField;
        value?: number;
        boolValue?: boolean;
        previousValue: number | boolean | null;
      },
    ) => {
      const recipe = findRecipe(final.recipeId);
      if (!recipe) return;
      const before = recipe;
      const next: Recipe = { ...recipe, production: { ...recipe.production } };

      // We only mutate the slim production object for shelf life /
      // prep time. Batch and cutoff fields live in `formExtras.production`
      // — we update that branch too where it exists.
      if (final.field === 'shelfLife' && final.value !== undefined) {
        next.production.shelfLifeMinutes = final.value;
      }
      if (final.field === 'prepTime' && final.value !== undefined) {
        next.production.prepTimeSeconds = final.value * 60;
      }
      if (final.field === 'carryOver' && final.boolValue !== undefined) {
        next.formExtras = {
          ...next.formExtras,
          advanced: { ...(next.formExtras?.advanced ?? {}), allowCarryOver: final.boolValue },
        };
      }
      if (final.field === 'batchMin' && final.value !== undefined) {
        next.formExtras = {
          ...next.formExtras,
          productionExtras: { ...(next.formExtras?.productionExtras ?? {}), minBatch: final.value },
        };
      }
      if (final.field === 'batchMax' && final.value !== undefined) {
        next.formExtras = {
          ...next.formExtras,
          productionExtras: { ...(next.formExtras?.productionExtras ?? {}), maxBatch: final.value },
        };
      }
      if (final.field === 'closingCutoff' && final.value !== undefined) {
        const label = final.value === 0 ? 'No limit' : `${final.value} min before close`;
        next.formExtras = {
          ...next.formExtras,
          advanced: { ...(next.formExtras?.advanced ?? {}), closingRange: label },
        };
      }
      updateRecipe(next);

      const fieldLabels: Record<ProductionField, string> = {
        batchMin: 'Batch min',
        batchMax: 'Batch size',
        shelfLife: 'Shelf life',
        prepTime: 'Prep time',
        carryOver: 'Carry-over',
        closingCutoff: 'Closing cutoff',
      };
      let valueDisplay: string;
      if (final.boolValue !== undefined) {
        valueDisplay = final.boolValue ? 'Allowed' : 'Blocked';
      } else if (final.field === 'shelfLife' && final.value !== undefined) {
        valueDisplay = final.value >= 60 ? `${(final.value / 60).toFixed(final.value % 60 ? 1 : 0)}h` : `${final.value} min`;
      } else if (final.field === 'prepTime' && final.value !== undefined) {
        valueDisplay = `${final.value} min`;
      } else if (final.field === 'closingCutoff' && final.value !== undefined) {
        valueDisplay = final.value === 0 ? 'No cutoff' : `${final.value} min before close`;
      } else {
        valueDisplay = String(final.value);
      }

      const receipt: CommandReceipt = {
        headline: `${fieldLabels[final.field]} · ${valueDisplay}`,
        detail: `Set on ${final.recipeName}`,
        href: `/recipes/${final.recipeId}/edit`,
        hrefLabel: 'Open recipe',
        undo: () => {
          updateRecipe(before);
        },
      };
      writeCmdState(msgId, 'confirmed');
      pushReceipt(receipt, msgId);
    },
    [pushReceipt],
  );

  const confirmMenu = useCallback(
    (
      msgId: string,
      final: {
        recipeId: string;
        recipeName: string;
        action: MenuAction;
        price?: number;
        priceDelta?: number;
        previousPrice: number;
        previousAvailable: boolean;
      },
    ) => {
      const recipe = findRecipe(final.recipeId);
      if (!recipe) return;
      const before = recipe;
      const next: Recipe = { ...recipe };

      if (final.action === 'availability-off') next.posLinked = false;
      else if (final.action === 'availability-on') next.posLinked = true;
      else if (final.action === 'price-set' && final.price !== undefined) {
        next.priceDineIn = final.price;
        next.priceTakeaway = final.price;
        next.priceDelivery = final.price;
        // Re-derive margin against the existing ingredient cost.
        if (final.price > 0) next.marginPct = ((final.price - recipe.ingredientCost) / final.price) * 100;
      } else if (final.action === 'price-delta' && final.priceDelta !== undefined) {
        const newPrice = recipe.priceDineIn + final.priceDelta;
        next.priceDineIn = newPrice;
        next.priceTakeaway = newPrice;
        next.priceDelivery = newPrice;
        if (newPrice > 0) next.marginPct = ((newPrice - recipe.ingredientCost) / newPrice) * 100;
      }
      updateRecipe(next);

      let headline: string;
      let detail: string;
      if (final.action === 'availability-off') {
        headline = `84'd · ${final.recipeName}`;
        detail = 'Unavailable on POS until put back on';
      } else if (final.action === 'availability-on') {
        headline = `Back on · ${final.recipeName}`;
        detail = 'Available on POS';
      } else if (final.action === 'price-set' && final.price !== undefined) {
        headline = `Price set · ${final.recipeName} · £${final.price.toFixed(2)}`;
        detail = `was £${final.previousPrice.toFixed(2)}`;
      } else if (final.action === 'price-delta' && final.priceDelta !== undefined) {
        const newPrice = final.previousPrice + final.priceDelta;
        headline = `Price adjusted · ${final.recipeName} · £${newPrice.toFixed(2)}`;
        detail = `${final.priceDelta > 0 ? '+' : ''}£${final.priceDelta.toFixed(2)} vs £${final.previousPrice.toFixed(2)}`;
      } else {
        headline = `Updated · ${final.recipeName}`;
        detail = '';
      }

      const receipt: CommandReceipt = {
        headline,
        detail,
        href: `/recipes/${final.recipeId}/edit`,
        hrefLabel: 'Open recipe',
        undo: () => {
          updateRecipe(before);
        },
      };
      writeCmdState(msgId, 'confirmed');
      pushReceipt(receipt, msgId);
    },
    [pushReceipt],
  );

  const confirmSupplier = useCallback(
    (
      msgId: string,
      final: {
        supplierId: string;
        supplierName: string;
        field: SupplierField;
        valueRaw: string;
        valueNormalised: string | number | DayOfWeek[];
        previousValue: string | number | DayOfWeek[] | undefined;
      },
    ) => {
      const supplier = findSupplier(final.supplierId);
      if (!supplier) return;
      const before = supplier;
      const next: Supplier = { ...supplier, [final.field]: final.valueNormalised } as Supplier;
      upsertSupplier(next);

      const labels: Record<SupplierField, string> = {
        cutOffTime: 'Cut-off',
        leadTimeDays: 'Lead time',
        minimumOrderValue: 'MOV',
        deliveryDays: 'Delivery days',
        email: 'Email',
        phone: 'Phone',
      };

      let display: string;
      if (final.field === 'deliveryDays' && Array.isArray(final.valueNormalised)) {
        display = (final.valueNormalised as DayOfWeek[]).join(', ');
      } else if (final.field === 'leadTimeDays') {
        const n = Number(final.valueNormalised);
        display = `${n} day${n === 1 ? '' : 's'}`;
      } else if (final.field === 'minimumOrderValue') {
        display = `£${final.valueNormalised}`;
      } else {
        display = String(final.valueNormalised);
      }

      const receipt: CommandReceipt = {
        headline: `${labels[final.field]} · ${display}`,
        detail: `Saved on ${final.supplierName}`,
        href: `/suppliers/${final.supplierId}`,
        hrefLabel: 'Open supplier',
        undo: () => {
          upsertSupplier(before);
        },
      };
      writeCmdState(msgId, 'confirmed');
      pushReceipt(receipt, msgId);
    },
    [pushReceipt],
  );

  // ── Ambiguity pick → re-emit the command with the chosen args ───

  const pickAmbiguity = useCallback(
    (msgId: string, commandId: string, choice: AmbiguityChoice) => {
      writeCmdState(msgId, 'confirmed');
      const cmd = getCommand(commandId);
      if (!cmd) return;
      // Continuation — keep the existing thread (the disambiguation
      // message + the user's pick) so context is preserved.
      runCommand({ commandId: cmd.id, args: choice.args, confidence: 1 }, { freshTask: false });
    },
    [runCommand],
  );

  // ── Undo handling ────────────────────────────────────────────────

  const undoReceipt = useCallback((receiptMsgId: string) => {
    const r = getReceipt(receiptMsgId);
    r?.undo?.();
    setCmdUndone((prev) => ({ ...prev, [receiptMsgId]: true }));
    const taskId = receiptToTaskRef.current[receiptMsgId];
    if (taskId) markTaskUndone(taskId);
  }, []);

  // ── Restore + arbitrary-task snapshotting ───────────────────────

  /** Replace the live chat thread with a snapshot from history. All
   *  runtime maps (cmdStates, receiptsRef, receiptToTaskRef) are
   *  cleared since the restored cards carry baked-in state. Calling
   *  this also drops `activeTaskIdRef` — any subsequent action starts
   *  a fresh task rather than mutating the historical one. */
  const restoreMessages = useCallback(
    (snapshot: StoredChatMessage[]) => {
      cmdStatesRef.current = {};
      // Rehydrate the live cmdStates map from the baked-in states so
      // the renderer still picks up the right pill (Done / Cancelled)
      // even while the runner's map is technically "live".
      const liveStates: Record<string, CardState> = {};
      for (const m of snapshot) {
        if (m.cmdState) liveStates[m.id] = m.cmdState;
      }
      cmdStatesRef.current = liveStates;
      setCmdStates(liveStates);
      setCmdUndone({});
      receiptsRef.current = {};
      receiptToTaskRef.current = {};
      activeTaskIdRef.current = null;
      setMessages(snapshot as RunnerChatMsg[]);
      setChatStarted(true);
      setChatMinimized(false);
    },
    [setChatMinimized, setChatStarted, setMessages],
  );

  /** Public hook for Feed.tsx to flush its current thread into an
   *  arbitrary task. Used by the analytics + free-chat sendMessage
   *  paths (their tasks are logged externally via the store's
   *  `logEntry`, not by the runner). */
  const snapshotTask = useCallback(
    (taskId: string) => {
      setMessages((prev) => {
        snapshotIntoTask(taskId, prev);
        return prev;
      });
    },
    [setMessages, snapshotIntoTask],
  );

  return {
    cmdStates,
    cmdUndone,
    getReceipt,
    runCommand,
    cancelCard,
    confirmWaste,
    confirmStock,
    confirmRecipeEdit,
    confirmProduction,
    confirmMenu,
    confirmSupplier,
    pickAmbiguity,
    pickRecipeForEdit,
    pickRecipeActionForEdit,
    pickRecipeIngredientForEdit,
    submitRecipeNewIngredient,
    undoReceipt,
    restoreMessages,
    snapshotTask,
  };
}

/** Pick a sensible initial title + subtitle for a freshly opened task
 *  given just the parsed intent. The title is the command label;
 *  subtitle gets the first identifiable target arg (recipe / supplier
 *  / item / product name). Completion later upgrades the title to the
 *  receipt headline, which is more specific. */
function describeTask(intent: CommandIntent): { title: string; subtitle?: string } {
  const cmd = getCommand(intent.commandId);
  const label = cmd?.chipLabel ?? 'Task';
  const args = intent.args as Record<string, unknown>;
  const candidates: (string | undefined)[] = [
    args.recipeName as string | undefined,
    args.supplierName as string | undefined,
    args.itemName as string | undefined,
    args.productName as string | undefined,
  ];
  const target = candidates.find((c): c is string => typeof c === 'string' && c.length > 0);
  return target ? { title: label, subtitle: target } : { title: label };
}
