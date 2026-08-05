import os

directory = r"g:\site sistema"
bad_char = "\uFFFD"

replacements = {
    f"Aten{bad_char}o": "Atenção",
    f"Aten{bad_char}{bad_char}o": "Atenção",
    f"C{bad_char}d": "Cód",
    f"C{bad_char}mera": "Câmera",
    f"CONFIRMA{bad_char}{bad_char}O": "CONFIRMAÇÃO",
    f"CONFIRMA{bad_char}O": "CONFIRMAÇÃO",
    f"CONTE{bad_char}DO": "CONTEÚDO",
    f"d{bad_char}gitos": "dígitos",
    f"EMISS{bad_char}O": "EMISSÃO",
    f"M{bad_char}veis": "Móveis",
    f"OR{bad_char}AMENTO": "ORÇAMENTO",
    f"OR{bad_char}AMENTOS": "ORÇAMENTOS",
    f"Padr{bad_char}o": "Padrão",
    f"Raz{bad_char}o": "Razão",
    f"R{bad_char}PIDO": "RÁPIDO",
    f"Ser{bad_char}": "Será",
    f"SERVI{bad_char}O": "SERVIÇO",
    f"SERVI{bad_char}OS": "SERVIÇOS",
    f"Opera{bad_char}\u01DCo": "Operação",
    f"opera{bad_char}\u01DCo": "operação",
    f"Opera{bad_char}\u015Bo": "Operação",
    f"opera{bad_char}\u015Bo": "operação",
    # Just generic fix for Operação using replace
    "Opera\uFFFD\u01DCo": "Operação",
    "Opera\uFFFD\u015Bo": "Operação",
}

for root, _, files in os.walk(directory):
    for file in files:
        if file.endswith(".html") or file.endswith(".js"):
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8') as f:
                try:
                    content = f.read()
                except:
                    continue
            
            original = content
            for k, v in replacements.items():
                content = content.replace(k, v)
            
            # Additional cleanup for anything that starts with Opera and has garbage till o
            import re
            content = re.sub(r'Opera[^\w\s]+o', 'Operação', content)
            content = re.sub(r'opera[^\w\s]+o', 'operação', content)
            content = re.sub(r'M[^\w\s]+veis', 'Móveis', content)

            if content != original:
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(content)
                print(f"Fixed {file}")
