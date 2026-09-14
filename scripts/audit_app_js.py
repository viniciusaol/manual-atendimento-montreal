import re

with open('app.js', 'r', encoding='utf-8') as f:
    code = f.read()

ids = re.findall(r'document\.getElementById\([\'"](.*?)[\'"]\)', code)
print('Total getElementById calls:', len(ids))

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

missing_ids = []
for i in set(ids):
    if f'id="{i}"' not in html and f"id='{i}'" not in html:
        missing_ids.append(i)

print('MISSING IDs in HTML that might cause null.addEventListener crashes:', missing_ids)

# Check all addEventListener on document.getElementById
lines = code.split('\n')
for idx, l in enumerate(lines):
    if '.addEventListener(' in l:
        print(f"Line {idx+1}: {l.strip()[:80]}")
