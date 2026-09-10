import glob, re

html_files = glob.glob("sistema/*.html") + glob.glob("*.html")
bad_attrs = []

for f in html_files:
    with open(f, 'r', encoding='utf-8', errors='ignore') as fp:
        txt = fp.read()
    for m in re.finditer(r'(id|name|class|onclick|onchange|oninput|data-[a-z-]+)=["\']([^"\']+)["\']', txt):
        attr_name = m.group(1)
        val = m.group(2)
        if any(ord(c) > 127 for c in val):
            bad_attrs.append((f, attr_name, val))

print(f"Total accented HTML attributes: {len(bad_attrs)}")
for f, a, v in bad_attrs[:20]:
    print(f"  {f}: {a}=\"{v}\"")
