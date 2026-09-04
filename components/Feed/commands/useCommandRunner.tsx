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
import {
  findRecipe,
  updateRecipe,
  snapshotRecipes,
  setRecipes,
} from '@/components/Recipe/recipeStore';
import {
  findSupplier,
  upsertSupplier,
  findProduct,
  upsertProduct,
  upsertMasterProduct,
  snapshot as snapshotSuppliersStore,
  restore as restoreSuppliersStore,
  genId,
} from '@/components/Suppliers/store';
import type {
  Supplier,
  Product,
  DayOfWeek,
  ProductCategory,
  Allergen,
  AltUom,
} from '@/components/Suppliers/fixtures';
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
import { useActiveSite } from '@/components/ActiveSite/ActiveSiteContext';
import { computeDayPlan, useFjPlanStoreOptional } from '@/components/Production/farmerj/FjPlanStore';
import { FJ_DEMO_TODAY, longDay, shortDate } from '@/components/Production/farmerj/calendar';
import { batchesToNumber } from '@/components/Production/farmerj/cascade';
import { FJ_ALL_SHOPS_ID, getShop } from '@/components/Production/farmerj/shops';
import { publishFjSetup, resolveFjSetup, type FjSetupArgs } from '@/components/Production/farmerj/setupCommand';
import { describeImpact, snapshotImpact } from '@/components/Production/farmerj/publishImpact';
import { useSiteSettingsStore } from '@/components/Settings/siteSettingsStore';
import type {
  RecipeEditKind,
  ProductionField,
  MenuAction,
  SupplierField,
} from './parsers';
import type { Recipe, RecipeIngredient } from '@/components/Recipe/libraryFixtures';
import { makeRecipeIngredient, ALL_LIBRARY_RECIPES } from '@/components/Recipe/libraryFixtures';
import {
  startTask,
  completeTask,
  cancelTask,
  markTaskUndone,
  setTaskSnapshot,
  recordChanges,
  setCommandIntent,
  markReverted,
  markSuperseded,
  logChildTask,
  markGroupParent,
  type TaskKind,
  type StoredChatMessage,
  type ChangeRecord,
  type BlastRadiusLine,
} from '@/components/Feed/taskHistoryStore';
import {
  diffRecipeEdit,
  diffProduction,
  diffMenu,
  diffSupplier,
  diffProductSwap,
  splitProductSwapPerRecipe,
  diffWaste,
  diffStock,
} from '@/components/Feed/commands/diffs';
import {
  WORKDAY_NEW_SITES,
  describeRoleCounts,
  describeTierPattern,
  getTemplateShop,
  getWorkdaySite,
  roleCounts,
  type DayKey,
  type EdifyRole,
  type SiteBenchesHot,
  type SiteProductionSchedules,
} from '@/components/Feed/commands/siteSetupFixtures';
import { addSites as addRegisterSites, removeSites as removeRegisterSites } from '@/components/Settings/sitesRegisterStore';

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
  /** When true, the renderer reveals the text character-by-character
   *  on mount with a blinking caret — used for wizard bridge text so
   *  the AI feels like it's composing the response live. */
  streaming?: boolean;
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
  //   • pendingLinkRef   — when the next task completes, link it back
  //     to a prior one (Revert / Edit replay). Consumed inside
  //     pushReceipt and cleared so it only fires once per replay.
  const activeTaskIdRef = useRef<string | null>(null);
  const receiptToTaskRef = useRef<Record<string, string>>({});
  const cmdStatesRef = useRef<Record<string, CardState>>({});
  const pendingLinkRef = useRef<
    | { kind: 'revert'; originalTaskId: string }
    | { kind: 'supersede'; originalTaskId: string }
    | null
  >(null);

  /** Centralised wrapper around recordChanges. Reads activeTaskIdRef
   *  so each confirm function doesn't have to. No-ops when there's no
   *  active task (e.g. a confirm fired without a prior runCommand,
   *  which shouldn't happen but isn't fatal if it does). */
  const recordTaskChanges = useCallback(
    (input: {
      changes: ChangeRecord[];
      blastRadius?: BlastRadiusLine[];
      commandIntent?: { commandId: string; cardMsgType: string; args: Record<string, unknown> };
    }) => {
      const taskId = activeTaskIdRef.current;
      if (!taskId) return;
      recordChanges(taskId, {
        changes: input.changes,
        blastRadius: input.blastRadius,
      });
      if (input.commandIntent) {
        setCommandIntent(taskId, input.commandIntent);
      }
    },
    [],
  );

  /** Single-source-of-truth setter for cmdStates so the mirror ref
   *  always matches React state. Use this instead of calling
   *  `setCmdStates` directly. */
  const writeCmdState = useCallback((msgId: string, state: CardState) => {
    cmdStatesRef.current = { ...cmdStatesRef.current, [msgId]: state };
    setCmdStates(cmdStatesRef.current);
  }, []);

  /** Bake the runtime card states + receipts into a plain message
   *  array, so a snapshot is self-contained (no runtime ref lookups
   *  needed when it's restored later). Transient "thinking" bubbles
   *  are stripped — they're step-transition decoration, not part of
   *  the replayable thread. */
  const bakeMessagesForSnapshot = useCallback((msgs: RunnerChatMsg[]): StoredChatMessage[] => {
    return msgs.filter((m) => m.msgType !== 'cmd-thinking').map((m) => {
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

  /**
   * Push a short "thinking" bubble, then replace it with a real card.
   * Used between wizard steps so the user gets a beat of breathing
   * room — and a visible "Edify is preparing the next question"
   * signal — instead of the next card popping in instantly. Mirrors
   * the `analytics-thinking` pattern used on chart/text answers.
   *
   * We capture the active task id at push time and only emit the next
   * card if the task is still that same task — protects against the
   * user cancelling the wizard while a thinking bubble is in flight.
   */
  const pushThinkingThenCard = useCallback(
    (
      commandId: string,
      msgType: string,
      args: Record<string, unknown>,
      delayMs: number = 650,
    ) => {
      const thinkingId = `q-thinking-${commandId}-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 6)}`;
      setMessages((prev) => [
        ...prev,
        { id: thinkingId, role: 'quinn', text: '', msgType: 'cmd-thinking' },
      ]);
      const cardId = `q-card-${commandId}-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 6)}`;
      const taskAtPush = activeTaskIdRef.current;
      window.setTimeout(() => {
        if (activeTaskIdRef.current !== taskAtPush) {
          // Task changed (cancelled, or a new command started) — drop
          // the now-irrelevant thinking bubble and skip the card.
          setMessages((prev) => prev.filter((m) => m.id !== thinkingId));
          return;
        }
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== thinkingId),
          {
            id: cardId,
            role: 'quinn',
            text: '',
            msgType,
            cmdId: commandId,
            cmdArgsJson: JSON.stringify(args),
          },
        ]);
        writeCmdState(cardId, 'pending');
      }, delayMs);
      return cardId;
    },
    [setMessages, writeCmdState],
  );

  /**
   * Full wizard transition: thinking bubble → streaming bridge text →
   * next card. Replaces the old `pushQuinn(text); pushThinkingThenCard(...)`
   * pair so the AI feels like it's composing a response in real time.
   *
   * Timing (rough):
   *   • THINKING_MS         (~900ms)  thinking dots appear
   *   • text streams in     (~text.length * 18ms, clamped)
   *   • POST_STREAM_MS      (~350ms)  brief beat after the text settles
   *   • next card appears
   *
   * Same task-id gating as `pushThinkingThenCard` so a cancelled
   * wizard doesn't drop in stale text or a phantom card.
   */
  const pushResponseFlow = useCallback(
    (opts: {
      text: string;
      commandId: string;
      cardMsgType: string;
      cardArgs: Record<string, unknown>;
      /** Override the thinking-dots duration (default ~900ms). Longer
       *  pauses sell "the AI is actually working" on flows that parse
       *  a whole sentence into a prefilled card. */
      thinkingMs?: number;
    }) => {
      const THINKING_MS = opts.thinkingMs ?? 900;
      const POST_STREAM_MS = 350;
      const PER_CHAR_MS = 18;
      const STREAM_MIN_MS = 700;
      const STREAM_MAX_MS = 2200;
      const streamMs = Math.min(
        STREAM_MAX_MS,
        Math.max(STREAM_MIN_MS, opts.text.length * PER_CHAR_MS),
      );

      const thinkingId = `q-thinking-${opts.commandId}-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 6)}`;
      const textId = `q-text-${opts.commandId}-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 6)}`;
      const cardId = `q-card-${opts.commandId}-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 6)}`;
      const taskAtPush = activeTaskIdRef.current;

      setMessages((prev) => [
        ...prev,
        { id: thinkingId, role: 'quinn', text: '', msgType: 'cmd-thinking' },
      ]);

      // Step 1 → swap thinking bubble for streaming text.
      window.setTimeout(() => {
        if (activeTaskIdRef.current !== taskAtPush) {
          setMessages((prev) => prev.filter((m) => m.id !== thinkingId));
          return;
        }
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== thinkingId),
          { id: textId, role: 'quinn', text: opts.text, streaming: true },
        ]);
      }, THINKING_MS);

      // Step 2 → after text has streamed in, append the next card.
      window.setTimeout(() => {
        if (activeTaskIdRef.current !== taskAtPush) return;
        setMessages((prev) => [
          ...prev,
          {
            id: cardId,
            role: 'quinn',
            text: '',
            msgType: opts.cardMsgType,
            cmdId: opts.commandId,
            cmdArgsJson: JSON.stringify(opts.cardArgs),
          },
        ]);
        writeCmdState(cardId, 'pending');
      }, THINKING_MS + streamMs + POST_STREAM_MS);

      return cardId;
    },
    [setMessages, writeCmdState],
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
        // Consume any pending revert/supersede link. The Activity
        // page sets these before pushing the replay card; we don't
        // want them to leak across into the next unrelated task, so
        // clear once consumed.
        const pending = pendingLinkRef.current;
        if (pending) {
          if (pending.kind === 'revert') markReverted(pending.originalTaskId, taskId);
          else markSuperseded(pending.originalTaskId, taskId);
          pendingLinkRef.current = null;
        }
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
      // Product-swap is also a wizard. The launcher walks the
      // operator through new product + supplier + replacement target
      // + recipe selection + summary, skipping any step whose args
      // the parser already populated.
      if (intent.commandId === 'product-swap') {
        startProductSwapWizard(intent.args);
        return;
      }
      // Site setup is a six-step wizard: pick from Workday → copy a
      // shop → load the people → ranges & tiers → production → go live.
      if (intent.commandId === 'site-setup') {
        startSiteSetupWizard(intent.args);
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

      // Supplier updates parsed straight from a sentence get the full
      // staged reveal: a long thinking pause (the "AI is reading your
      // message" beat), a streamed confirmation line, then the card —
      // which animates its own fields filling in (see
      // SupplierFieldCard's intro animation).
      if (intent.commandId === 'supplier') {
        const supplierName = intent.args.supplierName as string | undefined;
        const fields = intent.args.fields as { field: SupplierField; value?: string }[] | undefined;
        const withValues = (fields ?? []).filter((f) => f.value);
        if (supplierName && withValues.length > 0) {
          const label: Record<SupplierField, string> = {
            cutOffTime: 'order cut-off',
            leadTimeDays: 'lead time',
            minimumOrderValue: 'minimum order',
            deliveryDays: 'delivery days',
            email: 'order email',
            phone: 'phone',
            contactName: 'contact name',
            accountsEmail: 'accounts email',
            companyAccountNumber: 'account number',
            notes: 'notes',
          };
          const display = (f: { field: SupplierField; value?: string }): string => {
            if (f.field === 'leadTimeDays') return `${f.value} day${f.value === '1' ? '' : 's'}`;
            if (f.field === 'minimumOrderValue') return `£${f.value}`;
            if (f.field === 'deliveryDays') return (f.value ?? '').split(',').join(', ');
            return f.value ?? '';
          };
          const parts = withValues.map((f) => `${label[f.field]} → ${display(f)}`);
          const listed = parts.length > 1
            ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
            : parts[0];
          pushResponseFlow({
            text: `I've filled in ${listed} for **${supplierName}** — check it over and hit ${withValues.length > 1 ? 'Save changes' : 'Save change'} when you're happy.`,
            commandId: cmd.id,
            cardMsgType: cmd.cardMsgType,
            cardArgs: intent.args,
            thinkingMs: 7500,
          });
          return;
        }
      }

      pushCard(cmd.id, cmd.cardMsgType, intent.args);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pushAmbiguity, pushCard, pushQuinn, pushResponseFlow, pushUserEcho, setChatMinimized, setChatStarted],
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
        pushResponseFlow({
          text: 'Sure — which recipe would you like to update?',
          commandId: 'recipe-edit',
          cardMsgType: 'cmd-recipe-pick-recipe',
          cardArgs: {},
        });
        return;
      }
      if (!kind) {
        pushResponseFlow({
          text: `Got it — ${recipeName ?? 'that recipe'}. What do you want to change?`,
          commandId: 'recipe-edit',
          cardMsgType: 'cmd-recipe-pick-action',
          cardArgs: { recipeId, recipeName },
        });
        return;
      }
      if ((kind === 'swap' || kind === 'remove') && !fromName) {
        pushResponseFlow({
          text:
            kind === 'swap'
              ? 'Which ingredient do you want to swap?'
              : 'Which ingredient do you want to remove?',
          commandId: 'recipe-edit',
          cardMsgType: 'cmd-recipe-pick-ingredient',
          cardArgs: { recipeId, recipeName, kind },
        });
        return;
      }
      if ((kind === 'add' || kind === 'swap') && !toName) {
        pushResponseFlow({
          text: kind === 'swap' ? `Swap ${fromName} for what?` : 'What would you like to add?',
          commandId: 'recipe-edit',
          cardMsgType: 'cmd-recipe-new-ingredient',
          cardArgs: { recipeId, recipeName, kind, fromName },
        });
        return;
      }
      // Everything filled in — jump straight to the summary.
      pushResponseFlow({
        text: 'Here\u2019s what I\u2019ll do — review and confirm.',
        commandId: 'recipe-edit',
        cardMsgType: 'cmd-recipe-summary',
        cardArgs: { recipeId, recipeName, kind, fromName, toName, qty: args.qty, uom: args.uom },
      });
    },
    [pushResponseFlow],
  );

  const pickRecipeForEdit = useCallback(
    (msgId: string, recipeId: string, recipeName: string) => {
      writeCmdState(msgId, 'confirmed');
      pushUserEcho(recipeName);
      pushResponseFlow({
        text: `Got it — ${recipeName}. What do you want to change?`,
        commandId: 'recipe-edit',
        cardMsgType: 'cmd-recipe-pick-action',
        cardArgs: { recipeId, recipeName },
      });
    },
    [pushResponseFlow, pushUserEcho],
  );

  const pickRecipeActionForEdit = useCallback(
    (msgId: string, args: { recipeId: string; recipeName: string }, kind: RecipeEditKind) => {
      writeCmdState(msgId, 'confirmed');
      const verb = kind === 'swap' ? 'Swap an ingredient' : kind === 'add' ? 'Add an ingredient' : 'Remove an ingredient';
      pushUserEcho(verb);
      if (kind === 'add') {
        pushResponseFlow({
          text: 'What would you like to add?',
          commandId: 'recipe-edit',
          cardMsgType: 'cmd-recipe-new-ingredient',
          cardArgs: { ...args, kind },
        });
      } else {
        pushResponseFlow({
          text:
            kind === 'swap'
              ? 'Which ingredient do you want to swap?'
              : 'Which ingredient do you want to remove?',
          commandId: 'recipe-edit',
          cardMsgType: 'cmd-recipe-pick-ingredient',
          cardArgs: { ...args, kind },
        });
      }
    },
    [pushResponseFlow, pushUserEcho],
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
        pushResponseFlow({
          text: `Remove ${ingredientName} from ${args.recipeName} — ready to apply?`,
          commandId: 'recipe-edit',
          cardMsgType: 'cmd-recipe-summary',
          cardArgs: { ...args, fromName: ingredientName },
        });
      } else {
        pushResponseFlow({
          text: `Swap ${ingredientName} for what?`,
          commandId: 'recipe-edit',
          cardMsgType: 'cmd-recipe-new-ingredient',
          cardArgs: { ...args, fromName: ingredientName },
        });
      }
    },
    [pushResponseFlow, pushUserEcho],
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
      pushResponseFlow({
        text: 'Here\u2019s the change — review and confirm.',
        commandId: 'recipe-edit',
        cardMsgType: 'cmd-recipe-summary',
        cardArgs: {
          ...args,
          toName: input.name,
          qty: input.qty,
          uom: input.uom,
        },
      });
    },
    [pushResponseFlow, pushUserEcho],
  );

  // ── Product wizard (add or replace) ──────────────────────────────
  //
  // Up-to-seven-step flow. Each step's confirm pushes the next step's
  // card with the accumulated args. The launcher routes the first
  // step based on what the NL parser already filled in:
  //
  //   • If the parser inferred mode (e.g. "add oat milk to all
  //     coffees" → add, "replace whole milk with oat milk" →
  //     replace), we skip the purpose card and go straight to the
  //     product-info step with the mode baked in.
  //   • Otherwise we ask up front via the purpose card. Branching
  //     here — rather than in the middle of the flow — keeps the
  //     mental model simple: "which job is this?" then "fill the
  //     details".
  //
  // The two paths share most cards. The differences:
  //
  //   • Replace path includes a pick-replaced step (which existing
  //     product is going away?) and pre-fills pack details from it.
  //   • Add path skips pick-replaced and the recipe-picker collects a
  //     per-recipe quantity instead.

  const startProductSwapWizard = useCallback(
    (args: Record<string, unknown>) => {
      const mode = args.mode as 'add' | 'replace' | undefined;
      if (mode) {
        // Mode already inferred — skip the purpose card.
        const opener =
          mode === 'add'
            ? "Let's add a new product to your recipes. First — what's it called, and who's the supplier?"
            : "Let's replace a product across your recipes. First — what's the new one called, and who's the supplier?";
        pushResponseFlow({
          text: opener,
          commandId: 'product-swap',
          cardMsgType: 'cmd-product-new-info',
          cardArgs: {
            mode,
            ...(args.newProductName ? { newProductName: args.newProductName } : {}),
            ...(args.oldProductName ? { oldProductHint: args.oldProductName } : {}),
          },
        });
        return;
      }
      // Ambiguous launch (bare slash, generic chip click). Ask the
      // operator to choose before we collect anything else.
      pushResponseFlow({
        text: "Happy to help. Are we adding a new product to recipes, or replacing an existing one?",
        commandId: 'product-swap',
        cardMsgType: 'cmd-product-purpose',
        cardArgs: {
          ...(args.newProductName ? { newProductName: args.newProductName } : {}),
          ...(args.oldProductName ? { oldProductHint: args.oldProductName } : {}),
        },
      });
    },
    [pushResponseFlow],
  );

  const submitProductPurpose = useCallback(
    (
      msgId: string,
      args: Record<string, unknown>,
      input: { mode: 'add' | 'replace' },
    ) => {
      writeCmdState(msgId, 'confirmed');
      pushUserEcho(
        input.mode === 'add' ? 'Adding it to recipes' : 'Replacing another product',
      );
      pushResponseFlow({
        text:
          input.mode === 'add'
            ? "Great — what's the new product called, and who's the supplier?"
            : "OK — what's the new product called, and who's the supplier?",
        commandId: 'product-swap',
        cardMsgType: 'cmd-product-new-info',
        cardArgs: { ...args, ...input },
      });
    },
    [pushResponseFlow, pushUserEcho],
  );

  const submitProductNewInfo = useCallback(
    (
      msgId: string,
      args: Record<string, unknown>,
      input: {
        newProductName: string;
        supplierMode: 'existing' | 'new';
        supplierId?: string;
        supplierName: string;
        importedFromSource?: 'sheet' | 'email' | 'document';
        importedPackDetails?: {
          packType: 'Pack' | 'Single';
          packQty: number;
          packCost: number;
          unitType: 'Each' | 'kg' | 'L' | 'g' | 'ml';
        };
      },
    ) => {
      writeCmdState(msgId, 'confirmed');
      pushUserEcho(`${input.newProductName} · from ${input.supplierName}`);
      const merged = { ...args, ...input };
      const mode = (args.mode as 'add' | 'replace' | undefined) ?? 'replace';
      if (input.supplierMode === 'new') {
        pushResponseFlow({
          text: `Got it — ${input.newProductName}, and I'll set up ${input.supplierName} as a new supplier.`,
          commandId: 'product-swap',
          cardMsgType: 'cmd-product-new-supplier',
          cardArgs: merged,
        });
        return;
      }
      // Existing supplier — branch on mode. If the operator imported
      // from a sheet / email / document we already have the pack
      // details, so we skip that step rather than ask again. The
      // imported fields are baked into the args for the next card so
      // downstream steps (pick-recipes → summary) read them the same
      // way they would after a normal pack-details submit.
      const imported = input.importedPackDetails;
      const sourceLabel =
        input.importedFromSource === 'email'
          ? 'the supplier email'
          : input.importedFromSource === 'document'
            ? 'the document'
            : input.importedFromSource === 'sheet'
              ? 'your supplier sheet'
              : null;
      if (mode === 'add') {
        if (imported && sourceLabel) {
          const mergedWithPack = {
            ...merged,
            packType: imported.packType,
            packQty: imported.packQty,
            packCost: imported.packCost,
            unitType: imported.unitType,
            skipped: false,
          };
          pushResponseFlow({
            text: `Got it — ${input.newProductName} from ${input.supplierName}. I picked up the pack details from ${sourceLabel} (${imported.packQty}${imported.unitType} · £${imported.packCost.toFixed(2)}). Now — which recipes should I add it to?`,
            commandId: 'product-swap',
            cardMsgType: 'cmd-product-pick-recipes',
            cardArgs: mergedWithPack,
          });
          return;
        }
        pushResponseFlow({
          text: `Got it — ${input.newProductName} from ${input.supplierName}. Now the details that make it orderable — supplier code, pack structure and cost. I can't guess these, so they're required.`,
          commandId: 'product-swap',
          cardMsgType: 'cmd-product-pack-details',
          cardArgs: merged,
        });
      } else {
        // Replace mode — we still need pick-replaced even with an
        // import, because the operator has to tell us which existing
        // product is going away. The pack-details skip happens one
        // step later, in `pickProductReplaced`.
        pushResponseFlow({
          text: `Got it — ${input.newProductName} from ${input.supplierName}. Which product is this replacing?`,
          commandId: 'product-swap',
          cardMsgType: 'cmd-product-pick-replaced',
          cardArgs: merged,
        });
      }
    },
    [pushResponseFlow, pushUserEcho],
  );

  const submitProductNewSupplier = useCallback(
    (
      msgId: string,
      args: Record<string, unknown>,
      input: {
        supplierName: string;
        email: string;
        contactName?: string;
        phone?: string;
        minimumOrderValue?: number;
      },
    ) => {
      writeCmdState(msgId, 'confirmed');
      const echoBits: string[] = [input.email];
      if (input.contactName) echoBits.push(input.contactName);
      if (input.phone) echoBits.push(input.phone);
      if (input.minimumOrderValue != null) echoBits.push(`MOV £${input.minimumOrderValue}`);
      pushUserEcho(echoBits.join(' · '));
      const mode = (args.mode as 'add' | 'replace' | undefined) ?? 'replace';
      const merged = { ...args, ...input };
      if (mode === 'add') {
        pushResponseFlow({
          text: `Great — ${input.supplierName} is queued. Quick pack details for ${(args.newProductName as string) ?? 'the new product'} — skip if you want to finish them later.`,
          commandId: 'product-swap',
          cardMsgType: 'cmd-product-pack-details',
          cardArgs: merged,
        });
      } else {
        pushResponseFlow({
          text: `Great — ${input.supplierName} is queued. Which existing product is ${(args.newProductName as string) ?? 'the new one'} replacing?`,
          commandId: 'product-swap',
          cardMsgType: 'cmd-product-pick-replaced',
          cardArgs: merged,
        });
      }
    },
    [pushResponseFlow, pushUserEcho],
  );

  const pickProductReplaced = useCallback(
    (
      msgId: string,
      args: Record<string, unknown>,
      input: {
        oldProductId: string;
        oldProductName: string;
        oldCategory: string;
        oldPackType: 'Pack' | 'Single';
        oldUnitType: Product['singleUnitType'];
      },
    ) => {
      writeCmdState(msgId, 'confirmed');
      pushUserEcho(input.oldProductName);
      // Imported-from-source short-circuit: if the operator uploaded a
      // sheet / email / document earlier we already have pack details
      // and can skip straight to the recipe picker.
      const importedSource = args.importedFromSource as
        | 'sheet'
        | 'email'
        | 'document'
        | undefined;
      const importedPack = args.importedPackDetails as
        | {
            packType: 'Pack' | 'Single';
            packQty: number;
            packCost: number;
            unitType: 'Each' | 'kg' | 'L' | 'g' | 'ml';
          }
        | undefined;
      if (importedSource && importedPack) {
        const sourceLabel =
          importedSource === 'email'
            ? 'the supplier email'
            : importedSource === 'document'
              ? 'the document'
              : 'your supplier sheet';
        const newName = (args.newProductName as string) ?? 'the new product';
        const merged = {
          ...args,
          ...input,
          packType: importedPack.packType,
          packQty: importedPack.packQty,
          packCost: importedPack.packCost,
          unitType: importedPack.unitType,
          skipped: false,
        };
        pushResponseFlow({
          text: `OK — replacing ${input.oldProductName}. I picked up the pack details from ${sourceLabel} (${importedPack.packQty}${importedPack.unitType} · £${importedPack.packCost.toFixed(2)}). Now — which recipes should I swap ${input.oldProductName} for ${newName} in?`,
          commandId: 'product-swap',
          cardMsgType: 'cmd-product-pick-recipes',
          cardArgs: merged,
        });
        return;
      }
      // Pull defaults from the replaced product so the pack-details
      // step starts pre-filled — most operators just confirm.
      const replaced = findProduct(input.oldProductId);
      const merged = {
        ...args,
        ...input,
        defaultPackType: replaced?.packType,
        defaultPackQty: replaced?.packQty,
        defaultPackCost: replaced?.packCost,
        defaultUnitType: replaced?.singleUnitType,
        // Inherited from the replaced product so the operator confirms
        // rather than retypes — every inherited value stays visible and
        // editable on the card. The supplier code is NOT inherited: it
        // belongs to the old supplier's catalogue, so the new SKU needs
        // its own.
        defaultTaxRatePct: replaced?.taxRatePct,
        defaultSites: replaced?.sites,
        defaultAllergensContains: replaced?.allergensContains,
        defaultAllergensTraces: replaced?.allergensTraces,
      };
      pushResponseFlow({
        text: `OK — replacing ${input.oldProductName}. The details that make the new one orderable — I've pre-filled what carries over, but it needs its own supplier code.`,
        commandId: 'product-swap',
        cardMsgType: 'cmd-product-pack-details',
        cardArgs: merged,
      });
    },
    [pushResponseFlow, pushUserEcho],
  );

  const submitProductPackDetails = useCallback(
    (
      msgId: string,
      args: Record<string, unknown>,
      input: {
        packType: 'Pack' | 'Single';
        packQty: number;
        packCost: number;
        unitType: Product['singleUnitType'];
        supplierCode?: string;
        taxRatePct?: number;
        sites?: string[];
        allergensContains?: Allergen[];
        allergensTraces?: Allergen[];
        singleUnitVolumeOrWeight?: number;
        altUom?: AltUom;
        allowSplitPack?: boolean;
        forceMultiples?: boolean;
        excludeFromCogs?: boolean;
        useActualUseForTheoreticalCogs?: boolean;
        photoDataUrl?: string;
        skipped: boolean;
      },
    ) => {
      writeCmdState(msgId, 'confirmed');
      const unitCost = input.packQty > 0 ? input.packCost / input.packQty : 0;
      const echoBits = [
        input.supplierCode ? `Code ${input.supplierCode}` : null,
        `${input.packQty}${input.unitType} · £${input.packCost.toFixed(2)}`,
        unitCost > 0 ? `£${unitCost.toFixed(unitCost < 0.1 ? 3 : 2)}/${input.unitType}` : null,
        input.taxRatePct != null ? `VAT ${input.taxRatePct}%` : null,
        input.photoDataUrl ? 'photo' : null,
      ].filter((s): s is string => Boolean(s));
      pushUserEcho(
        input.skipped ? 'Skipped pack details' : echoBits.join(' · '),
      );
      const mode = (args.mode as 'add' | 'replace' | undefined) ?? 'replace';
      const newName = (args.newProductName as string) ?? 'the new product';
      pushResponseFlow({
        text:
          mode === 'add'
            ? `Now the important bit — which recipes should I add ${newName} to?`
            : `Now the important bit — which recipes should I swap ${(args.oldProductName as string) ?? 'the old product'} for ${newName} in?`,
        commandId: 'product-swap',
        cardMsgType: 'cmd-product-pick-recipes',
        cardArgs: { ...args, ...input },
      });
    },
    [pushResponseFlow, pushUserEcho],
  );

  const submitProductPickRecipes = useCallback(
    (
      msgId: string,
      args: Record<string, unknown>,
      input: {
        recipeIds: string[];
        totalMatched: number;
        addQty?: number;
        addUom?: string;
      },
    ) => {
      writeCmdState(msgId, 'confirmed');
      const mode = (args.mode as 'add' | 'replace' | undefined) ?? 'replace';
      const n = input.recipeIds.length;
      let echo: string;
      if (mode === 'add') {
        echo =
          n === 0
            ? 'No recipes selected'
            : `${n} recipe${n === 1 ? '' : 's'}${input.addQty != null ? ` · ${input.addQty}${input.addUom ?? ''} each` : ''}`;
      } else {
        echo =
          input.totalMatched === 0
            ? 'No recipes to update'
            : `${n} of ${input.totalMatched} recipe${input.totalMatched === 1 ? '' : 's'}`;
      }
      pushUserEcho(echo);
      // Hydrate a few sample recipe names for the summary so the
      // operator can sanity-check at a glance without scrolling back.
      const sampleNames = input.recipeIds
        .slice(0, 4)
        .map((id) => findRecipe(id)?.name)
        .filter((s): s is string => Boolean(s));
      pushResponseFlow({
        text: "Here\u2019s the plan — review and apply.",
        commandId: 'product-swap',
        cardMsgType: 'cmd-product-swap-summary',
        cardArgs: {
          ...args,
          ...input,
          sampleRecipeNames: sampleNames,
        },
      });
    },
    [pushResponseFlow, pushUserEcho],
  );

  // ── Site-setup wizard ────────────────────────────────────────────
  //
  // Seven steps, batch-first: every selected site moves through each
  // step together, mirroring "ten shops a week". Args accumulate
  // across steps in cmdArgsJson:
  //   siteIds → templates + hubs → roles → rangeIds + tiers →
  //   production → benchesHot → goLiveDates → confirm.

  // Any confirmed wizard step stays editable until the final go-live
  // confirm. Reopening rewinds the thread to that card: everything
  // after it (echo, bridge text, later steps) is dropped, the card's
  // controls re-enable with the operator's values still in place, and
  // re-confirming walks the remaining steps again with the new answers.
  const [siteSetupDone, setSiteSetupDone] = useState(false);

  const reopenSiteSetupCard = useCallback(
    (msgId: string) => {
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === msgId);
        return idx === -1 ? prev : prev.slice(0, idx + 1);
      });
      writeCmdState(msgId, 'pending');
    },
    [setMessages, writeCmdState],
  );

  const startSiteSetupWizard = useCallback(
    (args: Record<string, unknown>) => {
      setSiteSetupDone(false);
      const count = args.count as number | undefined;
      const COUNT_WORDS = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
      const countWord = count && count <= 10 ? COUNT_WORDS[count] : count ? String(count) : undefined;
      pushResponseFlow({
        text: `Workday shows ${WORKDAY_NEW_SITES.length} shops not yet in Edify. ${countWord ? `Which ${countWord} are we setting up?` : 'Which ones are we setting up?'}`,
        commandId: 'site-setup',
        cardMsgType: 'cmd-site-pick',
        cardArgs: { ...(count ? { requestedCount: count } : {}) },
      });
    },
    [pushResponseFlow],
  );

  const submitSiteSetupPick = useCallback(
    (msgId: string, args: Record<string, unknown>, input: { siteIds: string[] }) => {
      writeCmdState(msgId, 'confirmed');
      const names = input.siteIds
        .map((id) => getWorkdaySite(id)?.shortName)
        .filter((s): s is string => Boolean(s));
      pushUserEcho(names.join(' · '));
      pushResponseFlow({
        text: 'Each one copies a live shop: range and tiers, the production week with forecasts, selection times, permissions. Link each shop to the hub that makes for it, or leave it standalone.',
        commandId: 'site-setup',
        cardMsgType: 'cmd-site-copy',
        cardArgs: { ...args, siteIds: input.siteIds },
      });
    },
    [pushResponseFlow, pushUserEcho, writeCmdState],
  );

  const submitSiteSetupCopy = useCallback(
    (
      msgId: string,
      args: Record<string, unknown>,
      input: { templates: Record<string, string>; hubs: Record<string, string> },
    ) => {
      writeCmdState(msgId, 'confirmed');
      const siteIds = (args.siteIds as string[]) ?? [];
      // Echo the copy sources, grouped: "Manchester Market Street ×1 · St Pancras ×2".
      const byTemplate = new Map<string, number>();
      for (const id of siteIds) {
        const name = getTemplateShop(input.templates[id])?.name ?? '—';
        byTemplate.set(name, (byTemplate.get(name) ?? 0) + 1);
      }
      pushUserEcho(
        Array.from(byTemplate.entries())
          .map(([name, n]) => (n > 1 ? `${name} ×${n}` : name))
          .join(' · '),
      );
      const totalPeople = siteIds.reduce((n, id) => n + (getWorkdaySite(id)?.roster.length ?? 0), 0);
      pushResponseFlow({
        text: `Workday lists ${totalPeople} people across the ${siteIds.length === 1 ? 'shop' : `${siteIds.length} shops`}, roles mapped from their jobs. Invites go out the week before each opening.`,
        commandId: 'site-setup',
        cardMsgType: 'cmd-site-team',
        cardArgs: { ...args, ...input },
      });
    },
    [pushResponseFlow, pushUserEcho, writeCmdState],
  );

  const submitSiteSetupTeam = useCallback(
    (msgId: string, args: Record<string, unknown>, input: { roles: Record<string, EdifyRole> }) => {
      writeCmdState(msgId, 'confirmed');
      const siteIds = (args.siteIds as string[]) ?? [];
      const allPeople = siteIds.flatMap((id) => getWorkdaySite(id)?.roster ?? []);
      pushUserEcho(`${allPeople.length} people · ${describeRoleCounts(roleCounts(allPeople, input.roles))}`);
      // Prefill range + tier pattern from each site's copied shop.
      const templates = (args.templates as Record<string, string>) ?? {};
      const rangeIds: Record<string, string> = {};
      const tiers: Record<string, Record<DayKey, number>> = {};
      for (const id of siteIds) {
        const t = getTemplateShop(templates[id]);
        if (!t) continue;
        rangeIds[id] = t.rangeId;
        tiers[id] = { ...t.tierByDay };
      }
      pushResponseFlow({
        text: 'Now the food. Tiers came with the copied shop. A tier includes everything below it, so one number sets a day\u2019s whole menu.',
        commandId: 'site-setup',
        cardMsgType: 'cmd-site-tiers',
        cardArgs: { ...args, ...input, rangeIds, tiers },
      });
    },
    [pushResponseFlow, pushUserEcho, writeCmdState],
  );

  const submitSiteSetupTiers = useCallback(
    (
      msgId: string,
      args: Record<string, unknown>,
      input: { rangeIds: Record<string, string>; tiers: Record<string, Record<DayKey, number>> },
    ) => {
      writeCmdState(msgId, 'confirmed');
      const siteIds = (args.siteIds as string[]) ?? [];
      pushUserEcho(
        siteIds.length === 1
          ? describeTierPattern(input.tiers[siteIds[0]])
          : `Tiers set · ${siteIds.length} sites`,
      );
      pushResponseFlow({
        text: 'Production came with the copy: each run\u2019s bench and forecast windows, forecasts by category. Check the times against each shop\u2019s hours.',
        commandId: 'site-setup',
        cardMsgType: 'cmd-site-production',
        cardArgs: { ...args, ...input },
      });
    },
    [pushResponseFlow, pushUserEcho, writeCmdState],
  );

  const submitSiteSetupProduction = useCallback(
    (
      msgId: string,
      args: Record<string, unknown>,
      input: { production: SiteProductionSchedules; benches: Record<string, number> },
    ) => {
      writeCmdState(msgId, 'confirmed');
      pushUserEcho('Schedules set');
      pushResponseFlow({
        text: 'Hot production came with the copy too: stations, batch cycles, assigned recipes, full-selection times.',
        commandId: 'site-setup',
        cardMsgType: 'cmd-site-benches-hot',
        cardArgs: { ...args, ...input },
      });
    },
    [pushResponseFlow, pushUserEcho, writeCmdState],
  );

  const submitSiteSetupBenchesHot = useCallback(
    (
      msgId: string,
      args: Record<string, unknown>,
      input: { benchesHot: SiteBenchesHot },
    ) => {
      writeCmdState(msgId, 'confirmed');
      pushUserEcho('Hot production set');
      pushResponseFlow({
        text: 'Last look before I set them up.',
        commandId: 'site-setup',
        cardMsgType: 'cmd-site-golive',
        cardArgs: { ...args, ...input },
      });
    },
    [pushResponseFlow, pushUserEcho, writeCmdState],
  );

  const confirmSiteSetup = useCallback(
    (
      msgId: string,
      final: {
        siteIds: string[];
        templates: Record<string, string>;
        goLiveDates: Record<string, string>;
      },
    ) => {
      const sites = final.siteIds
        .map((id) => getWorkdaySite(id))
        .filter((s): s is NonNullable<typeof s> => Boolean(s));
      const totalPeople = sites.reduce((n, s) => n + s.roster.length, 0);

      addRegisterSites(
        sites.map((s) => ({
          id: s.id,
          name: s.name,
          location: s.location,
          status: 'active' as const,
          statusLabel: `Opening ${final.goLiveDates[s.id] ?? s.openingDate}`,
        })),
      );

      const n = sites.length;
      const receipt: CommandReceipt = {
        headline: `${n} site${n === 1 ? '' : 's'} set up · ${totalPeople} people loaded`,
        detail: 'Nothing shows on a planner before its date. Every setting stays editable in Settings \u2192 Sites.',
        href: '/settings/sites',
        hrefLabel: 'Open Sites',
        undo: () => {
          removeRegisterSites(sites.map((s) => s.id));
        },
      };
      writeCmdState(msgId, 'confirmed');
      setSiteSetupDone(true);
      pushReceipt(receipt, msgId);
    },
    [pushReceipt, writeCmdState],
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
      // Clearing the active task id stops any in-flight thinking-bubble
      // timeouts from pushing their delayed card into the cancelled
      // thread (see `pushThinkingThenCard`).
      activeTaskIdRef.current = null;
    }
  }, [setMessages, snapshotIntoTask, writeCmdState]);

  // ── Confirm handlers, one per command ────────────────────────────
  // Each commits the mutation and pushes a receipt.

  // Farmer J whole-day flex. Writes flexPct on the day record; the day
  // plan, prep list and sections all re-derive from it. Lines the manager
  // set by hand are untouched by design (cascade rule).
  const fjStore = useFjPlanStoreOptional();
  const { productionSiteId: fjSiteId } = useActiveSite();
  const confirmFjFlex = useCallback(
    (msgId: string, final: { date: string; pct: number }) => {
      if (!fjStore) return;
      const shopId = fjSiteId && fjSiteId !== FJ_ALL_SHOPS_ID ? fjSiteId : 'fj-marylebone';
      const before = fjStore.get(shopId, final.date);
      const previousPct = before.flexPct;
      const planBefore = computeDayPlan(shopId, final.date, before);
      const plan = computeDayPlan(shopId, final.date, { ...before, flexPct: final.pct });
      fjStore.update(shopId, final.date, r => ({ ...r, flexPct: final.pct }));
      const dayLabel = final.date === FJ_DEMO_TODAY ? "Today's" : `${longDay(final.date)}'s`;
      const moved = plan.plans.filter((p, i) => batchesToNumber(p.batches) !== batchesToNumber(planBefore.plans[i].batches)).length;
      const receipt: CommandReceipt = {
        headline: `${dayLabel} plan ${final.pct < 0 ? 'down' : 'up'} ${Math.abs(final.pct)}%`,
        detail: `${shortDate(final.date)} · ${moved} lines re-rounded${plan.overriddenCount ? `, ${plan.overriddenCount} you set by hand unchanged` : ''}. Prep list and sections follow.`,
        href: '/production/day',
        hrefLabel: 'Open day plan',
        undo: () => fjStore.update(shopId, final.date, r => ({ ...r, flexPct: previousPct })),
      };
      writeCmdState(msgId, 'confirmed');
      pushReceipt(receipt, msgId);
    },
    [fjStore, fjSiteId, pushReceipt],
  );

  // Farmer J Setup change from plain language. Same publish as the Setup
  // screen: approved days flagged, snapshot for revert, Publish log entry
  // carrying what Jana typed. The downstream line is filled in once the
  // engines have re-run on the new rules (a tick after the stores update).
  const siteStore = useSiteSettingsStore();
  const confirmFjSetup = useCallback(
    (msgId: string, final: FjSetupArgs) => {
      if (!fjStore) return;
      const resolved = resolveFjSetup(final, { recipes: fjStore.recipes, effectiveFor: siteStore.effectiveFor, overlayFor: siteStore.overlayFor });
      if (resolved.missing || !resolved.changes.length) return;
      const { id, revert, impactBefore } = publishFjSetup(resolved, final.text, {
        get: fjStore.get, update: fjStore.update, updateSettings: fjStore.updateSettings, recipes: fjStore.recipes,
        replace: siteStore.replace, updateRecipe,
      }, fjStore.settings);
      window.setTimeout(() => {
        const after = snapshotImpact(resolved.shops, FJ_DEMO_TODAY, fjStore.get);
        const downstream = describeImpact(impactBefore, after);
        fjStore.updateSettings(s => ({ ...s, log: s.log.map(e => (e.id === id ? { ...e, downstream } : e)) }));
      }, 120);
      const shopsText = resolved.shops.length === 1 ? (getShop(resolved.shops[0])?.name ?? '1 shop') : `${resolved.shops.length} shops`;
      const receipt: CommandReceipt = {
        headline: `Published · ${resolved.title}`,
        detail: `${shopsText}${resolved.kept.length ? `, ${resolved.kept.length} keep their own` : ''} · ${resolved.changes.length} change${resolved.changes.length === 1 ? '' : 's'}. In the Setup publish log.`,
        href: '/production/setup?tab=log',
        hrefLabel: 'Open publish log',
        undo: revert,
      };
      writeCmdState(msgId, 'confirmed');
      pushReceipt(receipt, msgId);
    },
    [fjStore, siteStore, pushReceipt],
  );

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
      recordTaskChanges({
        changes: diffWaste({
          entryId: entry.id,
          productName: product.name,
          qty: final.qty,
          uom: final.uom,
          reasonId: final.reasonId,
          reasonLabel: reason?.label,
          value: +value,
        }),
        commandIntent: {
          commandId: 'waste',
          cardMsgType: 'cmd-waste',
          args: { ...final },
        },
      });
      pushReceipt(receipt, msgId);
    },
    [pushReceipt, recordTaskChanges],
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
      recordTaskChanges({
        changes: diffStock({
          entryId: entry.id,
          itemName: final.itemName,
          qty: final.qty,
          uom: final.uom,
          expectedQty: final.expectedQty,
          location: final.location,
        }),
        commandIntent: {
          commandId: 'stock',
          cardMsgType: 'cmd-stock',
          args: { ...final },
        },
      });
      pushReceipt(receipt, msgId);
    },
    [pushReceipt, recordTaskChanges],
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
      recordTaskChanges({
        changes: diffRecipeEdit({ before, after: next, final }),
        commandIntent: {
          commandId: 'recipe-edit',
          cardMsgType: 'cmd-recipe-summary',
          args: { ...final },
        },
      });
      pushReceipt(receipt, msgId);
    },
    [pushReceipt, recordTaskChanges],
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
      recordTaskChanges({
        changes: diffProduction({ final }),
        commandIntent: {
          commandId: 'production',
          cardMsgType: 'cmd-production-field',
          args: { ...final },
        },
      });
      pushReceipt(receipt, msgId);
    },
    [pushReceipt, recordTaskChanges],
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
      recordTaskChanges({
        changes: diffMenu({ before, after: next, final }),
        commandIntent: {
          commandId: 'menu',
          cardMsgType: 'cmd-menu-action',
          args: { ...final },
        },
      });
      pushReceipt(receipt, msgId);
    },
    [pushReceipt, recordTaskChanges],
  );

  const confirmSupplier = useCallback(
    (
      msgId: string,
      final: {
        supplierId: string;
        supplierName: string;
        changes: {
          field: SupplierField;
          valueRaw: string;
          valueNormalised: string | number | DayOfWeek[];
          previousValue: string | number | DayOfWeek[] | undefined;
        }[];
      },
    ) => {
      const supplier = findSupplier(final.supplierId);
      if (!supplier || final.changes.length === 0) return;
      const before = supplier;
      let next: Supplier = { ...supplier };
      for (const c of final.changes) {
        next = { ...next, [c.field]: c.valueNormalised } as Supplier;
      }
      upsertSupplier(next);

      const labels: Record<SupplierField, string> = {
        cutOffTime: 'Cut-off',
        leadTimeDays: 'Lead time',
        minimumOrderValue: 'MOV',
        deliveryDays: 'Delivery days',
        email: 'Order email',
        phone: 'Phone',
        contactName: 'Contact name',
        accountsEmail: 'Accounts email',
        companyAccountNumber: 'Account number',
        notes: 'Notes',
      };

      const displayOf = (c: (typeof final.changes)[number]): string => {
        if (c.field === 'deliveryDays' && Array.isArray(c.valueNormalised)) {
          return (c.valueNormalised as DayOfWeek[]).join(', ');
        }
        if (c.field === 'leadTimeDays') {
          const n = Number(c.valueNormalised);
          return `${n} day${n === 1 ? '' : 's'}`;
        }
        if (c.field === 'minimumOrderValue') return `£${c.valueNormalised}`;
        return String(c.valueNormalised);
      };

      const headline = final.changes
        .map((c) => `${labels[c.field]} · ${displayOf(c)}`)
        .join('  ·  ');

      const receipt: CommandReceipt = {
        headline,
        detail: `Saved on ${final.supplierName}`,
        href: `/suppliers/${final.supplierId}`,
        hrefLabel: 'Open supplier',
        undo: () => {
          upsertSupplier(before);
        },
      };
      writeCmdState(msgId, 'confirmed');
      recordTaskChanges({
        changes: diffSupplier({ final }),
        commandIntent: {
          commandId: 'supplier',
          cardMsgType: 'cmd-supplier-card',
          args: { ...final },
        },
      });
      pushReceipt(receipt, msgId);
    },
    [pushReceipt, recordTaskChanges],
  );

  const confirmProductSwap = useCallback(
    (
      msgId: string,
      final: {
        // Mode — drives the whole branch
        mode?: 'add' | 'replace';
        // Step 1
        newProductName: string;
        supplierMode: 'existing' | 'new';
        supplierId?: string;
        supplierName: string;
        // Step 2 (new-supplier path; order email required there)
        email?: string;
        contactName?: string;
        phone?: string;
        minimumOrderValue?: number;
        /** @deprecated no longer collected — production suppliers
         *  carry an ordering schedule, not a lead time. Kept so old
         *  replayed tasks still commit. */
        leadTimeDays?: number;
        // Step 3 (replace path only)
        oldProductId?: string;
        oldProductName?: string;
        oldCategory?: string;
        // Step 4 — the field step (pack structure + code required)
        packType?: 'Pack' | 'Single';
        packQty?: number;
        packCost?: number;
        unitType?: Product['singleUnitType'];
        supplierCode?: string;
        taxRatePct?: number;
        sites?: string[];
        allergensContains?: Allergen[];
        allergensTraces?: Allergen[];
        singleUnitVolumeOrWeight?: number;
        altUom?: AltUom;
        allowSplitPack?: boolean;
        forceMultiples?: boolean;
        excludeFromCogs?: boolean;
        useActualUseForTheoreticalCogs?: boolean;
        photoDataUrl?: string;
        skipped?: boolean;
        // Step 5
        recipeIds: string[];
        totalMatched?: number;
        addQty?: number;
        addUom?: string;
        // Step 6 (summary)
        scope: 'all' | 'site';
        siteLabel?: string;
        linkMaster?: boolean;
      },
    ) => {
      const mode = final.mode ?? 'replace';
      // Snapshot both stores so Undo can roll the whole transaction
      // back atomically — adding the product + (maybe) supplier +
      // (maybe) master + N recipe edits is a single logical change.
      const suppliersBefore = snapshotSuppliersStore();
      const recipesBefore = snapshotRecipes().map((r) => ({ ...r }));

      const replaced =
        mode === 'replace' && final.oldProductId ? findProduct(final.oldProductId) : undefined;
      // 1. Supplier — upsert when new. Defaults pulled from the
      //    replaced product's categories + sites so the new SKU
      //    inherits a sensible footprint.
      let supplierId = final.supplierId;
      if (final.supplierMode === 'new' || !supplierId) {
        supplierId = genId('sup');
        const newSupplier: Supplier = {
          id: supplierId,
          name: final.supplierName,
          shortCode: final.supplierName.split(/\s+/).slice(0, 2).join(' '),
          categories: replaced
            ? [replaced.category]
            : (['Other'] as ProductCategory[]),
          sites: replaced?.sites ?? [],
          status: 'Available',
          email: final.email,
          contactName: final.contactName,
          phone: final.phone,
          minimumOrderValue: final.minimumOrderValue,
          leadTimeDays: final.leadTimeDays,
        };
        upsertSupplier(newSupplier);
      }

      // 2. Product — defaults from replaced (replace mode) or
      //    safe-empty defaults (add mode), with pack-details overrides
      //    applied when the operator filled them in.
      const newProductId = genId('prd');
      const newProduct: Product = {
        id: newProductId,
        name: final.newProductName,
        source: 'supplier',
        supplierId: supplierId,
        supplierCode: final.supplierCode ?? '',
        productClass: replaced?.productClass ?? 'General',
        category: (replaced?.category ?? 'Other') as ProductCategory,
        tags: replaced?.tags ?? [],
        packType: final.packType ?? replaced?.packType ?? 'Single',
        packQty: final.packQty ?? replaced?.packQty ?? 1,
        packCost: final.packCost ?? replaced?.packCost ?? 0,
        taxRatePct: final.taxRatePct ?? replaced?.taxRatePct ?? 0,
        singleUnitType: final.unitType ?? replaced?.singleUnitType ?? 'Each',
        singleUnitVolumeOrWeight: final.singleUnitVolumeOrWeight ?? replaced?.singleUnitVolumeOrWeight,
        unitOfMeasure: replaced?.unitOfMeasure,
        altUoms: final.altUom ? [final.altUom] : (replaced?.altUoms ?? []),
        allowSplitPack: final.allowSplitPack || undefined,
        forceMultiples: final.forceMultiples || undefined,
        excludeFromCogs: final.excludeFromCogs || undefined,
        useActualUseForTheoreticalCogs: final.useActualUseForTheoreticalCogs || undefined,
        allergensContains: final.allergensContains ?? replaced?.allergensContains ?? [],
        allergensTraces: final.allergensTraces ?? replaced?.allergensTraces ?? [],
        nutrition: replaced?.nutrition ?? {},
        sites: final.sites ?? replaced?.sites ?? [],
        status: 'Available',
      };

      // 3. Master-product linking (opt-in, replace path only). If the
      //    operator chose "treat as the same item", point both old
      //    and new products at the same master. Reuse the old
      //    product's master when set; otherwise mint one from the old
      //    product's name. Doesn't apply in add mode — there's
      //    nothing to link.
      if (mode === 'replace' && final.linkMaster && final.oldProductId && final.oldProductName) {
        let masterId = replaced?.masterProductId;
        if (!masterId) {
          masterId = genId('mp');
          upsertMasterProduct({
            id: masterId,
            name: final.oldProductName,
            category: (replaced?.category ?? 'Other') as ProductCategory,
            unit: replaced?.unitOfMeasure ?? '',
            slug: final.oldProductName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          });
          if (replaced) {
            upsertProduct({ ...replaced, masterProductId: masterId });
          }
        }
        newProduct.masterProductId = masterId;
      }
      upsertProduct(newProduct);

      // 4. Recipe sweep — different mutation per mode.
      const selectedSet = new Set(final.recipeIds);
      let recipesTouched = 0;
      if (mode === 'replace' && final.oldProductId && final.oldProductName) {
        // Replace path — swap typed v2 refs and legacy free-text rows
        // for the selected recipes.
        const oldNameLower = final.oldProductName.toLowerCase();
        const oldProductId = final.oldProductId;
        const newSupplierName = final.supplierName;
        const newProductName = final.newProductName;
        for (const recipeId of selectedSet) {
          const recipe = findRecipe(recipeId);
          if (!recipe) continue;
          const nextIngredientsV2 = (recipe.ingredientsV2 ?? []).map((row) => {
            if (row.ref.kind === 'product' && row.ref.productId === oldProductId) {
              return { ...row, ref: { kind: 'product' as const, productId: newProductId } };
            }
            // Master-linked rows are intentionally left alone: if the
            // operator linked under a master, the row already
            // resolves to either SKU, and rewiring it to the new
            // product would narrow the recipe rather than widen it.
            return row;
          });
          const nextLegacy = (recipe.ingredients ?? []).map((ing) => {
            if (ing.name.toLowerCase().includes(oldNameLower)) {
              return { ...ing, name: newProductName, supplier: newSupplierName };
            }
            return ing;
          });
          updateRecipe({
            ...recipe,
            ingredients: nextLegacy,
            ingredientsV2: recipe.ingredientsV2 ? nextIngredientsV2 : undefined,
          });
          recipesTouched += 1;
        }
      } else {
        // Add path — append a brand-new ingredient row to every
        // selected recipe. Quantity comes from the picker; UoM
        // defaults to the new product's unit type when the picker
        // didn't capture one.
        const addQty = final.addQty ?? 1;
        const addUom = final.addUom ?? final.unitType ?? 'each';
        const newRow = (): RecipeIngredient =>
          makeRecipeIngredient(
            { kind: 'product', productId: newProductId },
            { value: addQty, unit: addUom },
          );
        for (const recipeId of selectedSet) {
          const recipe = findRecipe(recipeId);
          if (!recipe) continue;
          // Skip recipes that already include the new product to
          // avoid double-adding on repeat runs.
          const alreadyHasV2 = (recipe.ingredientsV2 ?? []).some(
            (row) => row.ref.kind === 'product' && row.ref.productId === newProductId,
          );
          if (alreadyHasV2) continue;
          const nextLegacy = [
            ...(recipe.ingredients ?? []),
            {
              name: final.newProductName,
              qty: `${addQty}${addUom}`,
              supplier: final.supplierName,
            },
          ];
          const nextIngredientsV2 = recipe.ingredientsV2
            ? [...recipe.ingredientsV2, newRow()]
            : undefined;
          updateRecipe({
            ...recipe,
            ingredients: nextLegacy,
            ingredientsV2: nextIngredientsV2,
          });
          recipesTouched += 1;
        }
      }

      // 5. Receipt.
      const scopeLabel = final.scope === 'all' ? 'all sites' : `just ${final.siteLabel}`;
      const headlineBits: string[] = [`Added ${final.newProductName}`];
      if (recipesTouched > 0) {
        if (mode === 'replace' && final.oldProductName) {
          headlineBits.push(
            `replaced ${final.oldProductName} in ${recipesTouched} recipe${recipesTouched === 1 ? '' : 's'}`,
          );
        } else {
          headlineBits.push(
            `added to ${recipesTouched} recipe${recipesTouched === 1 ? '' : 's'}`,
          );
        }
      }
      const detailBits: string[] = [];
      if (final.supplierMode === 'new') detailBits.push(`new supplier · ${final.supplierName}`);
      if (mode === 'replace' && final.linkMaster) detailBits.push('linked as same item');
      detailBits.push(`Saved to ${scopeLabel}`);

      const receipt: CommandReceipt = {
        headline: headlineBits.join(' · '),
        detail: detailBits.join(' · '),
        href: `/suppliers/products/${newProductId}`,
        hrefLabel: 'Open product',
        undo: () => {
          // Atomic rollback — both stores back to pre-mutation state.
          restoreSuppliersStore(suppliersBefore);
          setRecipes(recipesBefore);
        },
      };

      writeCmdState(msgId, 'confirmed');
      // Capture diff + blast radius before pushing the receipt so the
      // Activity row renders with full detail from the first paint.
      const recipesAfter = snapshotRecipes().map((r) => ({ ...r }));
      const affectedIds = Array.from(selectedSet).filter((id) =>
        recipesAfter.some((r) => r.id === id),
      );
      const oldProductSnapshot =
        mode === 'replace' && final.oldProductId ? findProduct(final.oldProductId) : undefined;

      // PARENT — global effects only (supplier + product creation +
      // aggregate GP impact). The per-recipe rows live on the children
      // we spawn below, which is what makes them independently
      // revertible from the Activity log.
      const parentDiff = diffProductSwap({
        mode,
        newProduct,
        oldProduct: oldProductSnapshot,
        newProductName: final.newProductName,
        oldProductName: final.oldProductName,
        supplierName: final.supplierName,
        supplierCreated: final.supplierMode === 'new',
        recipesBefore,
        recipesAfter,
        affectedRecipeIds: affectedIds,
      });
      recordTaskChanges({
        changes: parentDiff.changes,
        blastRadius: parentDiff.blastRadius,
        commandIntent: {
          commandId: 'product-swap',
          cardMsgType: 'cmd-product-swap-summary',
          args: { ...final },
        },
      });

      // pushReceipt completes the parent Task and stamps it with the
      // receipt. We capture the parent id (before pushReceipt clears
      // activeTaskIdRef on the next runCommand) so we can mark the
      // grouping and stitch children onto it.
      const parentTaskId = activeTaskIdRef.current;
      pushReceipt(receipt, msgId);

      // CHILDREN — one Task per affected recipe. Each child carries
      // just that recipe's diff + blast radius, and a recipe-edit-
      // shaped commandIntent so the existing Activity revert path can
      // invert it through buildRevertArgs. Children are written
      // already-completed because the mutations all landed atomically
      // in the parent's confirm step above.
      if (parentTaskId && affectedIds.length > 0) {
        markGroupParent(parentTaskId);
        const slices = splitProductSwapPerRecipe({
          mode,
          newProduct,
          oldProduct: oldProductSnapshot,
          newProductName: final.newProductName,
          oldProductName: final.oldProductName,
          recipesBefore,
          recipesAfter,
          affectedRecipeIds: affectedIds,
          scope: final.scope,
          siteLabel: final.siteLabel,
        });
        for (const slice of slices) {
          logChildTask({
            kind: 'product-swap',
            title: slice.title,
            subtitle: final.supplierName,
            receipt: {
              headline: slice.title,
              detail: `Part of "${receipt.headline}"`,
              href: `/recipes/${slice.recipeId}/edit`,
              hrefLabel: 'Open recipe',
            },
            changes: slice.changes,
            blastRadius: slice.blastRadius,
            commandIntent: slice.revertIntent,
            groupId: parentTaskId,
          });
        }
      }
    },
    [pushReceipt, recordTaskChanges],
  );

  // ── Sheet-driven product swap (add a product + swap across recipes) ─
  //
  // A streamlined replacement for the manual product-swap wizard: the
  // operator attaches a supplier sheet, we parse it, they confirm the
  // new product, then they confirm the recipes that use the old one —
  // and that second confirm applies everything. Just two taps.
  //
  // The cinematic "parsing the sheet" beat lives in Feed.tsx; this
  // launcher picks up once the extract is ready and opens the task +
  // the first (product-details) card. We don't clear the thread —
  // Feed has already pushed the user echo + parsing summary.

  const startProductSwapFromSheet = useCallback(
    (args: Record<string, unknown>) => {
      setChatStarted(true);
      setChatMinimized(false);

      // Idempotent demo reset — restore the recipes that use the
      // espresso-blend beans to their seed state before we begin. This
      // is a scripted "swap the coffee bean across every recipe that
      // uses one" flow; re-running it would otherwise find fewer
      // recipes each time (the legacy "Espresso blend" rows get renamed
      // to the new bean on the first pass and stop matching), so we
      // re-seed up front to always show the full set.
      const oldMasterId = (args.oldMasterId as string | undefined) ?? 'mp-espresso-blend';
      const usesOldBean = (r: Recipe): boolean =>
        (r.ingredientsV2 ?? []).some(
          (row) => row.ref.kind === 'master' && row.ref.masterProductId === oldMasterId,
        ) || (r.ingredients ?? []).some((i) => i.name.toLowerCase().includes('espresso'));
      const seedById = new Map(ALL_LIBRARY_RECIPES.map((r) => [r.id, r]));
      const espressoSeedIds = new Set(
        ALL_LIBRARY_RECIPES.filter(usesOldBean).map((r) => r.id),
      );
      if (espressoSeedIds.size > 0) {
        setRecipes(
          snapshotRecipes().map((r) =>
            espressoSeedIds.has(r.id)
              ? (JSON.parse(JSON.stringify(seedById.get(r.id))) as Recipe)
              : r,
          ),
        );
      }

      onFreshTask?.();
      const t = startTask({
        kind: 'product-swap' as TaskKind,
        title: 'Add a product',
        subtitle: (args.newProductName as string) ?? undefined,
      });
      activeTaskIdRef.current = t.id;
      pushCard('product-swap', 'cmd-product-sheet-details', args);
    },
    [onFreshTask, pushCard, setChatMinimized, setChatStarted],
  );

  const confirmProductSheetDetails = useCallback(
    (msgId: string, args: Record<string, unknown>) => {
      writeCmdState(msgId, 'confirmed');
      // `edited` is set by the card when the operator corrected the
      // parse — echo it honestly rather than pretending the sheet was
      // right first time.
      pushUserEcho(args.edited === true ? 'Fixed the details, looks right now' : 'Looks right');
      const oldName = (args.oldProductName as string) ?? 'your current beans';
      const newName = (args.newProductName as string) ?? 'the new product';
      pushResponseFlow({
        text: `Here's every recipe that uses ${oldName}. Confirm and I'll swap them all to ${newName} in one go.`,
        commandId: 'product-swap',
        cardMsgType: 'cmd-product-pick-recipes',
        cardArgs: { ...args, mode: 'replace', fromSheet: true },
      });
    },
    [pushResponseFlow, pushUserEcho, writeCmdState],
  );

  const confirmProductSwapFromSheetRecipes = useCallback(
    (
      msgId: string,
      args: Record<string, unknown>,
      input: { recipeIds: string[]; totalMatched: number },
    ) => {
      const newProductName = (args.newProductName as string) ?? 'New product';
      const supplierName = (args.supplierName as string) ?? 'Existing supplier';
      const oldMasterId = args.oldMasterId as string | undefined;
      const oldProductName = (args.oldProductName as string) ?? 'the old product';
      const packType = (args.packType as 'Pack' | 'Single') ?? 'Pack';
      const packQty = (args.packQty as number) ?? 1;
      const packCost = (args.packCost as number) ?? 0;
      const unitType = (args.unitType as Product['singleUnitType']) ?? 'kg';
      const category = (args.category as ProductCategory) ?? 'Other';
      const allergens = (args.allergens as string[]) ?? [];
      const sites = (args.sites as string[]) ?? [];

      const suppliersBefore = snapshotSuppliersStore();
      const recipesBefore = snapshotRecipes().map((r) => ({ ...r }));

      // Existing supplier — a product sheet doesn't carry supplier
      // onboarding terms, so we attach to one we already have rather
      // than minting a half-populated new supplier. Fall back to the
      // first supplier in the book if the caller didn't resolve one.
      const supplierId =
        (args.supplierId as string | undefined) ?? suppliersBefore.suppliers[0]?.id ?? '';

      // Product — linked to the SAME master as the old bean so the two
      // are treated as one item across the catalogue. Shaped exactly
      // like the single-product sheet importer (source, master link,
      // pack details, all sites, no new supplier).
      const newProductId = genId('prd');
      const newProduct: Product = {
        id: newProductId,
        name: newProductName,
        source: 'supplier',
        supplierId,
        masterProductId: oldMasterId,
        // Base-product settings: parsed from the sheet or assumed by
        // rule, shown (and editable) on the details card before this
        // confirm — so what lands here is what the operator approved.
        supplierCode: (args.supplierCode as string) || 'SHEET-IMPORT',
        productClass: (args.productClass as Product['productClass']) ?? 'Food',
        category,
        tags: [],
        packType,
        packQty,
        packCost,
        taxRatePct: (args.taxRatePct as number) ?? 0,
        singleUnitType: unitType,
        singleUnitVolumeOrWeight: args.singleUnitVolumeOrWeight as number | undefined,
        unitOfMeasure: args.unitOfMeasure as string | undefined,
        altUoms: (args.altUoms as Product['altUoms']) ?? [],
        allowSplitPack: (args.allowSplitPack as boolean) ?? false,
        forceMultiples: (args.forceMultiples as boolean) ?? false,
        excludeFromCogs: (args.excludeFromCogs as boolean) ?? false,
        useActualUseForTheoreticalCogs: (args.useActualUseForTheoreticalCogs as boolean) ?? false,
        allergensContains: allergens as Product['allergensContains'],
        allergensTraces: [],
        nutrition: {},
        sites,
        status: 'Available',
        flag: null,
      };
      upsertProduct(newProduct);

      // 3. Recipe sweep — master-aware. The beans are referenced either
      //    via a master ref (typed v2 rows) or a legacy "Espresso blend"
      //    free-text row, so rewrite both to the new product.
      const selectedSet = new Set(input.recipeIds);
      let recipesTouched = 0;
      for (const recipeId of selectedSet) {
        const recipe = findRecipe(recipeId);
        if (!recipe) continue;
        const nextV2 = (recipe.ingredientsV2 ?? []).map((row) => {
          const isMasterRef = row.ref.kind === 'master' && row.ref.masterProductId === oldMasterId;
          const isLinkedProduct =
            row.ref.kind === 'product' && findProduct(row.ref.productId)?.masterProductId === oldMasterId;
          if (isMasterRef || isLinkedProduct) {
            return { ...row, ref: { kind: 'product' as const, productId: newProductId } };
          }
          return row;
        });
        const nextLegacy = (recipe.ingredients ?? []).map((ing) =>
          ing.name.toLowerCase().includes('espresso') || ing.name.toLowerCase().includes('coffee bean')
            ? { ...ing, name: newProductName, supplier: supplierName }
            : ing,
        );
        updateRecipe({
          ...recipe,
          ingredients: nextLegacy,
          ingredientsV2: recipe.ingredientsV2 ? nextV2 : undefined,
        });
        recipesTouched += 1;
      }

      // 4. Receipt.
      const receipt: CommandReceipt = {
        headline: `Added ${newProductName} · swapped into ${recipesTouched} recipe${recipesTouched === 1 ? '' : 's'}`,
        detail: `Replaced ${oldProductName} · kept under ${supplierName} · all sites`,
        href: `/suppliers/products/${newProductId}`,
        hrefLabel: 'Open product',
        undo: () => {
          restoreSuppliersStore(suppliersBefore);
          setRecipes(recipesBefore);
        },
      };
      writeCmdState(msgId, 'confirmed');

      // 5. History — parent global change + per-recipe children, exactly
      //    like the manual product-swap so the Activity log reads the same.
      const recipesAfter = snapshotRecipes().map((r) => ({ ...r }));
      const affectedIds = Array.from(selectedSet).filter((id) =>
        recipesAfter.some((r) => r.id === id),
      );
      // Synthetic "old product" so the blast-radius GP maths has a cost
      // basis (the old beans aren't a concrete Product in the catalogue).
      const syntheticOld = {
        id: oldMasterId ?? 'old-beans',
        name: oldProductName,
        packCost: (args.oldPackCost as number) ?? packCost,
        packQty: (args.oldPackQty as number) ?? packQty,
      } as Product;

      const parentDiff = diffProductSwap({
        mode: 'replace',
        newProduct,
        oldProduct: syntheticOld,
        newProductName,
        oldProductName,
        supplierName,
        supplierCreated: false,
        recipesBefore,
        recipesAfter,
        affectedRecipeIds: affectedIds,
      });
      recordTaskChanges({
        changes: parentDiff.changes,
        blastRadius: parentDiff.blastRadius,
        commandIntent: {
          commandId: 'product-swap',
          cardMsgType: 'cmd-product-swap-summary',
          args: {
            mode: 'replace',
            newProductName,
            oldProductName,
            supplierName,
            recipeIds: input.recipeIds,
          },
        },
      });

      const parentTaskId = activeTaskIdRef.current;
      pushReceipt(receipt, msgId);

      if (parentTaskId && affectedIds.length > 0) {
        markGroupParent(parentTaskId);
        const slices = splitProductSwapPerRecipe({
          mode: 'replace',
          newProduct,
          oldProduct: syntheticOld,
          newProductName,
          oldProductName,
          recipesBefore,
          recipesAfter,
          affectedRecipeIds: affectedIds,
          scope: 'all',
        });
        for (const slice of slices) {
          logChildTask({
            kind: 'product-swap',
            title: slice.title,
            subtitle: supplierName,
            receipt: {
              headline: slice.title,
              detail: `Part of "${receipt.headline}"`,
              href: `/recipes/${slice.recipeId}/edit`,
              hrefLabel: 'Open recipe',
            },
            changes: slice.changes,
            blastRadius: slice.blastRadius,
            commandIntent: slice.revertIntent,
            groupId: parentTaskId,
          });
        }
      }
    },
    [pushReceipt, recordTaskChanges, writeCmdState],
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

  // ── Activity-log Revert + Edit replay ───────────────────────────
  //
  // Both replay the original command's summary card into the chat so
  // the operator confirms in the same surface where they first
  // approved the change. The pendingLinkRef tells pushReceipt to
  // stitch the new Task back to its predecessor via
  // markReverted / markSuperseded once confirmation lands.
  //
  // Note: not every command can be cleanly reverted (e.g. a
  // product-swap that created a brand-new supplier shouldn't
  // "delete" that supplier just because we reverted the recipe
  // changes). For v1 we surface a guidance message in the chat
  // before the card so the operator knows what's about to happen.

  /** Build the inverted args needed to roll a Task back to its
   *  pre-mutation state. Returns null when the command type can't be
   *  cleanly inverted (the caller falls back to opening the original
   *  receipt's deep-link). */
  function buildRevertArgs(
    commandId: string,
    args: Record<string, unknown>,
  ): Record<string, unknown> | null {
    if (commandId === 'production') {
      const prev = args.previousValue;
      if (typeof prev === 'number') {
        return { ...args, value: prev, previousValue: args.value, boolValue: undefined };
      }
      if (typeof prev === 'boolean') {
        return { ...args, boolValue: prev, value: undefined };
      }
      return null;
    }
    if (commandId === 'menu') {
      const action = args.action as string | undefined;
      if (action === 'availability-off') {
        return { ...args, action: 'availability-on', previousAvailable: false };
      }
      if (action === 'availability-on') {
        return { ...args, action: 'availability-off', previousAvailable: true };
      }
      if (action === 'price-set' && typeof args.previousPrice === 'number') {
        return {
          ...args,
          action: 'price-set',
          price: args.previousPrice,
          previousPrice: args.price,
        };
      }
      if (action === 'price-delta' && typeof args.priceDelta === 'number') {
        return {
          ...args,
          priceDelta: -(args.priceDelta as number),
          previousPrice:
            typeof args.previousPrice === 'number'
              ? args.previousPrice + (args.priceDelta as number)
              : args.previousPrice,
        };
      }
      return null;
    }
    if (commandId === 'supplier') {
      const changes = args.changes as
        | {
            field: SupplierField;
            valueRaw: string;
            valueNormalised: string | number | DayOfWeek[];
            previousValue: string | number | DayOfWeek[] | undefined;
          }[]
        | undefined;
      if (!changes?.length) return null;
      // Only invertible when every edited field had a prior value.
      if (changes.some((c) => c.previousValue === undefined || c.previousValue === null)) return null;
      return {
        ...args,
        changes: changes.map((c) => ({
          ...c,
          valueNormalised: c.previousValue!,
          valueRaw: Array.isArray(c.previousValue) ? c.previousValue.join(', ') : String(c.previousValue),
          previousValue: c.valueNormalised,
        })),
      };
    }
    if (commandId === 'recipe-edit') {
      const kind = args.kind as string | undefined;
      if (kind === 'add') {
        return { ...args, kind: 'remove', fromName: args.toName, toName: undefined };
      }
      if (kind === 'remove') {
        return { ...args, kind: 'add', toName: args.fromName, fromName: undefined };
      }
      if (kind === 'swap') {
        return { ...args, fromName: args.toName, toName: args.fromName };
      }
      return null;
    }
    // product-swap, waste, stock — not safely invertible from args
    // alone in the prototype. Caller surfaces a notice in the chat.
    return null;
  }

  const replayTaskCommand = useCallback(
    (
      task: { commandIntent?: { commandId: string; cardMsgType: string; args: Record<string, unknown> } },
      mode: 'revert' | 'edit',
      originalTaskId: string,
    ): boolean => {
      const ci = task.commandIntent;
      if (!ci) return false;
      const cmd = getCommand(ci.commandId as CommandIntent['commandId']);
      if (!cmd) return false;
      const replayArgs =
        mode === 'edit' ? ci.args : buildRevertArgs(ci.commandId, ci.args);
      if (!replayArgs) return false;

      setChatStarted(true);
      setChatMinimized(false);
      // Fresh thread so the replay isn't tangled in whatever else is
      // on screen. Mirrors `runCommand({ freshTask: true })`.
      setMessages([]);
      cmdStatesRef.current = {};
      setCmdStates({});
      setCmdUndone({});
      receiptsRef.current = {};
      receiptToTaskRef.current = {};
      onFreshTask?.();

      const { title, subtitle } = describeTask({
        commandId: cmd.id,
        args: replayArgs,
        confidence: 1,
      });
      const t = startTask({
        kind: cmd.id as TaskKind,
        title: mode === 'revert' ? `Revert · ${title}` : `Edit · ${title}`,
        subtitle,
      });
      activeTaskIdRef.current = t.id;
      pendingLinkRef.current = { kind: mode === 'revert' ? 'revert' : 'supersede', originalTaskId };

      pushQuinn(
        mode === 'revert'
          ? "Here's the reverse of the change — confirm to roll it back."
          : "Reopened — adjust and confirm.",
      );
      pushCard(cmd.id, ci.cardMsgType, replayArgs);
      return true;
    },
    [onFreshTask, pushCard, pushQuinn, setChatMinimized, setChatStarted, setMessages],
  );

  const revertTask = useCallback(
    (task: {
      id: string;
      commandIntent?: { commandId: string; cardMsgType: string; args: Record<string, unknown> };
    }): boolean => replayTaskCommand(task, 'revert', task.id),
    [replayTaskCommand],
  );

  const editTask = useCallback(
    (task: {
      id: string;
      commandIntent?: { commandId: string; cardMsgType: string; args: Record<string, unknown> };
    }): boolean => replayTaskCommand(task, 'edit', task.id),
    [replayTaskCommand],
  );

  return {
    cmdStates,
    cmdUndone,
    getReceipt,
    runCommand,
    cancelCard,
    confirmFjFlex,
    confirmFjSetup,
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
    // Product wizard (add or replace) handlers
    submitProductPurpose,
    submitProductNewInfo,
    submitProductNewSupplier,
    pickProductReplaced,
    submitProductPackDetails,
    submitProductPickRecipes,
    confirmProductSwap,
    // Sheet-driven product swap (add a product + swap across recipes)
    startProductSwapFromSheet,
    confirmProductSheetDetails,
    confirmProductSwapFromSheetRecipes,
    // Site-setup wizard handlers
    submitSiteSetupPick,
    submitSiteSetupCopy,
    submitSiteSetupTeam,
    submitSiteSetupTiers,
    submitSiteSetupProduction,
    submitSiteSetupBenchesHot,
    confirmSiteSetup,
    reopenSiteSetupCard,
    siteSetupDone,
    undoReceipt,
    restoreMessages,
    snapshotTask,
    revertTask,
    editTask,
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
    args.newProductName as string | undefined,
    args.oldProductName as string | undefined,
  ];
  const target = candidates.find((c): c is string => typeof c === 'string' && c.length > 0);
  return target ? { title: label, subtitle: target } : { title: label };
}
