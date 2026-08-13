import os
import glob

directory = r"g:\VERSOES DO SISTEMA\site sistema"
files = glob.glob(os.path.join(directory, "*.html"))

agenda_link = '\n                <a href="agenda.html" class="nav-btn w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors hover:bg-slate-800 text-slate-300" data-target="agenda"><i class="fa-regular fa-calendar w-5 text-center"></i> Agenda</a>'

count = 0
for filepath in files:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if 'href="agenda.html"' not in content and 'href="estoque.html"' in content:
        import re
        content = re.sub(r'(<a href="estoque\.html".*?</a>)', r'\1' + agenda_link, content)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {os.path.basename(filepath)}")
        count += 1

print(f"Total files updated: {count}")
