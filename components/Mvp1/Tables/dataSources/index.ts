import type { DataSource, DataSourceId } from './types';
import { flashReportSource } from './flashReport';
import { salesSource } from './sales';
import { wasteSource } from './waste';
import { labourSource } from './labour';

export type { DataSourceId, DataSource, Column, ColumnType } from './types';
export { formatCell } from './types';
export type { FlashReportRow } from './flashReport';
export type { SalesRow } from './sales';
export type { WasteRow } from './waste';
export type { LabourRow } from './labour';

export const DATA_SOURCES: Record<DataSourceId, DataSource> = {
  flashReport: flashReportSource as DataSource,
  sales: salesSource as DataSource,
  waste: wasteSource as DataSource,
  labour: labourSource as DataSource,
};

export const ALL_SOURCE_IDS: DataSourceId[] = ['flashReport', 'sales', 'waste', 'labour'];
