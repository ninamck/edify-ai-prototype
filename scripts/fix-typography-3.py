"""
Typography pass 3:
1. Clean up duplicate fontWeight declarations created by pass 2.
   Pattern: line has "fontSize: '12px', fontWeight: 500," 
   AND the next non-whitespace line has "fontWeight: <N>,"
   → strip the inline ", fontWeight: 500" from the fontSize line

2. Raise genuine body/description paragraph text from 12px to 14px:
   - <p> elements with fontSize 12px in briefing/action panel content
   - Description/helper text in modals and confirmation screens
   - Body content in the morning briefing body

3. Clean up any 12.5px → 13px (bump to nearest standard)
   and 13px description text → 14px where it's body copy context
"""
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

changed_files = []


def clean_duplicate_fontweights(content: str) -> str:
    """
    If a line ends with `fontSize: '12px', fontWeight: 500,` (possibly with more props)
    and the next meaningful line starts with `fontWeight:`, remove the extra fontWeight: 500
    from the fontSize line.
    """
    lines = content.split('\n')
    result = []
    i = 0
    while i < len(lines):
        line = lines[i]
        # Check if this line contains the injected ", fontWeight: 500"
        if "fontSize: '12px', fontWeight: 500" in line:
            # Look at the next non-empty line
            j = i + 1
            while j < len(lines) and lines[j].strip() == '':
                j += 1
            if j < len(lines) and re.search(r'^\s*fontWeight\s*:', lines[j]):
                # Duplicate — remove the inline ", fontWeight: 500" we added
                line = line.replace(", fontWeight: 500", "", 1)
        result.append(line)
        i += 1
    return '\n'.join(result)


# Files where we want to raise 12px paragraph/description text to 14px
# These are genuine body/description copy, not labels
BODY_COPY_FILES = {
    'components/Feed/MorningBriefingBody.tsx',
    'components/Feed/MorningBriefingActionsPanel.tsx',
    'components/Receiving/ConfirmationScreen.tsx',
    'components/Receiving/ReceivingModals.tsx',
    'components/Receiving/POSelection.tsx',
    'components/Receiving/ResponsiveDataList.tsx',
    'components/Invoicing/ApprovedState.tsx',
    'app/checklists/complete/page.tsx',
    'app/checklists/page.tsx',
    'app/checklists/ChecklistTemplateEditor.tsx',
    'app/checklists/complete/[instanceId]/CompletionFlow.tsx',
}

# In body copy files, raise <p> tags and description spans from 12px to 14px
# Only raises 12px → 14px where it's in a <p> or a clear description context
# We target: fontSize: '12px' or '12.5px' in lines that are paragraph/body context

def raise_body_text(content: str, filepath: str) -> str:
    """Raise 12px and 12.5px to 14px in body copy files."""
    rel = os.path.relpath(filepath, ROOT)
    if rel not in BODY_COPY_FILES:
        return content

    # Raise 12.5px → 14px in <p> context and description text
    content = re.sub(r"fontSize:\s*'12\.5px'", "fontSize: '14px'", content)

    # For genuine body <p> tags: raise 12px to 14px
    # We do this conservatively — only lines that also have lineHeight (indicating prose)
    lines = content.split('\n')
    result = []
    in_p_context = False
    for line in lines:
        # Track <p> style context
        if re.search(r'\bp\b.*style=', line) or re.search(r'style=.*>\s*$', line):
            in_p_context = True
        if in_p_context and "fontSize: '12px', fontWeight: 500" in line and 'lineHeight' in line:
            line = line.replace("fontSize: '12px'", "fontSize: '14px'")
            in_p_context = False
        if '/>' in line or '</p>' in line or re.search(r'^\s*\}\)', line):
            in_p_context = False
        result.append(line)
    return '\n'.join(result)


# Raise 13px and 15px body text to 14px and 16px respectively in specific files
NEAR_BODY_FILES = {
    'app/invoices/approved/page.tsx': [("fontSize: '15px'", "fontSize: '16px'")],
    'app/invoices/match/page.tsx': [("fontSize: '15px'", "fontSize: '16px'")],
    'app/receive/entry/page.tsx': [("fontSize: '15px'", "fontSize: '16px'")],
    'components/Invoicing/InvoiceList.tsx': [("fontSize: '14px'", "fontSize: '14px'")],  # already ok
    'app/orders/page.tsx': [("fontSize: '14px'", "fontSize: '14px'")],  # already ok
}


for dirpath, dirnames, filenames in os.walk(ROOT):
    dirnames[:] = [d for d in dirnames if d not in ('node_modules', '.next', '.git', 'scripts')]
    for fname in filenames:
        if not fname.endswith('.tsx'):
            continue
        fpath = os.path.join(dirpath, fname)
        with open(fpath, 'r', encoding='utf-8') as f:
            original = f.read()

        updated = original

        # Pass 1: clean duplicate fontWeights
        updated = clean_duplicate_fontweights(updated)

        # Pass 2: raise 12.5px globally to 13px (closer to standard) if not already done
        updated = re.sub(r"fontSize:\s*'12\.5px'", "fontSize: '13px'", updated)

        # Pass 3: raise near-body 13px description text in key files
        rel = os.path.relpath(fpath, ROOT)
        if rel in NEAR_BODY_FILES:
            for old, new in NEAR_BODY_FILES[rel]:
                updated = updated.replace(old, new)

        if updated != original:
            with open(fpath, 'w', encoding='utf-8') as f:
                f.write(updated)
            changed_files.append(rel)

print(f"Updated {len(changed_files)} files:")
for f in sorted(changed_files):
    print(f"  {f}")
