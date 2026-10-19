'use client';

import { useMemo, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import { AlertCircle, ArrowUp, Check, ChevronLeft, ChevronRight, X } from 'lucide-react';
import {
  acceptLabel,
  answerFor,
  gbp,
  hasNoOrder,
  hasPrices,
  isSuggested,
  ORDER_KEY,
  orderWords,
  packWords,
  parseChange,
  review,
  settledLines,
  setupDone,
  setupFor,
  SUPPLIER_KEY,
  type Answers,
  type CheckItem,
  type IssueKind,
  type LineEdit,
  type Setups,
} from './review';
import { poFor, type ProductSeed, type Sample, type SeedLine, type SupplierSeed } from './samples';
import { KIND_WORD } from './ReadingScreen';
import { betterOrder } from './match';
import OrderSheet, { BetterOrder } from './OrderSheet';
import PhotoPane from './PhotoPane';
import { ProductSetupSheet, SupplierSheet } from './SetupSheets';
import { C, card, ChoiceList, IconButton, InlineLink, keepIds, LineCrop, PhotoViewer, Picker, PrimaryButton, SecondaryButton, Sheet, Stepper, TextLink } from './ui';

interface Props {
  sample: Sample;
  edits: Record<string, LineEdit>;
  answers: Answers;
  setups: Setups;
  isPhone: boolean;
  /** Wide enough to pin the photo beside the review. */
  isWide: boolean;
  backLabel?: string;
  onEdit: (lineId: string, patch: Partial<LineEdit>) => void;
  onAnswer: (key: string, kind: IssueKind, choice: string) => void;
  onSetupProduct: (lineId: string, p: ProductSeed) => void;
  onSetupSupplier: (s: SupplierSeed) => void;
  /** Check against other orders, or [] for none. */
  onPickOrders: (orders: string[]) => void;
  onBack: () => void;
  onAccept: () => void;
}

type SetupTarget = { kind: 'product'; lineId: string } | { kind: 'supplier' } | null;

const COLUMN = 600;

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function ReviewScreen({ sample, edits, answers, setups, isPhone, isWide, backLabel = 'Back to the camera', onEdit, onAnswer, onSetupProduct, onSetupSupplier, onPickOrders, onBack, onAccept }: Props) {
  const r = useMemo(() => review(sample, edits, answers, setups), [sample, edits, answers, setups]);
  const [sheetLine, setSheetLine] = useState<string | null>(null);
  const [hoverLine, setHoverLine] = useState<string | null>(null);
  const [photo, setPhoto] = useState<{ focus?: string } | null>(null);
  const [setup, setSetup] = useState<SetupTarget>(null);
  const [picking, setPicking] = useState(false);
  const [said, setSaid] = useState('');
  const [status, setStatus] = useState('');

  const receipt = sample.kind === 'receipt';
  const noOrder = hasNoOrder(sample);
  const priced = hasPrices(sample);
  const total = r.lineCount;
  const matched = r.matches.length;
  const multiPo = sample.poNumbers.length > 1;
  const flagged = useMemo(() => new Set(r.toCheck.flatMap(i => (i.line ? [i.line.id] : []))), [r.toCheck]);

  const subline = [
    `${cap(KIND_WORD[sample.kind])}${sample.docNumber ? ` ${sample.docNumber}` : ''}`,
    receipt ? sample.printedDate : noOrder ? 'No order' : sample.poNumbers.join(' + '),
    priced ? gbp(paperSums(sample).total) : null,
  ]
    .filter(Boolean)
    .join(' \u00b7 ');

  const title = noOrder && !answers[ORDER_KEY] ? 'No order found' : matched === total ? `All ${total} match` : `${matched} of ${total} match`;
  const checkedAgainst = receipt ? (
    'Checked against your products. A shop receipt has no order behind it.'
  ) : noOrder ? (
    'Checked against your products, with no order behind it.'
  ) : (
    <>
      {keepIds(`${priced ? 'Quantities and prices' : 'Quantities'} checked against ${orderWords(sample)}.`)}{' '}
      <InlineLink onClick={() => setPicking(true)}>Wrong order?</InlineLink>
    </>
  );
  const better = useMemo(() => betterOrder(sample), [sample]);
  const pickOrders = (orders: string[]) => {
    setPicking(false);
    onPickOrders(orders);
    setStatus(orders.length ? `Now checked against ${orders.join(' and ')}. Your counts are kept.` : 'Now received with no order. Your counts are kept.');
  };
  const answerLine =
    r.toCheck.length === 0 ? '' : r.open > 0 ? `${r.open} ${r.open === 1 ? 'needs' : 'need'} your answer.` : 'All answered. Have a last look, then accept.';

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const res = parseChange(said, sample.lines, edits);
    setStatus(res.say);
    if (res.ok) {
      onEdit(res.lineId, res.patch);
      setSaid('');
    }
  };

  const answer = (item: CheckItem, choiceId: string) => {
    onAnswer(item.key, item.issue.kind, choiceId);
    if (setupFor(item, choiceId) === 'product' && !setupDone(item, setups) && item.line) setSetup({ kind: 'product', lineId: item.line.id });
  };

  const line = sheetLine ? settledLines(sample, answers).find(l => l.id === sheetLine) : undefined;
  const setupLine = setup?.kind === 'product' ? sample.lines.find(l => l.id === setup.lineId) : undefined;
  const active = sheetLine ?? (setup?.kind === 'product' ? setup.lineId : null) ?? hoverLine;
  const column = isWide ? 760 : COLUMN;

  const summary = (
    <>
      <h1 style={{ margin: 0, fontSize: isPhone ? 22 : 24, fontWeight: 600, lineHeight: 1.25 }}>{title}</h1>
      <div aria-hidden style={{ height: 8, borderRadius: 4, background: C.subtle, marginTop: 12, overflow: 'hidden' }}>
        <div style={{ width: `${(matched / Math.max(total, 1)) * 100}%`, height: '100%', background: C.navy, borderRadius: 4 }} />
      </div>
      <p style={{ margin: '12px 0 0', fontSize: 16, color: C.muted, lineHeight: 1.5 }}>{checkedAgainst}</p>
      {better && <BetterOrder po={better} sample={sample} onUse={() => pickOrders([better.poNumber])} />}
      {answerLine && <p style={{ margin: '4px 0 0', fontSize: 16, color: C.ink, fontWeight: 600, lineHeight: 1.5 }}>{answerLine}</p>}
    </>
  );

  const toCheck = r.toCheck.length > 0 && (
    <section aria-labelledby="to-check" style={{ marginTop: 24 }}>
      <h2 id="to-check" style={{ margin: '0 0 10px', fontSize: 16, fontWeight: 600 }}>
        To check &middot; {r.toCheck.length}
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {r.toCheck.map(item => (
          <CheckCard
            key={item.key}
            item={item}
            answers={answers}
            setups={setups}
            onAnswer={id => answer(item, id)}
            onOpen={item.line ? () => setSheetLine(item.line!.id) : undefined}
            onSetup={() => setSetup(item.issue.kind === 'new-supplier' ? { kind: 'supplier' } : { kind: 'product', lineId: item.line!.id })}
            onPickOrder={() => setPicking(true)}
            onHover={setHoverLine}
          />
        ))}
      </div>
    </section>
  );

  const matches = r.matches.length > 0 && (
    <section aria-labelledby="matches" style={{ marginTop: 28 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '0 0 10px' }}>
        <h2 id="matches" style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
          Matches &middot; {r.matches.length}
        </h2>
        {!isWide && <span style={{ fontSize: 12, fontWeight: 600, color: C.muted, paddingRight: 16 }}>{receipt || noOrder ? 'Got' : 'Got / ordered'}</span>}
      </div>
      {isWide ? (
        <MatchTable sample={sample} lines={r.matches} edits={edits} showPo={multiPo} onOpen={setSheetLine} onHover={setHoverLine} />
      ) : (
        <ul style={{ ...card, listStyle: 'none', margin: 0, padding: 0, overflow: 'hidden' }}>
          {r.matches.map((l, i) => (
            <li key={l.id} style={{ borderTop: i === 0 ? 'none' : `1px solid ${C.subtle}` }}>
              <MatchRow sample={sample} line={l} edit={edits[l.id]} showPo={multiPo} onOpen={() => setSheetLine(l.id)} />
            </li>
          ))}
        </ul>
      )}
      <p style={{ margin: '10px 0 0', fontSize: 14, color: C.muted }}>{isWide ? 'Select any line to change it.' : 'Tap any line to change it.'}</p>
    </section>
  );

  const footer = (
    <footer style={{ borderTop: `1px solid ${C.subtle}`, background: '#fff' }}>
      <div style={{ maxWidth: column, margin: '0 auto', padding: '12px 16px calc(14px + env(safe-area-inset-bottom))' }}>
        <div style={{ display: 'flex', gap: 12, flexDirection: isWide ? 'row' : 'column', alignItems: isWide ? 'flex-start' : 'stretch' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <form onSubmit={submit} style={{ position: 'relative', display: 'flex' }}>
              <input
                value={said}
                onChange={e => setSaid(e.target.value)}
                placeholder={'Tell Edify a change: \u201conly 3 eggs\u201d'}
                aria-label="Tell Edify a change"
                style={{
                  flex: 1,
                  minWidth: 0,
                  height: 48,
                  padding: '0 52px 0 14px',
                  borderRadius: 12,
                  border: `1.5px solid ${C.border}`,
                  fontSize: 16,
                  fontFamily: 'var(--font-primary)',
                  color: C.ink,
                  background: '#fff',
                }}
              />
              <button
                type="submit"
                aria-label="Send"
                disabled={!said.trim()}
                style={{
                  position: 'absolute',
                  right: 4,
                  top: 4,
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  border: 'none',
                  background: said.trim() ? C.navy : '#E8E6E3',
                  color: said.trim() ? '#fff' : '#4A413B',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: said.trim() ? 'pointer' : 'default',
                }}
              >
                <ArrowUp size={20} />
              </button>
            </form>
            <div role="status" style={{ fontSize: 14, color: C.ink, fontWeight: 500, minHeight: status ? 20 : 0, marginTop: status ? 8 : 0 }}>
              {status}
            </div>
          </div>
          <div style={{ width: isWide ? 340 : '100%', flexShrink: 0 }}>
            <PrimaryButton disabled={r.open > 0} onClick={onAccept}>
              {acceptLabel(sample, r)}
            </PrimaryButton>
          </div>
        </div>
      </div>
    </footer>
  );

  const header = (
    <header style={{ borderBottom: `1px solid ${C.subtle}`, background: isWide ? '#fff' : C.page }}>
      <div style={{ maxWidth: isWide ? 'none' : COLUMN, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 4, padding: '8px 12px 8px 4px' }}>
        <IconButton label={backLabel} onClick={onBack}>
          {backLabel === 'Close' ? <X size={22} /> : <ChevronLeft size={24} />}
        </IconButton>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.3, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {sample.supplier}
            {receipt && <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 100, border: `1.5px solid ${C.border}`, color: C.ink }}>Off-contract</span>}
          </div>
          <div style={{ fontSize: 15, color: C.muted, lineHeight: 1.4 }}>{subline}</div>
        </div>
        {!isWide && <TextLink onClick={() => setPhoto({})}>Photo</TextLink>}
      </div>
    </header>
  );

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {header}
      {isWide ? (
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          <div style={{ width: '40%', maxWidth: 620, minWidth: 380, borderRight: `1px solid ${C.subtle}` }}>
            <PhotoPane sample={sample} activeLineId={active} flaggedLineIds={flagged} onOpenFull={() => setPhoto({ focus: active ?? undefined })} />
          </div>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <main style={{ flex: 1, overflowY: 'auto' }}>
              <div style={{ maxWidth: column, margin: '0 auto', padding: '24px 32px 32px' }}>
                {summary}
                {toCheck}
                {matches}
                <Totals sample={sample} edits={edits} credit={r.credit} />
              </div>
            </main>
            {footer}
          </div>
        </div>
      ) : (
        <>
          <main style={{ flex: 1, overflowY: 'auto' }}>
            <div style={{ maxWidth: COLUMN, margin: '0 auto', padding: '20px 16px 24px' }}>
              {summary}
              {toCheck}
              {matches}
            </div>
          </main>
          {footer}
        </>
      )}

      {line && (
        <LineSheet
          sample={sample}
          line={line}
          edit={edits[line.id]}
          isPhone={isPhone}
          showCrop={!isWide}
          onEdit={patch => onEdit(line.id, patch)}
          onClose={() => setSheetLine(null)}
          onOpenPhoto={() => setPhoto({ focus: line.id })}
        />
      )}
      {setupLine?.setup && (
        <ProductSetupSheet
          sample={sample}
          initial={setups.products[setupLine.id] ?? setupLine.setup}
          isPhone={isPhone}
          onClose={() => setSetup(null)}
          onSave={p => {
            onSetupProduct(setupLine.id, p);
            setSetup(null);
          }}
        />
      )}
      {setup?.kind === 'supplier' && sample.supplierSeed && (
        <SupplierSheet
          initial={setups.supplier ?? sample.supplierSeed}
          site={sample.site}
          isPhone={isPhone}
          onClose={() => setSetup(null)}
          onSave={s => {
            onSetupSupplier(s);
            onAnswer(SUPPLIER_KEY, 'new-supplier', 'add');
            setSetup(null);
          }}
        />
      )}
      {picking && <OrderSheet sample={sample} isPhone={isPhone} onPick={pickOrders} onClose={() => setPicking(false)} />}
      {photo && <PhotoViewer sample={sample} focusLineId={photo.focus} onClose={() => setPhoto(null)} />}
    </div>
  );
}

/** Net, VAT and total as printed, using the billed quantity where the driver corrected it. */
function paperSums(sample: Sample) {
  let net = 0;
  let vat = 0;
  for (const l of sample.lines) {
    const n = (l.price ?? 0) * (l.billed ?? l.got);
    net += n;
    vat += (n * (l.vatRate ?? 0)) / 100;
  }
  return { net, vat, total: net + vat };
}

export function CheckCard({
  item,
  answers,
  setups,
  onAnswer,
  onOpen,
  onSetup,
  onPickOrder,
  onHover,
}: {
  item: CheckItem;
  answers: Answers;
  setups: Setups;
  onAnswer: (choiceId: string) => void;
  onOpen?: () => void;
  onSetup: () => void;
  onPickOrder?: () => void;
  onHover: (lineId: string | null) => void;
}) {
  const value = answerFor(answers, item);
  const chosen = item.issue.choices.find(c => c.id === value);
  const needs = setupFor(item, value);
  const done = setupDone(item, setups);
  const answered = !!chosen && (!needs || done);
  const suggested = chosen && isSuggested(answers, item);
  const supplierItem = item.issue.kind === 'new-supplier';
  const product = item.line ? setups.products[item.line.id] : undefined;

  const heading = (
    <>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 600, lineHeight: 1.35 }}>
          {item.issue.title}
          {answered && (
            <>
              <Check size={18} aria-hidden style={{ flexShrink: 0 }} />
              <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Answered</span>
            </>
          )}
        </span>
        <span style={{ display: 'block', fontSize: 14, color: C.muted, marginTop: 2, lineHeight: 1.45 }}>{keepIds(item.issue.detail)}</span>
      </span>
      {onOpen && <ChevronRight size={20} aria-hidden style={{ flexShrink: 0, marginTop: 2, color: C.muted }} />}
    </>
  );

  let below: ReactNode = null;
  if (item.issue.kind === 'no-order') {
    below = answered ? (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 6px 6px 12px', borderRadius: 12, background: C.page }}>
        <Check size={18} aria-hidden style={{ flexShrink: 0 }} />
        <span style={{ flex: 1, minWidth: 0, fontSize: 14, lineHeight: 1.45 }}>Receiving it with no order, at your prices.</span>
        {onPickOrder && <TextLink onClick={onPickOrder}>Change</TextLink>}
      </div>
    ) : (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {onPickOrder && <PrimaryButton onClick={onPickOrder}>Find the order</PrimaryButton>}
        <SecondaryButton onClick={() => onAnswer('none')}>{item.issue.choices[0].label}</SecondaryButton>
      </div>
    );
  } else if (item.issue.kind === 'unsure') {
    below = <PairPicker item={item} value={value} onAnswer={onAnswer} />;
  } else if (supplierItem) {
    below = done ? (
      <SetupDone onEdit={onSetup}>
        <span style={{ fontWeight: 600 }}>{setups.supplier!.name}</span> added as a shop with no ordering, {shopSites(setups.supplier!.details?.sites)}.
      </SetupDone>
    ) : (
      <PrimaryButton onClick={onSetup}>{item.issue.choices[0].label}</PrimaryButton>
    );
  } else {
    below = (
      <>
        <ChoiceList label={item.issue.title} choices={item.issue.choices} value={value} onChange={onAnswer} />
        {needs === 'product' &&
          (done && product ? (
            <div style={{ marginTop: 10 }}>
              <SetupDone onEdit={onSetup}>
                <span style={{ fontWeight: 600 }}>{product.name}</span>, {packWords(product).replace(/^[A-Z][a-z]/, w => w.toLowerCase())} at {gbp(product.packCost)}. Under {product.master}.
              </SetupDone>
            </div>
          ) : (
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '10px 12px', borderRadius: 12, background: '#FFF6E5' }}>
              <AlertCircle size={18} aria-hidden style={{ flexShrink: 0, color: '#8A4B00' }} />
              <span style={{ flex: 1, minWidth: 160, fontSize: 14, color: C.ink, lineHeight: 1.4 }}>Set it up before you accept.</span>
              <button
                type="button"
                onClick={onSetup}
                style={{ minHeight: 40, padding: '0 14px', borderRadius: 10, border: 'none', background: C.navy, color: '#fff', fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-primary)', cursor: 'pointer' }}
              >
                Set it up
              </button>
            </div>
          ))}
        {!needs && (chosen?.note || suggested) && (
          <p style={{ margin: '10px 0 0', fontSize: 14, color: C.muted, lineHeight: 1.45 }}>
            {suggested && <span style={{ fontWeight: 600, color: C.ink }}>Suggested by Edify. </span>}
            {chosen?.note && keepIds(chosen.note)}
          </p>
        )}
      </>
    );
  }

  return (
    <div
      style={{ ...card, padding: 14 }}
      onMouseEnter={() => item.line && onHover(item.line.id)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => item.line && onHover(item.line.id)}
    >
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          aria-label={`${item.issue.title}: change the line`}
          style={{ display: 'flex', alignItems: 'flex-start', gap: 8, width: '100%', padding: 0, border: 'none', background: 'none', textAlign: 'left', color: C.ink, fontFamily: 'var(--font-primary)', cursor: 'pointer' }}
        >
          {heading}
        </button>
      ) : (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>{heading}</div>
      )}
      <div style={{ marginTop: 12 }}>{below}</div>
    </div>
  );
}

/** Which product on the order a line is: Edify's one guess as a single tap, and everything still open in a dropdown. */
function PairPicker({ item, value, onAnswer }: { item: CheckItem; value: string | undefined; onAnswer: (choiceId: string) => void }) {
  const { choices, guess, hint, title } = item.issue;
  const offer = guess && !value ? guess : undefined;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {offer && <SecondaryButton onClick={() => onAnswer(offer.id)}>Yes, it&rsquo;s {offer.label}</SecondaryButton>}
      <div>
        <Picker
          label={offer ? 'Or pick what it is' : 'Which product on your order is it?'}
          context={title}
          placeholder="Choose a product"
          choices={choices}
          value={value}
          onChange={onAnswer}
        />
        {hint && !value && <p style={{ margin: '6px 0 0', fontSize: 14, color: C.muted, lineHeight: 1.4 }}>{hint}</p>}
      </div>
    </div>
  );
}

function shopSites(sites: string[] | undefined): string {
  if (!sites?.length) return 'at no sites yet';
  return sites.length === 1 ? `at ${sites[0]}` : `at ${sites.length} sites`;
}

function SetupDone({ children, onEdit }: { children: ReactNode; onEdit: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 6px 6px 12px', borderRadius: 12, background: C.page }}>
      <Check size={18} aria-hidden style={{ flexShrink: 0 }} />
      <span style={{ flex: 1, minWidth: 0, fontSize: 14, lineHeight: 1.45 }}>{children}</span>
      <TextLink onClick={onEdit}>Edit</TextLink>
    </div>
  );
}

function MatchRow({ sample, line, edit, showPo, onOpen }: { sample: Sample; line: SeedLine; edit: LineEdit; showPo: boolean; onOpen: () => void }) {
  const sub = line.links ? `Links to ${line.links}` : showPo ? poFor(sample, line) : undefined;
  return (
    <button
      type="button"
      onClick={onOpen}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        minHeight: 44,
        padding: '8px 14px',
        border: 'none',
        background: '#fff',
        textAlign: 'left',
        fontFamily: 'var(--font-primary)',
        color: C.ink,
        cursor: 'pointer',
      }}
    >
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 16, fontWeight: 500, lineHeight: 1.35 }}>{line.name}</span>
        {sub && <span style={{ display: 'block', fontSize: 14, color: C.muted, lineHeight: 1.35 }}>{sub}</span>}
      </span>
      <span style={{ fontSize: 15, fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
        {line.ordered == null ? edit.got : `${edit.got} / ${line.ordered}`}
      </span>
    </button>
  );
}

/** Every matched line with what Edify read: pack, quantities, prices and VAT. */
function MatchTable({
  sample,
  lines,
  edits,
  showPo,
  onOpen,
  onHover,
}: {
  sample: Sample;
  lines: SeedLine[];
  edits: Record<string, LineEdit>;
  showPo: boolean;
  onOpen: (lineId: string) => void;
  onHover: (lineId: string | null) => void;
}) {
  const invoice = sample.kind === 'invoice';
  const receipt = sample.kind === 'receipt';
  const priced = invoice || receipt;
  const th: CSSProperties = { padding: '10px 12px', fontSize: 12, fontWeight: 600, color: C.muted, textAlign: 'right', whiteSpace: 'nowrap', borderBottom: `1px solid ${C.subtle}` };
  const td: CSSProperties = { padding: '8px 12px', fontSize: 14, textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', borderTop: `1px solid ${C.subtle}` };
  return (
    <div style={{ ...card, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ ...th, textAlign: 'left', paddingLeft: 16 }}>Product</th>
            <th style={{ ...th, textAlign: 'left' }}>Pack</th>
            <th style={th}>{receipt || hasNoOrder(sample) ? 'Got' : 'Got / ordered'}</th>
            {priced && <th style={th}>Unit cost</th>}
            {!receipt && <th style={th}>{hasNoOrder(sample) ? 'Your price' : 'Order price'}</th>}
            {priced && <th style={th}>VAT</th>}
            <th style={{ ...th, paddingRight: 16 }}>{priced ? 'Total' : 'Value'}</th>
          </tr>
        </thead>
        <tbody>
          {lines.map(l => {
            const e = edits[l.id];
            const unit = l.price ?? l.orderPrice ?? 0;
            const qty = priced ? (l.billed ?? e.got) : e.got;
            const sub = l.links ? `Links to ${l.links}` : showPo ? poFor(sample, l) : l.code;
            return (
              <tr key={l.id} onMouseEnter={() => onHover(l.id)} onMouseLeave={() => onHover(null)}>
                <td style={{ ...td, textAlign: 'left', whiteSpace: 'normal', padding: 0, borderTop: td.borderTop }}>
                  <button
                    type="button"
                    onClick={() => onOpen(l.id)}
                    onFocus={() => onHover(l.id)}
                    onBlur={() => onHover(null)}
                    style={{ display: 'block', width: '100%', minHeight: 44, padding: '6px 12px 6px 16px', border: 'none', background: 'none', textAlign: 'left', fontFamily: 'var(--font-primary)', color: C.ink, cursor: 'pointer' }}
                  >
                    <span style={{ display: 'block', fontSize: 15, fontWeight: 500, lineHeight: 1.3 }}>{l.name}</span>
                    {sub && <span style={{ display: 'block', fontSize: 13, fontWeight: 500, color: C.muted, lineHeight: 1.3 }}>{sub}</span>}
                  </button>
                </td>
                <td style={{ ...td, textAlign: 'left', color: C.muted }}>{l.pack}</td>
                <td style={{ ...td, fontWeight: 600 }}>{l.ordered == null ? e.got : `${e.got} / ${l.ordered}`}</td>
                {priced && <td style={td}>{gbp(unit)}</td>}
                {!receipt && <td style={{ ...td, color: C.muted }}>{l.orderPrice != null ? gbp(l.orderPrice) : '\u2013'}</td>}
                {priced && <td style={{ ...td, color: C.muted }}>{l.vatRate ? `${l.vatRate}%` : '0%'}</td>}
                <td style={{ ...td, paddingRight: 16, fontWeight: 600 }}>{gbp(unit * qty)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Totals({ sample, edits, credit }: { sample: Sample; edits: Record<string, LineEdit>; credit: number }) {
  const priced = hasPrices(sample);
  const rows: { label: string; value: string; strong?: boolean }[] = [];
  let check: string | null = null;
  if (priced) {
    const s = paperSums(sample);
    rows.push({ label: 'Lines', value: gbp(s.net) }, { label: 'VAT', value: gbp(s.vat) });
    rows.push({ label: sample.kind === 'receipt' ? 'Total paid' : 'Invoice total', value: gbp(s.total), strong: true });
    check = `The lines add up to the ${sample.kind === 'receipt' ? 'receipt' : 'invoice'} total.`;
  } else {
    const value = sample.lines.reduce((sum, l) => sum + (l.orderPrice ?? 0) * edits[l.id].got, 0);
    rows.push({ label: hasNoOrder(sample) ? 'Value at your prices' : 'Value at your order prices', value: gbp(value), strong: true });
    check = 'Delivery notes have no prices. The invoice is matched when it arrives.';
  }
  if (credit > 0) rows.push({ label: 'Credit to ask for', value: gbp(credit), strong: true });
  return (
    <section aria-label="Totals" style={{ marginTop: 28, display: 'flex', justifyContent: 'flex-end' }}>
      <div style={{ ...card, padding: '14px 16px', width: 360 }}>
        {rows.map(row => (
          <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '4px 0', fontSize: 15, fontWeight: row.strong ? 600 : 500 }}>
            <span style={{ color: row.strong ? C.ink : C.muted }}>{row.label}</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{row.value}</span>
          </div>
        ))}
        {check && (
          <div style={{ display: 'flex', gap: 8, marginTop: 8, paddingTop: 10, borderTop: `1px solid ${C.subtle}`, fontSize: 14, color: C.muted, lineHeight: 1.4 }}>
            {priced && <Check size={16} aria-hidden style={{ flexShrink: 0, marginTop: 2, color: C.ink }} />}
            {check}
          </div>
        )}
      </div>
    </section>
  );
}

export function LineSheet({
  sample,
  line,
  edit,
  isPhone,
  showCrop,
  onEdit,
  onClose,
  onOpenPhoto,
}: {
  sample: Sample;
  line: SeedLine;
  edit: LineEdit;
  isPhone: boolean;
  showCrop: boolean;
  onEdit: (patch: Partial<LineEdit>) => void;
  onClose: () => void;
  onOpenPhoto: () => void;
}) {
  const po = poFor(sample, line);
  const kind = KIND_WORD[sample.kind];
  const label: CSSProperties = { fontSize: 14, fontWeight: 600, margin: '20px 0 8px' };
  const toggle = (on: boolean): CSSProperties => ({
    minHeight: 48,
    padding: '10px 16px',
    borderRadius: 12,
    border: on ? `2px solid ${C.navy}` : `1.5px solid ${C.border}`,
    background: on ? C.navy : '#fff',
    color: on ? '#fff' : C.ink,
    fontSize: 15,
    fontWeight: 600,
    fontFamily: 'var(--font-primary)',
    cursor: 'pointer',
  });
  return (
    <Sheet
      title={line.name}
      subtitle={`${line.notOnPaper ? `Not on the ${kind}` : `\u201c${line.printed}\u201d on the ${kind}`}${po ? ` \u00b7 ${po}` : ''}`}
      onClose={onClose}
      isPhone={isPhone}
      placement={showCrop ? 'center' : 'right'}
      footer={<PrimaryButton onClick={onClose}>Done</PrimaryButton>}
    >
      {line.notOnPaper ? null : showCrop ? (
        <>
          <LineCrop sample={sample} lineId={line.id} alt={`The ${line.name} line on the ${kind}`} />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <TextLink onClick={onOpenPhoto}>See it on the photo</TextLink>
          </div>
        </>
      ) : (
        <p style={{ margin: '0 0 4px', fontSize: 14, color: C.muted }}>Outlined on the photo.</p>
      )}

      <div style={{ ...label, marginTop: 8 }}>How many arrived?</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <Stepper label="How many arrived" value={edit.got} onChange={v => onEdit({ got: v, damaged: Math.min(edit.damaged, v) })} />
        <span style={{ fontSize: 14, color: C.muted }}>
          {line.ordered != null ? `Ordered ${line.ordered}` : line.issue?.kind === 'unsure' ? 'Not matched to your order yet' : 'Not on an order'}
          {line.price != null ? ` \u00b7 ${gbp(line.price)} each` : line.orderPrice != null ? ` \u00b7 ${gbp(line.orderPrice)} each on your order` : ''}
        </span>
      </div>

      {!line.issue && (
        <>
          <div style={label}>Something wrong with it?</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              aria-pressed={edit.damaged > 0}
              onClick={() => onEdit({ damaged: edit.damaged > 0 ? 0 : Math.min(1, edit.got) })}
              disabled={edit.got === 0}
              style={toggle(edit.damaged > 0)}
            >
              Some are damaged
            </button>
            <button type="button" aria-pressed={edit.wrong} onClick={() => onEdit({ wrong: !edit.wrong })} style={toggle(edit.wrong)}>
              Wrong product
            </button>
          </div>
          {edit.damaged > 0 && (
            <>
              <div style={label}>How many are damaged?</div>
              <Stepper label="How many are damaged" value={edit.damaged} min={1} max={edit.got} onChange={v => onEdit({ damaged: v })} />
            </>
          )}
        </>
      )}
    </Sheet>
  );
}
