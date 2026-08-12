$lines = [IO.File]::ReadAllLines('g:\VERSOES DO SISTEMA\site sistema\financeiro.js')
$stack = New-Object System.Collections.ArrayList
$inString = $false
$stringChar = ''
$inComment = $false

for ($lineIdx = 0; $lineIdx -lt $lines.Length; $lineIdx++) {
    $line = $lines[$lineIdx]
    $inLineComment = $false
    for ($i = 0; $i -lt $line.Length; $i++) {
        $c = $line[$i]
        
        if ($inLineComment) { continue }
        if ($inComment) {
            if ($c -eq '*' -and $i+1 -lt $line.Length -and $line[$i+1] -eq '/') {
                $inComment = $false
                $i++
            }
            continue
        }
        if ($inString) {
            if ($c -eq '\') { $i++; continue }
            if ($c -eq $stringChar) { $inString = $false }
            continue
        }
        
        if ($c -eq '/' -and $i+1 -lt $line.Length) {
            if ($line[$i+1] -eq '/') { $inLineComment = $true; $i++; continue }
            if ($line[$i+1] -eq '*') { $inComment = $true; $i++; continue }
        }
        
        # very naive regex skip
        if ($c -eq '/' -and $line -match "^[ \t]*\/") {
            # Could be a regex, let's just skip it
        }

        if ($c -eq "'" -or $c -eq '"' -or $c -eq '`') {
            $inString = $true
            $stringChar = $c
            continue
        }
        
        if ($c -eq '{' -or $c -eq '[' -or $c -eq '(') {
            $obj = New-Object PSObject -Property @{ Char = $c; Line = ($lineIdx + 1) }
            $null = $stack.Add($obj)
        } elseif ($c -eq '}' -or $c -eq ']' -or $c -eq ')') {
            if ($stack.Count -gt 0) {
                $stack.RemoveAt($stack.Count - 1)
            }
        }
    }
}

foreach ($item in $stack) {
    Write-Host "Unclosed '$($item.Char)' at line $($item.Line)"
}
