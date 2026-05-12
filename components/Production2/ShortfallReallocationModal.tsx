// Production2 shim — the shortfall reallocation modal is identical to the
// Original build (it's a pure presentation surface over shared types and
// the shared allocation helper). Re-export rather than fork so we don't
// have to maintain two copies of the UI.
export { default } from '../Production/ShortfallReallocationModal';
export type {
  ShortfallReallocationInput,
  ShortfallReallocationResult,
} from '../Production/ShortfallReallocationModal';
