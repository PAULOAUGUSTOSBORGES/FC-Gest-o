import os
import re

files = []
for root, dirs, fnames in os.walk('.'):
    if '.git' in root or 'node_modules' in root or 'scratch' in root:
        continue
    for fn in fnames:
        if fn.endswith(('.html', '.js')):
            files.append(os.path.join(root, fn))

bad_urls = []
for fpath in files:
    with open(fpath, 'r', encoding='utf-8', errors='ignore') as fp:
        txt = fp.read()
    for m in re.finditer(r'(href|src)=["\']([^"\']+)["\']', txt):
        val = m.group(2)
        if any(ord(c) > 127 for c in val):
            bad_urls.append((fpath, m.group(0)))

print(f"Total bad URL references: {len(bad_urls)}")
for p, u in bad_urls:
    print(f"  {p}: {u}")
