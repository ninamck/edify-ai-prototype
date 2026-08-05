/**
 * One-shot codemod: apply the app colour palette handoff
 * (design_handoff_colour_palette) to hard-coded colour values.
 *
 * Mechanical mappings only — contextual cases (orange "new item"
 * treatments, category tints, chart series, kiosk themes) are fixed by
 * hand and excluded here.
 *
 * Run: node scripts/palette-codemod.mjs
 */
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIRS = ['app', 'components', 'lib', 'hooks'];
const EXTS = new Set(['.ts', '.tsx', '.css']);

// Files with a deliberate theme of their own (dark kiosk floor screens)
// or already migrated by hand.
const EXCLUDE = new Set([
  'components/Production/PretCrewLineDisplay.tsx',
  'components/Production/pretHotFixtures.ts',
  'app/globals.css',
]);

// old hex (no #, uppercase) -> new hex
const HEX_MAP = {
  // success: deeper green family
  '15803D': '166534',
  '16A34A': '166534',
  '22C55E': '166534',
  DCFCE7: 'E3F2E8',
  F0FDF4: 'E3F2E8',
  BBF7D0: '93C8A6',
  // error: crimson family
  B91C1C: 'B01038',
  DC2626: 'B01038',
  FEE2E2: 'FCE5EB',
  FECACA: 'E89AAE',
  // info: brand Cobalt indigo family
  '0369A1': '191484',
  E0F2FE: 'E9E8F7',
  // warning: yellow field, navy ink — orange/amber text is gone
  D97706: '001C35',
  '8A5A12': '001C35',
  FBF4E4: 'FEF6DA',
  F9F4F0: 'FEFBEE',
  FFF7ED: 'FEF6DA',
  FFFBEB: 'FEF6DA',
  FDE68A: 'EAD173',
  // stray tailwind blues -> review (working) blue family
  '1D4ED8': '3D5CA6',
  '2563EB': '3D5CA6',
  EFF6FF: 'E4EDFB',
};

// rgb triple substitutions inside rgba(...) — alpha preserved
const RGBA_MAP = [
  { from: [21, 128, 61], to: [22, 101, 52] }, // green
  { from: [185, 28, 28], to: [176, 16, 56] }, // red -> crimson
  { from: [3, 105, 161], to: [25, 20, 132] }, // info blue -> indigo
];

const hexRe = new RegExp(`#(${Object.keys(HEX_MAP).join('|')})\\b`, 'gi');

function mapRgba(src) {
  return src.replace(
    /rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([0-9.]+)\s*\)/g,
    (m, r, g, b, a) => {
      const hit = RGBA_MAP.find(
        e => e.from[0] === +r && e.from[1] === +g && e.from[2] === +b,
      );
      if (!hit) {
        // old amber warning rgba -> yellow-field rgba, alpha boosted since
        // the yellow is far lighter than the amber it replaces
        if (+r === 217 && +g === 119 && +b === 6) {
          const alpha = Math.min(1, +a * 2);
          return `rgba(234, 209, 115, ${+alpha.toFixed(2)})`;
        }
        return m;
      }
      return `rgba(${hit.to[0]}, ${hit.to[1]}, ${hit.to[2]}, ${a})`;
    },
  );
}

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else yield p;
  }
}

let filesChanged = 0;
let hexCount = 0;
let rgbaCount = 0;

for (const dir of DIRS) {
  for (const file of walk(join(ROOT, dir))) {
    const rel = relative(ROOT, file);
    if (EXCLUDE.has(rel)) continue;
    if (![...EXTS].some(e => file.endsWith(e))) continue;
    const src = readFileSync(file, 'utf8');
    let out = src.replace(hexRe, (m, hex) => {
      hexCount++;
      const next = HEX_MAP[hex.toUpperCase()];
      // preserve the original case style (lower vs upper)
      return '#' + (hex === hex.toLowerCase() ? next.toLowerCase() : next);
    });
    const before = out;
    out = mapRgba(out);
    if (out !== before) rgbaCount++;
    if (out !== src) {
      writeFileSync(file, out);
      filesChanged++;
      console.log('updated', rel);
    }
  }
}

console.log(`\n${filesChanged} files changed, ${hexCount} hex replacements, rgba updated in ${rgbaCount} files`);
