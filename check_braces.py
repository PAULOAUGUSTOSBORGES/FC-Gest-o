import sys

def check_braces(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        stack = []
        for i, char in enumerate(content):
            if char == '{':
                stack.append(i)
            elif char == '}':
                if not stack:
                    line = content[:i].count('\n') + 1
                    print(f"Extra closing brace '}}' found at index {i}, line {line}")
                    return line
                stack.pop()
        
        if stack:
            print(f"Missing closing braces. {len(stack)} unclosed '{{'")
            return -1
            
        print("Braces match perfectly.")
        return 0
    except Exception as e:
        print(f"Error: {e}")

if __name__ == '__main__':
    check_braces('compras.js')
