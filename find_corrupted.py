import os
import re
from collections import Counter

directory = r"g:\site sistema"
pattern = re.compile(r'\b\w*\w*\b|\b\w*\w*\w*\b', re.IGNORECASE)
words_with_replacement = Counter()

# Also catch words that have  at the end, or multiple 
pattern2 = re.compile(r'[a-zA-Z]*+[a-zA-Z]**[a-zA-Z]*')

for filename in os.listdir(directory):
    if filename.endswith(".html") or filename.endswith(".js"):
        filepath = os.path.join(directory, filename)
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
                matches = pattern2.findall(content)
                for m in matches:
                    words_with_replacement[m] += 1
        except Exception as e:
            pass

with open(r"g:\site sistema\corrupted_words.txt", 'w', encoding='utf-8') as f:
    for word, count in words_with_replacement.most_common():
        f.write(f"{word}: {count}\n")
