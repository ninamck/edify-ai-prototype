'use client';

// The Prod 2.0 run sheet shares the production run sheet implementation —
// the two-layer (ingredients / task assignment) breakdown with print is
// identical across both surfaces, so we re-export rather than maintain a
// divergent copy.
export { default } from '../Production/RunSheetView';
