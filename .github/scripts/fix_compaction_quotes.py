from pathlib import Path
import re

path = Path('compaction.js')
s = path.read_text(encoding='utf-8')

patterns = [
    r'<label>試験方法<select.*?</select></label>',
    r'<label>試料最大粒径 \(mm\)<input.*?</label>',
]

for pattern in patterns:
    match = re.search(pattern, s)
    if not match:
        raise SystemExit(f'Patch target not found: {pattern}')
    old = match.group(0)
    new = old.replace('\\"', '"')
    if old == new:
        raise SystemExit(f'No escaped quotes found: {pattern}')
    s = s[:match.start()] + new + s[match.end():]

path.write_text(s, encoding='utf-8')
