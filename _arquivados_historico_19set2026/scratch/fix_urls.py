import os

url_fixes = [
    ("vendas_gesta\ufffdo.html", "vendas_gestao.html"),
    ("vendas_gestão.html", "vendas_gestao.html"),
    ("vendas_gest\ufffdo.html", "vendas_gestao.html"),
    ("vendas_opera\ufffdca\ufffdo.html", "vendas_operacao.html"),
    ("vendas_operação.html", "vendas_operacao.html"),
    ("vendas_opera\ufffdo.html", "vendas_operacao.html"),
    ("opera\ufffdca\ufffdo.html", "operacao.html"),
    ("operação.html", "operacao.html"),
    ("opera\ufffdo.html", "operacao.html"),
    ("gesta\ufffdo_v2.js", "gestao_v2.js"),
    ("gestão_v2.js", "gestao_v2.js"),
    ("gest\ufffdo_v2.js", "gestao_v2.js"),
    ("opera\ufffdca\ufffdo.js", "operacao.js"),
    ("operação.js", "operacao.js"),
    ("vendas_gesta\ufffdo.js", "vendas_gestao.js"),
    ("vendas_gestão.js", "vendas_gestao.js"),
    ("vendas_opera\ufffdca\ufffdo.js", "vendas_operacao.js"),
    ("vendas_operação.js", "vendas_operacao.js"),
    ("data-target=\"vendas_gesta\ufffdo\"", "data-target=\"vendas_gestao\""),
    ("data-target=\"vendas_gestão\"", "data-target=\"vendas_gestao\""),
    ("data-target=\"vendas_opera\ufffdca\ufffdo\"", "data-target=\"vendas_operacao\""),
    ("data-target=\"vendas_operação\"", "data-target=\"vendas_operacao\""),
    ("data-target=\"opera\ufffdca\ufffdo\"", "data-target=\"operacao\""),
    ("data-target=\"operação\"", "data-target=\"operacao\""),
]

for root, dirs, fnames in os.walk('.'):
    if '.git' in root or 'node_modules' in root or 'scratch' in root:
        continue
    for fn in fnames:
        if fn.endswith(('.html', '.js')):
            p = os.path.join(root, fn)
            with open(p, 'r', encoding='utf-8', errors='ignore') as fp:
                txt = fp.read()
            orig = txt
            for bad, good in url_fixes:
                txt = txt.replace(bad, good)
            # Also catch any regex matches for vendas_gest*.html etc
            import re
            txt = re.sub(r'href=([\'\"])vendas_gest[^\'\"]*\.html([\'\"])', r'href=\1vendas_gestao.html\2', txt)
            txt = re.sub(r'href=([\'\"])vendas_opera[^\'\"]*\.html([\'\"])', r'href=\1vendas_operacao.html\2', txt)
            txt = re.sub(r'href=([\'\"])opera[^\'\"]*\.html([\'\"])', r'href=\1operacao.html\2', txt)
            txt = re.sub(r'src=([\'\"])gest[^\'\"]*_v2\.js', r'src=\1gestao_v2.js', txt)
            txt = re.sub(r'src=([\'\"])vendas_gest[^\'\"]*\.js', r'src=\1vendas_gestao.js', txt)
            txt = re.sub(r'src=([\'\"])vendas_opera[^\'\"]*\.js', r'src=\1vendas_operacao.js', txt)
            txt = re.sub(r'src=([\'\"])opera[^\'\"]*\.js', r'src=\1operacao.js', txt)
            txt = re.sub(r'data-target=([\'\"])vendas_gest[^\'\"]*([\'\"])', r'data-target=\1vendas_gestao\2', txt)
            txt = re.sub(r'data-target=([\'\"])vendas_opera[^\'\"]*([\'\"])', r'data-target=\1vendas_operacao\2', txt)
            txt = re.sub(r'data-target=([\'\"])opera[^\'\"]*([\'\"])', r'data-target=\1operacao\2', txt)

            if txt != orig:
                with open(p, 'w', encoding='utf-8') as fp:
                    fp.write(txt)
                print(f"Fixed URLs in: {p}")

print("URL fixes finished.")
