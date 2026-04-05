"""
Typography pass 2:
1. Where fontSize is '12px' and there is no fontWeight on the SAME line → add fontWeight: 500
   (We do this only when the line contains fontSize: '12px' alone with no fontWeight)
2. Where textTransform: 'uppercase' and fontSize <= 13px (now all 12px after pass 1):
   Remove textTransform: 'uppercase' and reduce letterSpacing where overly large
   (The label hierarchy is preserved via weight/size, not casing)
"""
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

changed_files = []

# Pattern: a line that has fontSize: '12px' but NO fontWeight on the same line
# We insert fontWeight: 500 after the fontSize declaration on that line
FONTSIZE_12_NO_WEIGHT_RE = re.compile(
    r"(fontSize:\s*'12px')"  # has fontSize 12px
)

# Uppercase removal: lines that have ONLY textTransform: 'uppercase'
# We remove them. Handles both quote styles.
UPPERCASE_LINE_RE = re.compile(
    r"^\s*textTransform:\s*['\"]uppercase['\"]\s*,?\s*$"
)

# Letter spacing lines with large values (0.06em, 0.07em, 0.08em) — reduce for small labels
LETTERSPACING_LARGE_RE = re.compile(
    r"letterSpacing:\s*'0\.(06|07|08)em'"
)

for dirpath, dirnames, filenames in os.walk(ROOT):
    dirnames[:] = [d for d in dirnames if d not in ('node_modules', '.next', '.git', 'scripts')]
    for fname in filenames:
        if not fname.endswith('.tsx'):
            continue
        fpath = os.path.join(dirpath, fname)
        with open(fpath, 'r', encoding='utf-8') as f:
            original = f.read()

        lines = original.split('\n')
        new_lines = []
        changed = False

        for line in lines:
            new_line = line

            # Rule 1: fontSize: '12px' on a line that has no fontWeight
            if "'12px'" in line and 'fontSize' in line and 'fontWeight' not in line:
                # Only inject if it looks like a style property line (has a colon)
                if re.search(r"fontSize:\s*'12px'", line):
                    new_line = re.sub(
                        r"(fontSize:\s*'12px')",
                        r"fontSize: '12px', fontWeight: 500",
                        new_line,
                        count=1
                    )

            # Rule 2: Remove textTransform: 'uppercase' lines
            if UPPERCASE_LINE_RE.match(new_line):
                # Skip this line entirely (remove it)
                changed = True
                continue

            # Rule 3: Reduce overly large letter spacing on label text
            if 'letterSpacing' in new_line:
                new_line = LETTERSPACING_LARGE_RE.sub("letterSpacing: '0.04em'", new_line)

            if new_line != line:
                changed = True
            new_lines.append(new_line)

        if changed:
            updated = '\n'.join(new_lines)
            with open(fpath, 'w', encoding='utf-8') as f:
                f.write(updated)
            changed_files.append(os.path.relpath(fpath, ROOT))

print(f"Updated {len(changed_files)} files:")
for f in sorted(changed_files):
    print(f"  {f}")
