/** Shared currency formatting for the COGS area (GBP). */

export function gbp(n: number, opts?: { sign?: boolean; decimals?: number }): string {
  const decimals = opts?.decimals ?? 2;
  const abs = Math.abs(n).toLocaleString('en-GB', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  const sign = n < 0 ? '\u2212' : opts?.sign ? '+' : '';
  return `${sign}\u00a3${abs}`;
}

/** Rounded-to-nearest-100 "~£X" figure for headline summaries. */
export function gbpApprox(n: number): string {
  const rounded = Math.round(Math.abs(n) / 100) * 100;
  return `~\u00a3${rounded.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`;
}
