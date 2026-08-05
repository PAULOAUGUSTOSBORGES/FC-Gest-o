$r = [char]0xFFFD
Get-ChildItem 'g:\site sistema' -Include *.html, *.js -Recurse | Select-String $r
