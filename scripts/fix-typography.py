"""
Typography standards fix — Edify prototype
Raises all sub-12px font sizes to 12px minimum across all TSX files.
"""
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# String literal sizes to replace (in JS style objects)
STRING_REPLACEMENTS = {
    "'9px'": "'12px'",
    "'9.5px'": "'12px'",
    "'10px'": "'12px'",
    "'10.5px'": "'12px'",
    "'11px'": "'12px'",
    "'11.5px'": "'12px'",
    '"9px"': '"12px"',
    '"9.5px"': '"12px"',
    '"10px"': '"12px"',
    '"10.5px"': '"12px"',
    '"11px"': '"12px"',
    '"11.5px"': '"12px"',
}

# Numeric font sizes in Recharts props: fontSize: 9 / 10 / 11
NUMERIC_RE = re.compile(r'\bfontSize:\s*(9|10|11)\b')

changed_files = []

for dirpath, dirnames, filenames in os.walk(ROOT):
    # Skip node_modules, .next, scripts
    dirnames[:] = [d for d in dirnames if d not in ('node_modules', '.next', '.git', 'scripts')]
    for fname in filenames:
        if not (fname.endswith('.tsx') or fname.endswith('.ts') or fname.endswith('.css')):
            continue
        fpath = os.path.join(dirpath, fname)
        with open(fpath, 'r', encoding='utf-8') as f:
            original = f.read()

        updated = original

        # String replacements — only when preceded by 'fontSize:' (on same line)
        # We work line by line to be safe
        lines = updated.split('\n')
        new_lines = []
        for line in lines:
            if 'fontSize' in line:
                for old, new in STRING_REPLACEMENTS.items():
                    line = line.replace(old, new)
                line = NUMERIC_RE.sub(lambda m: f'fontSize: 12', line)
            new_lines.append(line)
        updated = '\n'.join(new_lines)

        if updated != original:
            with open(fpath, 'w', encoding='utf-8') as f:
                f.write(updated)
            changed_files.append(os.path.relpath(fpath, ROOT))

print(f"Updated {len(changed_files)} files:")
for f in sorted(changed_files):
    print(f"  {f}")
