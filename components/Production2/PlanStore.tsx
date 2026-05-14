// Production2 PlanStore shim — re-exports the single source of truth
// in components/Production/PlanStore so the Original and Prod 2.0 demos
// share the same plan resolution, overrides, and `PlanLine` type.
//
// This used to be a hand-copied older snapshot that diverged from the
// canonical store (missing the team-food feature added later), which
// caused a TS2322 build error whenever Production2 plan-lines were
// passed into a function expecting the canonical `PlanLine`. Collapsing
// them into one type fixes the build and means feature work only has
// to land in one place.
//
// UI-side files in components/Production2/* import './PlanStore' as if
// they had their own copy — this shim keeps those imports working.
export * from '../Production/PlanStore';
