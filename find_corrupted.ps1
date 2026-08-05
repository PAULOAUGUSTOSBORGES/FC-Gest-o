$ErrorActionPreference = "Stop"

$directory = "g:\site sistema"
$pattern = "[a-zA-Z]*+[a-zA-Z]**[a-zA-Z]*"

$wordCounts = @{}

$files = Get-ChildItem -Path $directory -Include *.html, *.js -Recurse

foreach ($file in $files) {
    try {
        $content = Get-Content $file.FullName -Raw -Encoding UTF8
        $matches = [regex]::Matches($content, $pattern)
        
        foreach ($match in $matches) {
            $word = $match.Value
            if ($word -match '') {
                if ($wordCounts.ContainsKey($word)) {
                    $wordCounts[$word]++
                } else {
                    $wordCounts[$word] = 1
                }
            }
        }
    } catch {
        Write-Warning "Failed to read $($file.FullName): $_"
    }
}

$sortedCounts = $wordCounts.GetEnumerator() | Sort-Object Value -Descending
$output = @()
foreach ($item in $sortedCounts) {
    $output += "$($item.Name): $($item.Value)"
}

[IO.File]::WriteAllLines("$directory\corrupted_words.txt", $output, [System.Text.Encoding]::UTF8)
Write-Host "Done! Check corrupted_words.txt"
