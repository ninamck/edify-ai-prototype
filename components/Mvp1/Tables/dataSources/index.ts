import type { DataSource, DataSourceId } from './types';
import { flashReportSource } from './flashReport';
import { salesSource } from './sales';
import { wasteSource } from './waste';
import { labourSource } from './labour';
import { weeklyFlashTotalsSource } from './weeklyFlashTotals';
import { weeklySalesBySiteSource } from './weeklySalesBySite';
import { foodSupplyCostsSource } from './foodSupplyCosts';
import { ndcpDivisionsSource } from './ndcpDivisions';
import { dailySalesByProductFamilySource } from './dailySalesByProductFamily';
import { weeklyLaborCostsSource } from './weeklyLaborCosts';

export type { DataSourceId, DataSource, Column, ColumnType } from './types';
export { formatCell } from './types';
export type { FlashReportRow } from './flashReport';
export type { SalesRow } from './sales';
export type { WasteRow } from './waste';
export type { LabourRow } from './labour';
export type { WeeklyFlashTotalsRow } from './weeklyFlashTotals';
export type { WeeklySalesBySiteRow } from './weeklySalesBySite';
export type { FoodSupplyCostRow } from './foodSupplyCosts';
export type { NdcpDivisionRow } from './ndcpDivisions';
export type { DailySalesByProductFamilyRow } from './dailySalesByProductFamily';
export type { WeeklyLaborCostsRow } from './weeklyLaborCosts';

export const DATA_SOURCES: Record<DataSourceId, DataSource> = {
  flashReport: flashReportSource as DataSource,
  sales: salesSource as DataSource,
  waste: wasteSource as DataSource,
  labour: labourSource as DataSource,
  weeklyFlashTotals: weeklyFlashTotalsSource as DataSource,
  weeklySalesBySite: weeklySalesBySiteSource as DataSource,
  foodSupplyCosts: foodSupplyCostsSource as DataSource,
  ndcpDivisions: ndcpDivisionsSource as DataSource,
  dailySalesByProductFamily: dailySalesByProductFamilySource as DataSource,
  weeklyLaborCosts: weeklyLaborCostsSource as DataSource,
};

export const ALL_SOURCE_IDS: DataSourceId[] = [
  'flashReport',
  'sales',
  'waste',
  'labour',
  'weeklyFlashTotals',
  'weeklySalesBySite',
  'foodSupplyCosts',
  'ndcpDivisions',
  'dailySalesByProductFamily',
  'weeklyLaborCosts',
];
