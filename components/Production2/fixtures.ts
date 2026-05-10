// Production2 fixtures shim — re-exports the single source of truth in
// components/Production/fixtures.ts so the Original and Prod 2.0 demos
// share the same recipes, sites, benches, production items, forecasts,
// PCR scenarios, etc. Change data once; both versions see it.
//
// UI-side files in components/Production2/* import './fixtures' as if
// they had their own copy — this shim keeps those imports working.
export * from '../Production/fixtures';
