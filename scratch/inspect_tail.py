with open('sistema/financeiro.js', 'r', encoding='latin1') as f:
    lines = f.readlines()

print('Total lines:', len(lines))
with open('scratch/tail_financeiro_js.txt', 'w', encoding='utf-8') as out:
    for i in range(max(0, len(lines)-150), len(lines)):
        out.write(f"{i+1}: {lines[i]}")

print("Written to scratch/tail_financeiro_js.txt")
