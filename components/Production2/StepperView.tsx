// Production2 shim — the Stepper modal lives in components/Production
// alongside the shared PlanStore + fixtures, and the Production2
// surfaces re-export it so prod-2 callers can import via the same
// `@/components/Production2/...` path as the rest of their imports.
export { default } from '../Production/StepperView';
