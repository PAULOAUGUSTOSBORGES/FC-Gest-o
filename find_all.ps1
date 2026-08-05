$r = [char]0xFFFD
$files = Get-ChildItem 'g:\site sistema' -Include *.html, *.js -Recurse
$words = @()
foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw -Encoding UTF8
    $matches = [regex]::Matches($content, '[\p{L}]*' + $r + '[\p{L}]*')
    foreach ($m in $matches) {
        $words += $m.Value
    }
}
$words | Sort-Object -Unique > 'g:\site sistema\bad_words.txt'
