import re

def main():
    with open('g:/VERSOES DO SISTEMA/site sistema/financeiro.js', 'r', encoding='utf-8') as f:
        text = f.read()
    
    # Strip comments and strings
    text = re.sub(r'//.*', '', text)
    text = re.sub(r'/\*.*?\*/', '', text, flags=re.DOTALL)
    text = re.sub(r'(["\'])(?:(?=(\\?))\2.)*?\1', '', text)
    # Strip regex literals if possible, this is hard but let's try a simple approach
    text = re.sub(r'`[^`]*`', '', text, flags=re.DOTALL)
    
    stack = []
    lines = text.split('\n')
    for i, line in enumerate(lines):
        for j, c in enumerate(line):
            if c in '{[(': 
                stack.append((c, i+1, j+1))
            elif c in '}])':
                if stack:
                    stack.pop()
    print("Unclosed brackets:")
    for b in stack:
        print(f"Bracket {b[0]} at line {b[1]} col {b[2]}")

if __name__ == '__main__':
    main()
