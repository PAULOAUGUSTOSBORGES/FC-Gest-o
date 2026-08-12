$basePath = "g:\VERSOES DO SISTEMA\site sistema\"

# Load a sample file to understand exact byte sequences
function Fix-Mojibake($content) {
    # These are the corrupted sequences that appear in the files
    # The bytes are actually valid UTF-8 multi-byte sequences that got double-encoded
    # We fix them by doing string replacement
    
    # á (U+00E1) - appears as mojibake ǭ
    $content = $content.Replace([char]0x01AD, 'á')  # ǭ -> á
    
    # ã/ão (U+00E3)
    $content = $content.Replace([char]0x01DC + 'o', 'ão')
    $content = $content.Replace([char]0x01DC, 'ã')
    
    # ç (U+00E7)
    $content = $content.Replace([char]0x0126, 'Ç')
    
    # ó (U+00F3)
    $content = $content.Replace([char]0x01A7, 'ó')
    
    # ê (U+00EA)
    $content = $content.Replace([char]0x01A8, 'ê')
    
    # â (U+00E2)
    $content = $content.Replace([char]0x01A9, 'â')
    
    # Á (U+00C1)
    $content = $content.Replace([char]0x01FA, 'Á')
    
    # Ú (U+00DA)
    $content = $content.Replace([char]0x01F9, 'Ú')
    
    # ú (U+00FA)
    $content = $content.Replace([char]0x01FC, 'ú')
    
    # í (U+00ED)
    $content = $content.Replace([char]0x01FD, 'í')
    
    # à (U+00E0)
    $content = $content.Replace([char]0x01F8, 'à')
    
    # ü (U+00FC)
    $content = $content.Replace([char]0x01EB, 'ü')
    
    return $content
}

$allFiles = (Get-ChildItem ($basePath + "*.js")) + (Get-ChildItem ($basePath + "*.html")) | 
    Where-Object { $_.Name -notlike "fix_*" -and $_.Name -notlike "patch*" -and $_.Name -notlike "refactor*" }

$totalFixed = 0
foreach ($file in $allFiles) {
    $content = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
    $original = $content
    $content = Fix-Mojibake $content
    if ($content -ne $original) {
        [System.IO.File]::WriteAllText($file.FullName, $content, [System.Text.Encoding]::UTF8)
        $totalFixed++
        Write-Host "Fixed: $($file.Name)"
    }
}
Write-Host "Done. Fixed: $totalFixed files"
