import urllib.request, json
url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=INVALID_KEY"
req = urllib.request.Request(url, data=b'{"contents":[{"parts":[{"text":"hello"}]}]}', headers={'Content-Type': 'application/json'}, method='POST')
try:
    urllib.request.urlopen(req)
except Exception as e:
    print(e.read().decode())
