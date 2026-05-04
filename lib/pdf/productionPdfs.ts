/**
 * PDF builders for the Production / Bench view.
 *
 * Three exports — one per download surface on /production/board:
 *
 *  - downloadBenchPdf            → "the bench view": work scheduled on a single
 *                                  bench, mirroring the BenchCard layout.
 *  - downloadBenchSummaryPdf     → "bench summary with ingredients": the right-
 *                                  drawer roll-up of components needed on the
 *                                  bench plus the per-recipe breakdown.
 *  - downloadAllIngredientsPdf   → "entire production day": every bench in the
 *                                  site, plus a site-wide component rollup.
 *
 * All three accept the same `PlanLine[]` snapshot the on-screen components
 * already hold (from `usePlan(siteId, date)`), so PDFs reflect any manager
 * overrides the user has made in this session.
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

import {
  effectiveBatchRules,
  getBench,
  getRecipe,
  getSite,
  proposeBatchSplit,
  type Bench,
  type ProductionMode,
  type SiteId,
} from '@/components/Production/fixtures';
import { FILLING_TRAY_GRAMS, type PlanLine } from '@/components/Production/PlanStore';

// ─── Page setup ─────────────────────────────────────────────────────────────

const PAGE_MARGIN = 14; // mm
const HEADER_COLOR: [number, number, number] = [37, 47, 73];
const ACCENT_COLOR: [number, number, number] = [29, 78, 216];
const MUTED_COLOR: [number, number, number] = [110, 119, 138];
const ROW_ALT_COLOR: [number, number, number] = [248, 249, 251];

type DocCursor = { y: number };

function newDoc() {
  // A4 portrait, 210 × 297 mm.
  return new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
}

function pageWidth(doc: jsPDF) {
  return doc.internal.pageSize.getWidth();
}

function pageHeight(doc: jsPDF) {
  return doc.internal.pageSize.getHeight();
}

/**
 * Stamp the page with a kitchen-print friendly header: title, subtitle,
 * site/date strip on the right. Returns the cursor below the divider so the
 * caller can keep stacking sections.
 */
function drawHeader(
  doc: jsPDF,
  title: string,
  subtitle: string,
  meta: { site: string; date: string },
): DocCursor {
  const w = pageWidth(doc);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...HEADER_COLOR);
  doc.text(title, PAGE_MARGIN, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...MUTED_COLOR);
  doc.text(subtitle, PAGE_MARGIN, 24);

  // Right-aligned meta block.
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...HEADER_COLOR);
  doc.text(meta.site, w - PAGE_MARGIN, 18, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...MUTED_COLOR);
  doc.text(meta.date, w - PAGE_MARGIN, 24, { align: 'right' });

  // Divider.
  doc.setDrawColor(220, 224, 231);
  doc.setLineWidth(0.3);
  doc.line(PAGE_MARGIN, 28, w - PAGE_MARGIN, 28);

  return { y: 34 };
}

/**
 * Stamp every page with a footer (page n / total · generated date). Called
 * once at the end after all pages exist so totals are accurate.
 */
function drawFooters(doc: jsPDF, generatedAt: Date) {
  const total = doc.getNumberOfPages();
  const stamp = generatedAt.toLocaleString();
  const w = pageWidth(doc);
  const h = pageHeight(doc);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED_COLOR);
  for (let i = 1; i <= total; i += 1) {
    doc.setPage(i);
    doc.text(`Generated ${stamp}`, PAGE_MARGIN, h - 8);
    doc.text(`Page ${i} / ${total}`, w - PAGE_MARGIN, h - 8, { align: 'right' });
  }
}

function sectionTitle(doc: jsPDF, cursor: DocCursor, title: string, hint?: string) {
  ensureSpace(doc, cursor, 14);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...HEADER_COLOR);
  doc.text(title, PAGE_MARGIN, cursor.y);
  if (hint) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...MUTED_COLOR);
    doc.text(hint, PAGE_MARGIN, cursor.y + 4.5);
    cursor.y += 9;
  } else {
    cursor.y += 5;
  }
}

function ensureSpace(doc: jsPDF, cursor: DocCursor, needed: number) {
  if (cursor.y + needed > pageHeight(doc) - 18) {
    doc.addPage();
    cursor.y = 18;
  }
}

/** Pull `finalY` off the latest autoTable run so we can stack sections. */
function lastTableY(doc: jsPDF): number {
  // jspdf-autotable stashes the last result on the doc instance.
  const anyDoc = doc as unknown as { lastAutoTable?: { finalY: number } };
  return anyDoc.lastAutoTable?.finalY ?? 0;
}

// ─── Domain helpers ─────────────────────────────────────────────────────────

const MODE_LABEL: Record<ProductionMode, string> = {
  run: 'Run',
  variable: 'Variable',
  increment: 'Drops',
};

type RecipeRow = {
  name: string;
  category: string;
  mode: ProductionMode;
  qty: number;
  batches: number[];
  isAssembly: boolean;
  isComponent: boolean;
  isOverridden: boolean;
};

function rowsForBench(lines: PlanLine[], benchId: string): RecipeRow[] {
  return lines
    .filter(l => l.primaryBench?.id === benchId && l.effectivePlanned > 0)
    .map(l => {
      const eff = effectiveBatchRules(l.recipe.batchRules, l.primaryBench?.batchRules);
      const split = proposeBatchSplit(l.effectivePlanned, eff);
      return {
        name: l.recipe.name,
        category: l.recipe.category,
        mode: l.item.mode,
        qty: l.effectivePlanned,
        batches: split.batches,
        isAssembly: !!l.recipe.subRecipes && l.recipe.subRecipes.length > 0,
        isComponent: l.assemblyDemand.sources.length > 0,
        isOverridden: l.isOverridden,
      };
    })
    .sort((a, b) => b.qty - a.qty);
}

function formatBatches(batches: number[]): string {
  if (batches.length === 0) return '—';
  if (batches.length === 1) return String(batches[0]);
  if (batches.every(b => b === batches[0])) return `${batches.length} × ${batches[0]}`;
  return batches.join(' + ');
}

function formatTags(row: RecipeRow): string {
  const tags: string[] = [];
  if (row.isAssembly) tags.push('Assembly');
  if (row.isComponent) tags.push('Component');
  if (row.isOverridden) tags.push('Manager edit');
  return tags.join(' · ');
}

type ComponentDemand = {
  recipeId: string;
  name: string;
  totalQty: number;
  unit: 'unit' | 'g';
  trayCount?: number;
  drivers: Array<{ parentName: string; parentQty: number; perUnit: number; perUnitLabel: string }>;
};

/**
 * Same component aggregation the BenchIngredientsPanel runs — kept here so
 * the PDF and the on-screen drawer agree on totals. Produces one row per
 * sub-recipe consumed by this bench's assemblies.
 */
function rollupComponentsForBench(lines: PlanLine[], benchId: string): ComponentDemand[] {
  const demands = new Map<string, ComponentDemand>();
  const benchLines = lines.filter(l => l.primaryBench?.id === benchId && l.effectivePlanned > 0);
  for (const line of benchLines) {
    const subs = line.recipe.subRecipes;
    if (!subs || subs.length === 0) continue;
    for (const sub of subs) {
      const subRecipe = getRecipe(sub.recipeId);
      if (!subRecipe) continue;
      const unit: 'unit' | 'g' = sub.unit === 'unit' ? 'unit' : 'g';
      const qty = sub.quantityPerUnit * line.effectivePlanned;
      const driver = {
        parentName: line.recipe.name,
        parentQty: line.effectivePlanned,
        perUnit: sub.quantityPerUnit,
        perUnitLabel: sub.unit === 'unit' ? '' : sub.unit,
      };
      const existing = demands.get(sub.recipeId);
      if (existing) {
        existing.totalQty += qty;
        existing.drivers.push(driver);
      } else {
        demands.set(sub.recipeId, {
          recipeId: sub.recipeId,
          name: subRecipe.name,
          totalQty: qty,
          unit,
          drivers: [driver],
        });
      }
    }
  }
  for (const d of demands.values()) {
    if (d.unit === 'g') d.trayCount = Math.ceil(d.totalQty / FILLING_TRAY_GRAMS);
  }
  return Array.from(demands.values()).sort((a, b) => b.totalQty - a.totalQty);
}

function formatComponentTotal(d: ComponentDemand): string {
  if (d.unit === 'unit') return `${d.totalQty} units`;
  const kg = (d.totalQty / 1000).toFixed(1);
  if (d.trayCount != null) {
    return `${kg} kg · ${d.trayCount} tray${d.trayCount === 1 ? '' : 's'}`;
  }
  return `${kg} kg`;
}

function formatDrivers(drivers: ComponentDemand['drivers']): string {
  return drivers
    .map(d => `${d.parentName} (${d.parentQty} × ${d.perUnit}${d.perUnitLabel}/ea)`)
    .join('\n');
}

// ─── Section: bench recipes table ───────────────────────────────────────────

function drawBenchRecipesTable(doc: jsPDF, cursor: DocCursor, rows: RecipeRow[]) {
  if (rows.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(...MUTED_COLOR);
    doc.text('No recipes scheduled on this bench today.', PAGE_MARGIN, cursor.y);
    cursor.y += 8;
    return;
  }

  autoTable(doc, {
    startY: cursor.y,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
    head: [['Recipe', 'Category', 'Mode', 'Qty', 'Batches', 'Notes']],
    body: rows.map(r => [
      r.name,
      r.category,
      MODE_LABEL[r.mode],
      String(r.qty),
      formatBatches(r.batches),
      formatTags(r),
    ]),
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 2.5, textColor: HEADER_COLOR },
    headStyles: { fillColor: HEADER_COLOR, textColor: 255, fontStyle: 'bold', fontSize: 9 },
    alternateRowStyles: { fillColor: ROW_ALT_COLOR },
    columnStyles: {
      0: { cellWidth: 60, fontStyle: 'bold' },
      1: { cellWidth: 22 },
      2: { cellWidth: 18 },
      3: { cellWidth: 14, halign: 'right' },
      4: { cellWidth: 28, halign: 'right' },
      5: { cellWidth: 'auto', textColor: MUTED_COLOR, fontSize: 8 },
    },
  });
  cursor.y = lastTableY(doc) + 6;
}

// ─── Section: components rollup table ───────────────────────────────────────

function drawComponentsTable(doc: jsPDF, cursor: DocCursor, demands: ComponentDemand[]) {
  if (demands.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(...MUTED_COLOR);
    doc.text('No component breakdown — no assemblies on this bench.', PAGE_MARGIN, cursor.y);
    cursor.y += 8;
    return;
  }

  autoTable(doc, {
    startY: cursor.y,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
    head: [['Component', 'Total needed', 'Drives from']],
    body: demands.map(d => [d.name, formatComponentTotal(d), formatDrivers(d.drivers)]),
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 9,
      cellPadding: 2.5,
      textColor: HEADER_COLOR,
      valign: 'top',
    },
    headStyles: { fillColor: ACCENT_COLOR, textColor: 255, fontStyle: 'bold', fontSize: 9 },
    alternateRowStyles: { fillColor: ROW_ALT_COLOR },
    columnStyles: {
      0: { cellWidth: 60, fontStyle: 'bold' },
      1: { cellWidth: 40, halign: 'right', fontStyle: 'bold' },
      2: { cellWidth: 'auto', textColor: MUTED_COLOR, fontSize: 8 },
    },
  });
  cursor.y = lastTableY(doc) + 6;
}

// ─── Bench header strip ─────────────────────────────────────────────────────

function drawBenchInfoStrip(doc: jsPDF, cursor: DocCursor, bench: Bench) {
  ensureSpace(doc, cursor, 16);
  doc.setFillColor(...ROW_ALT_COLOR);
  doc.rect(PAGE_MARGIN, cursor.y - 4, pageWidth(doc) - PAGE_MARGIN * 2, 12, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...HEADER_COLOR);
  doc.text(bench.name, PAGE_MARGIN + 3, cursor.y + 1.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED_COLOR);
  const meta: string[] = [];
  if (bench.primaryMode) meta.push(`Primary mode: ${MODE_LABEL[bench.primaryMode]}`);
  meta.push(bench.capabilities.join(' · '));
  if (!bench.online) meta.push('OFFLINE');
  doc.text(meta.join('   |   '), PAGE_MARGIN + 3, cursor.y + 6);

  cursor.y += 14;
}

// ─── Builder: bench view ────────────────────────────────────────────────────

export function downloadBenchPdf(opts: {
  siteId: SiteId;
  date: string;
  benchId: string;
  lines: PlanLine[];
}) {
  const { siteId, date, benchId, lines } = opts;
  const site = getSite(siteId);
  const bench = getBench(benchId);
  if (!site || !bench) return;

  const doc = newDoc();
  const cursor = drawHeader(
    doc,
    'Bench plan',
    `${bench.name} · ${bench.capabilities.join(' · ')}`,
    { site: site.name, date: formatDateLong(date) },
  );

  const rows = rowsForBench(lines, benchId);

  sectionTitle(
    doc,
    cursor,
    'Recipes scheduled',
    `${rows.length} recipe${rows.length === 1 ? '' : 's'} totalling ${rows.reduce(
      (s, r) => s + r.qty,
      0,
    )} units across ${rows.reduce((s, r) => s + r.batches.length, 0)} batches.`,
  );
  drawBenchRecipesTable(doc, cursor, rows);

  drawFooters(doc, new Date());
  doc.save(filename('bench', site.name, bench.name, date));
}

// ─── Builder: bench summary with ingredients ────────────────────────────────

export function downloadBenchSummaryPdf(opts: {
  siteId: SiteId;
  date: string;
  benchId: string;
  lines: PlanLine[];
}) {
  const { siteId, date, benchId, lines } = opts;
  const site = getSite(siteId);
  const bench = getBench(benchId);
  if (!site || !bench) return;

  const doc = newDoc();
  const cursor = drawHeader(
    doc,
    'Bench summary',
    `${bench.name} · staging list & component totals`,
    { site: site.name, date: formatDateLong(date) },
  );

  const rows = rowsForBench(lines, benchId);
  const components = rollupComponentsForBench(lines, benchId);

  sectionTitle(
    doc,
    cursor,
    'Components needed',
    components.length === 0
      ? 'No assemblies on this bench — nothing to stage.'
      : `Aggregated across ${rows.length} recipe${rows.length === 1 ? '' : 's'}.`,
  );
  drawComponentsTable(doc, cursor, components);

  sectionTitle(
    doc,
    cursor,
    'Recipes on this bench',
    `${rows.length} recipe${rows.length === 1 ? '' : 's'} planned today.`,
  );
  drawBenchRecipesTable(doc, cursor, rows);

  drawFooters(doc, new Date());
  doc.save(filename('bench-summary', site.name, bench.name, date));
}

// ─── Builder: every bench summary in one PDF ────────────────────────────────

/**
 * One combined PDF, one section per bench that has scheduled work today.
 * Each bench gets its info strip → components-needed table → recipes-on-this-
 * bench table, mirroring `downloadBenchSummaryPdf` but for every bench at
 * the site. New benches start on their own page so prep teams can rip them
 * apart and hand each section to whoever's running that station.
 */
export function downloadAllBenchSummariesPdf(opts: {
  siteId: SiteId;
  date: string;
  lines: PlanLine[];
}) {
  const { siteId, date, lines } = opts;
  const site = getSite(siteId);
  if (!site) return;

  const doc = newDoc();
  const cursor = drawHeader(
    doc,
    'Bench summaries',
    `Component staging & recipes per bench at ${site.name}.`,
    { site: site.name, date: formatDateLong(date) },
  );

  const benchIds = uniqueBenchIdsFromLines(lines);
  if (benchIds.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(...MUTED_COLOR);
    doc.text('No benches with work scheduled today.', PAGE_MARGIN, cursor.y);
  } else {
    benchIds.forEach((benchId, idx) => {
      const bench = getBench(benchId);
      if (!bench) return;
      const rows = rowsForBench(lines, benchId);
      const components = rollupComponentsForBench(lines, benchId);
      if (rows.length === 0) return;

      // Each bench starts on a fresh page after the first so prep teams
      // can detach and hand around.
      if (idx > 0) {
        doc.addPage();
        cursor.y = 18;
      }

      drawBenchInfoStrip(doc, cursor, bench);

      sectionTitle(
        doc,
        cursor,
        'Components needed',
        components.length === 0
          ? 'No assemblies on this bench — nothing to stage.'
          : `Aggregated across ${rows.length} recipe${rows.length === 1 ? '' : 's'}.`,
      );
      drawComponentsTable(doc, cursor, components);

      sectionTitle(
        doc,
        cursor,
        'Recipes on this bench',
        `${rows.length} recipe${rows.length === 1 ? '' : 's'} planned today.`,
      );
      drawBenchRecipesTable(doc, cursor, rows);
    });
  }

  drawFooters(doc, new Date());
  doc.save(filename('bench-summaries', site.name, undefined, date));
}

// ─── Builder: every individual bench plan in one PDF ────────────────────────

/**
 * One combined PDF, one bench plan per page — same content as
 * `downloadBenchPdf` but rolled across every bench with scheduled work.
 * Designed for the "print all individual benches" workflow where each
 * station gets the recipes-scheduled view on its own page.
 */
export function downloadAllBenchPlansPdf(opts: {
  siteId: SiteId;
  date: string;
  lines: PlanLine[];
}) {
  const { siteId, date, lines } = opts;
  const site = getSite(siteId);
  if (!site) return;

  const doc = newDoc();
  const cursor = drawHeader(
    doc,
    'Bench plans',
    `Every bench at ${site.name}, one per page.`,
    { site: site.name, date: formatDateLong(date) },
  );

  const benchIds = uniqueBenchIdsFromLines(lines);
  if (benchIds.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(...MUTED_COLOR);
    doc.text('No benches with work scheduled today.', PAGE_MARGIN, cursor.y);
  } else {
    benchIds.forEach((benchId, idx) => {
      const bench = getBench(benchId);
      if (!bench) return;
      const rows = rowsForBench(lines, benchId);
      if (rows.length === 0) return;

      if (idx > 0) {
        doc.addPage();
        cursor.y = 18;
      }

      drawBenchInfoStrip(doc, cursor, bench);

      sectionTitle(
        doc,
        cursor,
        'Recipes scheduled',
        `${rows.length} recipe${rows.length === 1 ? '' : 's'} totalling ${rows.reduce(
          (s, r) => s + r.qty,
          0,
        )} units across ${rows.reduce((s, r) => s + r.batches.length, 0)} batches.`,
      );
      drawBenchRecipesTable(doc, cursor, rows);
    });
  }

  drawFooters(doc, new Date());
  doc.save(filename('bench-plans', site.name, undefined, date));
}

// ─── Builder: entire production day ingredient list ─────────────────────────

export function downloadAllIngredientsPdf(opts: {
  siteId: SiteId;
  date: string;
  lines: PlanLine[];
}) {
  const { siteId, date, lines } = opts;
  const site = getSite(siteId);
  if (!site) return;

  const doc = newDoc();
  const cursor = drawHeader(
    doc,
    'Production-day ingredient sheet',
    `Every bench at ${site.name}, with site-wide component rollup.`,
    { site: site.name, date: formatDateLong(date) },
  );

  // Buckets: bench → its rows + components.
  const benchIds = uniqueBenchIdsFromLines(lines);
  type Bucket = {
    bench: Bench;
    rows: RecipeRow[];
    components: ComponentDemand[];
  };
  const buckets: Bucket[] = benchIds
    .map(id => {
      const b = getBench(id);
      if (!b) return null;
      return {
        bench: b,
        rows: rowsForBench(lines, id),
        components: rollupComponentsForBench(lines, id),
      } as Bucket;
    })
    .filter((b): b is Bucket => !!b && b.rows.length > 0);

  // Site-wide component rollup: sum the per-bench rollups.
  const siteRollup = new Map<string, ComponentDemand>();
  for (const bucket of buckets) {
    for (const c of bucket.components) {
      const existing = siteRollup.get(c.recipeId);
      if (existing) {
        existing.totalQty += c.totalQty;
        existing.drivers.push(...c.drivers);
        if (c.unit === 'g') {
          existing.trayCount = Math.ceil(existing.totalQty / FILLING_TRAY_GRAMS);
        }
      } else {
        siteRollup.set(c.recipeId, { ...c, drivers: [...c.drivers] });
      }
    }
  }
  const siteComponents = Array.from(siteRollup.values()).sort((a, b) => b.totalQty - a.totalQty);

  sectionTitle(
    doc,
    cursor,
    'Site-wide components',
    siteComponents.length === 0
      ? 'No assembly recipes planned today.'
      : `Total component demand across ${buckets.length} bench${buckets.length === 1 ? '' : 'es'}.`,
  );
  drawComponentsTable(doc, cursor, siteComponents);

  // Per-bench breakdowns.
  for (const bucket of buckets) {
    ensureSpace(doc, cursor, 30);
    cursor.y += 4;
    drawBenchInfoStrip(doc, cursor, bucket.bench);

    if (bucket.components.length > 0) {
      sectionTitle(doc, cursor, 'Components needed on this bench');
      drawComponentsTable(doc, cursor, bucket.components);
    }

    sectionTitle(
      doc,
      cursor,
      'Recipes on this bench',
      `${bucket.rows.length} recipe${bucket.rows.length === 1 ? '' : 's'}.`,
    );
    drawBenchRecipesTable(doc, cursor, bucket.rows);
  }

  if (buckets.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(...MUTED_COLOR);
    doc.text('No bench has scheduled recipes today.', PAGE_MARGIN, cursor.y);
  }

  drawFooters(doc, new Date());
  doc.save(filename('production-day', site.name, undefined, date));
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function uniqueBenchIdsFromLines(lines: PlanLine[]): string[] {
  const seen = new Set<string>();
  const order: string[] = [];
  for (const l of lines) {
    if (!l.primaryBench || l.effectivePlanned <= 0) continue;
    if (seen.has(l.primaryBench.id)) continue;
    seen.add(l.primaryBench.id);
    order.push(l.primaryBench.id);
  }
  return order;
}

function formatDateLong(iso: string): string {
  // ISO `YYYY-MM-DD` parses as UTC midnight in JS — keep formatting in UTC
  // so the printed date matches the demo date exactly, regardless of TZ.
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function filename(kind: string, siteName: string, benchName: string | undefined, date: string) {
  const safe = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const parts = [kind, safe(siteName)];
  if (benchName) parts.push(safe(benchName));
  parts.push(date);
  return `${parts.join('_')}.pdf`;
}
