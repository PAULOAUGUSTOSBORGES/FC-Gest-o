import os

def clean_html_files():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    for root, dirs, files in os.walk(base_dir):
        if '.git' in root or 'node_modules' in root:
            continue
        for file in files:
            if file.endswith('.html'):
                file_path = os.path.join(root, file)
                try:
                    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                        content = f.read()

                    cleaned = content.replace('<!-- PWA ConfiguraÃ§Ãµes e Ã cones -->', '<!-- PWA Configuracoes e Icones -->')
                    cleaned = cleaned.replace('<!-- PWA Configurações e Ícones -->', '<!-- PWA Configuracoes e Icones -->')
                    cleaned = cleaned.replace('`n', '\n')

                    with open(file_path, 'w', encoding='utf-8') as f:
                        f.write(cleaned)
                except Exception as e:
                    print(f"Error {file_path}: {e}")

if __name__ == '__main__':
    clean_html_files()
    print("All files cleaned.")
