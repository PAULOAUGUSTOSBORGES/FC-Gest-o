import glob, re

js_files = glob.glob("sistema/*.js") + glob.glob("*.js")
issues = []

for f in js_files:
    with open(f, 'r', encoding='utf-8', errors='ignore') as fp:
        txt = fp.read()
    for m in re.finditer(r'db\.movimenta[^\s;,\.()\[\]]+', txt):
        prop = m.group(0)
        if any(ord(c) > 127 for c in prop):
            issues.append((f, prop))

print(f"Total accented db.movimentacoes: {len(issues)}")
for f, p in issues[:10]:
    print(f"  {f}: {p}")
