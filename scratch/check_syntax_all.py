import os
import subprocess
import glob

js_files = glob.glob("sistema/*.js") + glob.glob("*.js")
errors = []
for f in js_files:
    res = subprocess.run(["node", "-c", f], capture_output=True, text=True)
    if res.returncode != 0:
        errors.append((f, res.stderr.strip()))

print(f"Total syntax errors: {len(errors)}")
for f, err in errors[:10]:
    print(f"  {f}: {err.splitlines()[-1] if err else 'error'}")
