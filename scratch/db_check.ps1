$ErrorActionPreference = "Stop"

# We cannot easily query firestore directly from powershell since we don't have node admin sdk setup here easily.
# But wait, there is no node available? "node is not available in the shell environment".
