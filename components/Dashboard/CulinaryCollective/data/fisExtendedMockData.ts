// ---------------------------------------------------------------------------
// Additional FIS_FLASH.xlsx extracts that aren't in fisMockData.ts.
// Keeping these in a sibling file so the original file stays focused on
// SALES SUMMARY / FLASH P&L / WEEK / HEATMAPS, while this one covers the
// extra reporting tabs (TRENDS sub-sections, YOY SALES, COGS - NORY).
// All numbers are a hand-extracted snapshot from the spreadsheet.
// ---------------------------------------------------------------------------

export type FisTrendRow = {
  /** Display label for the row. */
  label: string;
  /** Optional sub-grouping (used as the "Group" column in the DataTable). */
  group?: string;
  /** 13 values aligned with FIS_TRENDS_WEEKS. `null` = blank cell in the source. */
  values: (number | null)[];
};

// FIS_TRENDS_REVENUE_BY_CATEGORY
export const FIS_TRENDS_REVENUE_BY_CATEGORY: FisTrendRow[] = [
  { label: 'Beer', group: 'Drinks', values: [32002.27, 23058.99, 34635.87, 33697.3, 35450.79, 24658.46, 29871.54, 38429.64, 39125.84, 37660.08, 51610.04, 35519.08, 46977.8] },
  { label: 'Spirits', group: 'Drinks', values: [6674.88, 4650.34, 6087.42, 6642.27, 7365.77, 5420.96, 7907.94, 8203.43, 7651.36, 10459.95, 14169.7, 8270.41, 16598.02] },
  { label: 'Cocktails', group: 'Drinks', values: [4190.87, 4382.92, 4024.65, 3885.07, 7497.79, 5743.16, 7836.91, 10011.66, 8186.54, 12220.27, 16147.27, 8712.32, 12769.66] },
  { label: 'Wine', group: 'Drinks', values: [5689.74, 5954.77, 5792.92, 4485.61, 7457.18, 7169.62, 7715.04, 8228.94, 8203.64, 7927.47, 10675.66, 7249.52, 13294.04] },
  { label: 'Non Alcoholic', group: 'Drinks', values: [1073.97, 1118.61, 1297.67, 1464.64, 1623.88, 1300.53, 1720.14, 2051.38, 1834.03, 2073.85, 2119.04, 1704.3, 2017.41] },
  { label: 'Min Spend Shortfall', group: 'Other', values: [0, 0, 0, 0, 0, 184.98, 0, 0, 0, 9.84, 0, 3.75, 993.83] },
  { label: 'Dough', group: 'Food', values: [2599.42, 2884.79, 2725.7, 3992.32, 4204.22, 3061.65, 3476.08, 4292.66, 3750.94, 4311.2, 6094.71, 3125.4, 5699.58] },
  { label: 'Flock', group: 'Food', values: [2807.12, 3678.48, 2868.84, 4550.37, 4440.82, 2922.7, 4449.77, 5278.98, 5146.45, 5446.91, 7170.6, 4176.03, 5943.89] },
  { label: 'Opa', group: 'Food', values: [3037.56, 3715.52, 3976.91, 4988.83, 5221.67, 3844.84, 5407.48, 6347.13, 5953.32, 6524.78, 7680.14, 4653.19, 6273.99] },
  { label: 'No Category', group: 'Other', values: [174.15, 1021.3, 260.82, 43.33, 322.46, 219.95, 259.98, 151.64, 313.31, 305.8, 840.83, 557.51, 470] },
  { label: 'Discounts', group: 'Adjustments', values: [-1753.3, -1751.56, -2082.21, -1842.31, -2029.44, -2470.09, -2838.95, -2888.19, -2410.89, -1854.14, -3205.03, -2412.39, -2626.54] },
  { label: 'Total', group: 'Total', values: [56496.68, 48714.16, 59588.59, 61907.43, 71555.14, 52056.76, 65805.93, 80107.27, 77754.54, 85086.01, 113302.96, 71559.12, 108411.68] },
];

// FIS_TRENDS_REVENUE_TO_PNL
export const FIS_TRENDS_REVENUE_TO_PNL: FisTrendRow[] = [
  { label: 'Bar Sales', group: 'Sales', values: [49631.73, 39165.63, 51838.53, 50174.89, 59395.41, 44477.71, 55051.57, 66925.05, 65001.41, 70351.46, 94721.71, 61459.38, 92650.76] },
  { label: 'Food Sales', group: 'Sales', values: [8444.1, 10278.79, 9571.45, 13531.52, 13866.71, 9829.19, 13333.33, 15918.77, 14850.71, 16282.89, 20945.45, 11954.62, 17917.46] },
  { label: 'No Sales Category', group: 'Sales', values: [174.15, 1021.3, 260.82, 43.33, 322.46, 219.95, 259.98, 151.64, 313.31, 305.8, 840.83, 557.51, 470] },
  { label: 'Discounts at POS', group: 'Adjustments', values: [-1753.3, -1751.56, -2082.21, -1842.31, -2029.44, -2470.09, -2838.95, -2888.19, -2410.89, -1854.14, -3205.03, -2412.39, -2626.54] },
  { label: 'Admission & Ticket Sales', group: 'Sales', values: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { label: 'Total Revenue', group: 'Total', values: [56496.68, 48714.16, 59588.59, 61907.43, 71555.14, 52056.76, 65805.93, 80107.27, 77754.54, 85086.01, 113302.96, 71559.12, 108411.68] },
  { label: 'Budget', group: 'Budget', values: [56163, 57230, 64990, 64990, 64990, 64990, 99134, 104760, 104760, 104760, 109222, 109610, 109610] },
  { label: '% Var', group: 'Variance', values: [0.01, -0.15, -0.08, -0.05, 0.1, -0.2, -0.34, -0.24, -0.26, -0.19, 0.04, -0.35, -0.01] },
];

// FIS_TRENDS_COGS_MOVEMENTS
export const FIS_TRENDS_COGS_MOVEMENTS: FisTrendRow[] = [
  { label: 'Opening Stock', group: 'Inventory', values: [31997.56, 24497.46, 27996.65, 30331.53, 29986.85, 28910.39, 33956.57, 33269.12, 34298.03, 30466.78, 36467.99, 32818.06, 34711.43] },
  { label: 'Deliveries', group: 'Inventory', values: [7911.82, 15857.3, 12922.49, 14746.77, 15731.72, 18651.75, 15467.76, 20455.89, 16698.3, 24366.48, 23678.95, 19241.63, 25396.44] },
  { label: 'Transfers', group: 'Inventory', values: [328.95, 565.79, 4782.59, 264.14, 0, 165.63, 0, -16.56, 0, 26.2, -108.42, 101.85, 273.55] },
  { label: 'Less: Closing Stock', group: 'Inventory', values: [24737.42, 28936.08, 30554.01, 30095.69, 28975.68, 34568.6, 33269.12, 34685.33, 31152.51, 36756.36, 32981.28, 34880.01, 35151.89] },
  { label: 'COGS Based on Stock Mvt', group: 'Total', values: [15500.91, 11984.47, 15147.72, 15246.75, 16742.89, 13159.17, 16155.21, 19023.12, 19843.82, 18103.1, 27057.24, 17281.53, 25229.53] },
  { label: 'Vs Revenue', group: 'Ratio', values: [0.27, 0.25, 0.25, 0.25, 0.23, 0.25, 0.25, 0.24, 0.26, 0.21, 0.24, 0.24, 0.23] },
  { label: 'Opening Stock Var', group: 'Reconciliation', values: [31997.56, -239.96, -939.43, -222.48, -108.84, -65.29, -612.03, 0, -387.3, -685.73, -288.37, -163.22, -168.58] },
];

// FIS_TRENDS_GP_DETAIL
export const FIS_TRENDS_GP_DETAIL: FisTrendRow[] = [
  { label: 'Gross Profit %', group: 'Gross Profit', values: [0.73, 0.75, 0.75, 0.75, 0.77, 0.75, 0.75, 0.76, 0.74, 0.79, 0.76, 0.76, 0.77] },
  { label: 'Budget GP Value', group: 'Gross Profit', values: [42045.5, 42871.5, 48709.5, 48709.5, 48709.5, 48709.5, 74406.5, 78624, 78624, 78624, 81966.5, 82239.5, 82239.5] },
  { label: 'Budget GP %', group: 'Gross Profit', values: [0.75, 0.75, 0.75, 0.75, 0.75, 0.75, 0.75, 0.75, 0.75, 0.75, 0.75, 0.75, 0.75] },
  { label: 'Act vs Budget %', group: 'Gross Profit', values: [-0.02, 0, 0, 0, 0.02, 0, 0, 0.01, -0.01, 0.04, 0.01, 0.01, 0.02] },
  { label: 'Bar COGS', group: 'Bar', values: [11652.13, 9080.48, 12562.37, 11536.04, 13110.19, 10083.04, 12308.37, 14487.54, 15124.15, 14074.81, 21341.65, 14464.86, 19961.88] },
  { label: 'Theoretical Cost', group: 'Bar', values: [12037.39, 9447.12, 12650.71, 11347.5, 13370.95, 9800.29, 12688.95, 14180.3, 14331.23, 15992.8, 19793.34, 13150.44, 13846.16] },
  { label: 'Vs Actual', group: 'Bar', values: [385.26, 366.64, 88.34, -188.54, 260.76, -282.75, 380.58, -307.24, -792.92, 1917.99, -1548.31, -1314.42, -6115.72] },
  { label: 'COS %', group: 'Bar', values: [0.23, 0.23, 0.24, 0.23, 0.22, 0.23, 0.22, 0.22, 0.23, 0.2, 0.23, 0.24, 0.22] },
  { label: 'Actual GP %', group: 'Bar', values: [0.77, 0.77, 0.76, 0.77, 0.78, 0.77, 0.78, 0.78, 0.77, 0.8, 0.77, 0.76, 0.78] },
  { label: 'Theoretical GP %', group: 'Bar', values: [0.76, 0.76, 0.76, 0.77, 0.77, 0.78, 0.77, 0.79, 0.78, 0.77, 0.79, 0.79, 0.85] },
  { label: 'Budget GP %', group: 'Bar', values: [0.77, 0.77, 0.77, 0.77, 0.77, 0.77, 0.77, 0.77, 0.77, 0.77, 0.77, 0.77, 0.77] },
  { label: 'Food COGS', group: 'Food', values: [3431.96, 2891.94, 2757.77, 3711.71, 3631.29, 3075.72, 3846.77, 4528.77, 4702.51, 4027.5, 5745.59, 2820.19, 5266.05] },
  { label: 'Theoretical Cost', group: 'Food', values: [48344.48, 2415.26, 2306.07, 3033.12, 3482.02, 2577.66, 3619.96, 3819.9, 3771.41, 4229.93, 5874.41, 3247.72, 3219.05] },
  { label: 'Vs Actual', group: 'Food', values: [44912.52, -476.68, -451.7, -678.59, -149.27, -498.06, -226.81, -708.87, -931.1, 202.43, 128.82, 427.53, -2047] },
  { label: 'COS %', group: 'Food', values: [0.41, 0.28, 0.29, 0.27, 0.26, 0.31, 0.29, 0.28, 0.32, 0.25, 0.27, 0.24, 0.29] },
  { label: 'Actual GP %', group: 'Food', values: [0.59, 0.72, 0.71, 0.73, 0.74, 0.69, 0.71, 0.72, 0.68, 0.75, 0.73, 0.76, 0.71] },
  { label: 'Theoretical GP %', group: 'Food', values: [-4.73, 0.77, 0.76, 0.78, 0.75, 0.74, 0.73, 0.76, 0.75, 0.74, 0.72, 0.73, 0.82] },
  { label: 'Budget GP %', group: 'Food', values: [0.73, 0.73, 0.73, 0.73, 0.73, 0.73, 0.73, 0.73, 0.73, 0.73, 0.73, 0.73, 0.73] },
];

// FIS_TRENDS_INDIRECTS
export const FIS_TRENDS_INDIRECTS: FisTrendRow[] = [
  { label: 'Security Hours', group: 'Security', values: [93.75, 82.25, 122.75, 122, 99.25, 64.75, 108, 92.25, 97.5, 102, 121, 93, 93] },
  { label: 'Security Cost', group: 'Security', values: [1922.9, 1706.2, 2511.95, 2497.55, 2049.4, 1499.95, 2213.05, 1910.9, 2013.1, 2105.5, 2555, 1944.2, 1944.2] },
  { label: 'Vs Revenue', group: 'Security', values: [0.03, 0.04, 0.04, 0.04, 0.03, 0.03, 0.03, 0.02, 0.03, 0.02, 0.02, 0.03, 0.02] },
  { label: 'Budgeted Security', group: 'Security', values: [2000, 2000, 2000, 2000, 2000, 2000, 2357.14, 2500, 2500, 2500, 2714.29, 3000, 3000] },
  { label: 'Act vs Budget', group: 'Security', values: [-77.1, -293.8, 511.95, 497.55, 49.4, -500.05, -144.09, -589.1, -486.9, -394.5, -159.29, -1055.8, -1055.8] },
  { label: 'Indirect Costs', group: 'Indirects', values: [3726.73, 3504.05, 4333.9, 4619.5, 4171.35, 3921.9, 3828.88, 4164.29, 4566.49, 4658.89, 5406.95, 4194.23, 4194.23] },
  { label: 'Vs Revenue', group: 'Indirects', values: [0.07, 0.07, 0.07, 0.07, 0.06, 0.08, 0.06, 0.05, 0.06, 0.05, 0.05, 0.06, 0.04] },
  { label: 'Budget', group: 'Indirects', values: [3959.83, 3953.85, 3917.95, 3917.95, 3917.95, 3917.95, 4368.98, 4549.39, 4549.39, 4549.39, 4762.23, 5046.03, 5046.03] },
  { label: '% Var', group: 'Indirects', values: [-0.06, -0.11, 0.11, 0.18, 0.06, 0, -0.12, -0.08, 0, 0.02, 0.14, -0.17, -0.17] },
];

// FIS_TRENDS_WAGE_COST
export const FIS_TRENDS_WAGE_COST: FisTrendRow[] = [
  { label: 'Bar', group: 'Outlet wages', values: [6145.21, 6002.19, 6557.3, 5857.89, 6266.19, 5922.17, 6507.13, 6942.28, 6501.84, 6472.83, 7314.61, 6942.06, 8066.93] },
  { label: 'Flock', group: 'Outlet wages', values: [1221.34, 1194.19, 938.11, 1329.75, 1353.75, 1196.38, 1135.35, 1531.07, 1159.46, 1171.94, 1407.95, 1079.63, 1207.19] },
  { label: 'Opa', group: 'Outlet wages', values: [1440.19, 1411.9, 953.88, 1467.68, 1526.13, 1429.66, 1246.27, 1454.35, 1106.27, 1657.71, 1469.04, 1473.1, 1555.07] },
  { label: 'Dough', group: 'Outlet wages', values: [1471.98, 1274.98, 1037.29, 1289.37, 1457.91, 1337.82, 1414.96, 1469.66, 1139.49, 1211.59, 1521, 1196.38, 1063.75] },
  { label: 'Total', group: 'Total wages', values: [10278.72, 9883.26, 9486.58, 9944.69, 10603.98, 9886.03, 10303.71, 11397.36, 9907.06, 10514.07, 11712.6, 10691.17, 11892.94] },
  { label: 'Holiday', group: 'On-costs', values: [1240.64, 1192.91, 1145.03, 1200.32, 1279.9, 1193.24, 1243.66, 1375.66, 1195.78, 1269.05, 1413.71, 1290.42, 1435.48] },
  { label: 'Pension', group: 'On-costs', values: [205.57, 197.67, 189.73, 198.89, 212.08, 197.72, 206.07, 227.95, 198.14, 210.28, 234.25, 213.82, 237.86] },
  { label: 'Employer Taxes', group: 'On-costs', values: [1336.23, 1284.82, 1233.26, 1292.81, 1378.52, 1285.18, 1339.48, 1481.66, 1287.92, 1366.83, 1522.64, 1389.85, 1546.08] },
  { label: 'Baked Variable', group: 'Total loaded', values: [13061.17, 12558.66, 12054.6, 12636.72, 13474.48, 12562.18, 13092.92, 14482.63, 12588.9, 13360.23, 14883.2, 13585.27, 15112.36] },
  { label: 'Vs Revenue', group: 'Ratio', values: [0.23, 0.26, 0.2, 0.2, 0.19, 0.24, 0.2, 0.18, 0.16, 0.16, 0.13, 0.19, 0.14] },
];

// FIS_YOY_SALES_BY_OUTLET
export const FIS_YOY_SALES_BY_OUTLET: FisTrendRow[] = [
  { label: 'This Year', group: 'Bar', values: [47878.43, 37597.68, 49818.01, 48341.33, 57423.06, 42690.62, 53150.9, 64405.61, 62703.99, 68545.24, 91882.32, 59102.41, 90024.22] },
  { label: 'Last Year', group: 'Bar', values: [47297.09, 33774.78, 61739.87, 52972.09, 43400.58, 43642.87, 77859.3, 80386.58, 60929.32, 78216, 103198.9, 68234.52, 79772.16] },
  { label: 'Growth $', group: 'Bar', values: [581.34, 3822.9, -11921.86, -4630.76, 14022.48, -952.25, -24708.4, -15980.97, 1774.67, -9670.76, -11316.58, -9132.11, 10252.06] },
  { label: 'Growth %', group: 'Bar', values: [0.01, 0.11, -0.19, -0.09, 0.32, -0.02, -0.32, -0.2, 0.03, -0.12, -0.11, -0.13, 0.13] },
  { label: 'This Year', group: 'Flock', values: [2807.12, 3633.06, 2831.54, 4546.62, 4433.94, 2717.7, 4032.04, 5192.62, 5137.28, 5426.91, 7159.13, 4156.03, 5943.89] },
  { label: 'Last Year', group: 'Flock', values: [3753.43, 4109.86, 6111.85, 6919.03, 4024.82, 2572.54, 4891.3, 3626.62, 4824.93, 5607.89, 7761.19, 6269.51, 6625.08] },
  { label: 'Growth $', group: 'Flock', values: [-946.31, -476.8, -3280.31, -2372.41, 409.12, 145.16, -859.26, 1566, 312.35, -180.98, -602.06, -2113.48, -681.19] },
  { label: 'Growth %', group: 'Flock', values: [-0.25, -0.12, -0.54, -0.34, 0.1, 0.06, -0.18, 0.43, 0.06, -0.03, -0.08, -0.34, -0.1] },
  { label: 'This Year', group: 'Opa', values: [3037.56, 3629.83, 3962.73, 4983.83, 5221.67, 3611.01, 5012.34, 6206.18, 5905.82, 6496.86, 7325.97, 4653.19, 6273.99] },
  { label: 'Last Year', group: 'Opa', values: [3399.61, 4770.92, 7627.82, 5160.75, 6465.98, 3504.54, 7403.92, 6664.29, 5484.78, 5813.03, 7933.95, 4929.27, 5393.37] },
  { label: 'Growth $', group: 'Opa', values: [-362.05, -1141.09, -3665.09, -176.92, -1244.31, 106.47, -2391.58, -458.11, 421.04, 683.83, -607.98, -276.08, 880.62] },
  { label: 'Growth %', group: 'Opa', values: [-0.11, -0.24, -0.48, -0.03, -0.19, 0.03, -0.32, -0.07, 0.08, 0.12, -0.08, -0.06, 0.16] },
  { label: 'This Year', group: 'Dough', values: [2599.42, 2832.29, 2715.49, 3992.32, 4154.01, 2817.48, 3350.67, 4151.22, 3740.94, 4311.2, 6094.71, 3089.98, 5699.58] },
  { label: 'Last Year', group: 'Dough', values: [2979.6, 3590.87, 5484.08, 5167, 0, 3387.05, 5785.29, 5091.11, 5576.34, 5685.42, 7041.03, 5081.69, 5731.22] },
  { label: 'Growth $', group: 'Dough', values: [-380.18, -758.58, -2768.59, -1174.68, 4154.01, -569.57, -2434.62, -939.89, -1835.4, -1374.22, -946.32, -1991.71, -31.64] },
  { label: 'Growth %', group: 'Dough', values: [-0.13, -0.21, -0.5, -0.23, 0, -0.17, -0.42, -0.18, -0.33, -0.24, -0.13, -0.39, -0.01] },
  { label: 'This Year', group: 'Other', values: [174.15, 1021.3, 260.82, 43.33, 322.46, 219.95, 259.98, 151.64, 266.51, 305.8, 840.83, 557.51, 470] },
  { label: 'Last Year', group: 'Other', values: [1212.43, 108.76, 0, 0, 0.01, 0, 1082.73, 1616.11, 1914.61, 3399.19, 4055.22, 3737.94, 3860.69] },
  { label: 'Growth $', group: 'Other', values: [-1038.28, 912.54, 260.82, 43.33, 322.45, 219.95, -822.75, -1464.47, -1648.1, -3093.39, -3214.39, -3180.43, -3390.69] },
  { label: 'Growth %', group: 'Other', values: [-0.86, 8.39, 0, 0, 0, 0, -0.76, -0.91, -0.86, -0.91, -0.79, -0.85, -0.88] },
  { label: 'This Year', group: 'Total', values: [56496.68, 48714.16, 59588.59, 61907.43, 71555.14, 52056.76, 65805.93, 80107.27, 77754.54, 85086.01, 113302.96, 71559.12, 108411.68] },
  { label: 'Last Year', group: 'Total', values: [58642.16, 46355.19, 80963.62, 70218.87, 53891.39, 53107, 97022.54, 97384.71, 78729.98, 98721.53, 129990.29, 88252.93, 101382.52] },
  { label: 'Growth $', group: 'Total', values: [-2145.48, 2358.97, -21375.03, -8311.44, 17663.75, -1050.24, -31216.61, -17277.44, -975.44, -13635.52, -16687.33, -16693.81, 7029.16] },
  { label: 'Growth %', group: 'Total', values: [-0.04, 0.05, -0.26, -0.12, 0.33, -0.02, -0.32, -0.18, -0.01, -0.14, -0.13, -0.19, 0.07] },
];

// FIS_BAR_INVENTORY (13 weeks)
export type BarInventoryRow = {
  weekEnding: string;
  opening: number | null; vsLastWeek: number | null; deliveries: number | null; transfers: number | null;
  closing: number | null; cogs: number | null; actualFood: number | null; actualBeverage: number | null;
  sbNil: number | null; theoFood: number | null; bevTheo: number | null; foodSales: number | null;
};
export const FIS_BAR_INVENTORY: BarInventoryRow[] = [
  { weekEnding: '22-Feb', opening: 31997.56, vsLastWeek: 0, deliveries: 7911.82, transfers: 328.95, closing: 24737.42, cogs: 15500.91, actualFood: 3431.96, actualBeverage: 11652.13, sbNil: 416.82, theoFood: 48344.48, bevTheo: 12037.39, foodSales: 8444.1 },
  { weekEnding: '1-Mar', opening: 24497.46, vsLastWeek: -239.96, deliveries: 15857.3, transfers: 565.79, closing: 28936.08, cogs: 11984.47, actualFood: 2891.94, actualBeverage: 9080.48, sbNil: 12.05, theoFood: 2415.26, bevTheo: 9447.12, foodSales: 10278.79 },
  { weekEnding: '8-Mar', opening: 27996.65, vsLastWeek: -939.43, deliveries: 12922.49, transfers: 4782.59, closing: 30554.01, cogs: 15147.72, actualFood: 2757.77, actualBeverage: 12562.37, sbNil: -172.42, theoFood: 2306.07, bevTheo: 12650.71, foodSales: 9571.45 },
  { weekEnding: '15-Mar', opening: 30331.53, vsLastWeek: -222.48, deliveries: 14746.77, transfers: 264.14, closing: 30095.69, cogs: 15246.75, actualFood: 3711.71, actualBeverage: 11536.04, sbNil: -1, theoFood: 3033.12, bevTheo: 11347.5, foodSales: 13531.52 },
  { weekEnding: '22-Mar', opening: 29986.85, vsLastWeek: -108.84, deliveries: 15731.72, transfers: 0, closing: 28975.68, cogs: 16742.89, actualFood: 3631.29, actualBeverage: 13110.19, sbNil: 1.41, theoFood: 3482.02, bevTheo: 13370.95, foodSales: 13866.71 },
  { weekEnding: '29-Mar', opening: 28910.39, vsLastWeek: -65.29, deliveries: 18651.75, transfers: 165.63, closing: 34568.6, cogs: 13159.17, actualFood: 3075.72, actualBeverage: 10083.04, sbNil: 0.41, theoFood: 2577.66, bevTheo: 9800.29, foodSales: 9829.19 },
  { weekEnding: '5-Apr', opening: 33956.57, vsLastWeek: -612.03, deliveries: 15467.76, transfers: 0, closing: 33269.12, cogs: 16155.21, actualFood: 3846.77, actualBeverage: 12308.37, sbNil: 0.07, theoFood: 3619.96, bevTheo: 12688.95, foodSales: 13333.33 },
  { weekEnding: '12-Apr', opening: 33269.12, vsLastWeek: 0, deliveries: 20455.89, transfers: -16.56, closing: 34685.33, cogs: 19023.12, actualFood: 4528.77, actualBeverage: 14487.54, sbNil: 6.81, theoFood: 3819.9, bevTheo: 14180.3, foodSales: 15918.77 },
  { weekEnding: '19-Apr', opening: 34298.03, vsLastWeek: -387.3, deliveries: 16698.3, transfers: null, closing: 31152.51, cogs: 19843.82, actualFood: 4702.51, actualBeverage: 15124.15, sbNil: 17.16, theoFood: 3771.41, bevTheo: 14331.23, foodSales: 14850.71 },
  { weekEnding: '26-Apr', opening: 30466.78, vsLastWeek: -685.73, deliveries: 24366.48, transfers: 26.2, closing: 36756.36, cogs: 18103.1, actualFood: 4027.5, actualBeverage: 14074.81, sbNil: 0.79, theoFood: 4229.93, bevTheo: 15992.8, foodSales: 16282.89 },
  { weekEnding: '3-May', opening: 36467.99, vsLastWeek: -288.37, deliveries: 23678.95, transfers: -108.42, closing: 32981.28, cogs: 27057.24, actualFood: 5745.59, actualBeverage: 21341.65, sbNil: -30, theoFood: 5874.41, bevTheo: 19793.34, foodSales: 20945.45 },
  { weekEnding: '10-May', opening: 32818.06, vsLastWeek: -163.22, deliveries: 19241.63, transfers: 101.85, closing: 34880.01, cogs: 17281.53, actualFood: 2820.19, actualBeverage: 14464.86, sbNil: -3.52, theoFood: 3247.72, bevTheo: 13150.44, foodSales: 11954.62 },
  { weekEnding: '17-May', opening: 34711.43, vsLastWeek: -168.58, deliveries: 25396.44, transfers: 273.55, closing: 35151.89, cogs: 25229.53, actualFood: 5266.05, actualBeverage: 19961.88, sbNil: 1.6, theoFood: 3219.05, bevTheo: 13846.16, foodSales: 17917.46 },
];

// ---------------------------------------------------------------------------
// CHART DATA -- Budget -> Actual contribution-to-overheads waterfall.
// Each delta step is signed in the direction of contribution: a negative
// "Sales" step means sales came in below budget (and thus reduces
// contribution); a positive "COGS" step means COGS came in below budget
// (saving cost, increasing contribution).
// ---------------------------------------------------------------------------

export type WaterfallStep =
  | { kind: 'total'; label: string; value: number }
  | { kind: 'delta'; label: string; value: number };

export const FIS_WATERFALL_STEPS: WaterfallStep[] = [
  { kind: 'total', label: 'Budget', value: 55403.05 },
  { kind: 'delta', label: 'Sales', value: -1198.32 },
  { kind: 'delta', label: 'COGS', value: 2140.97 },
  { kind: 'delta', label: 'Indirects', value: 851.80 },
  { kind: 'delta', label: 'Wages', value: 2792.22 },
  { kind: 'total', label: 'Actual', value: 59989.72 },
];
