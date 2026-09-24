param()
# Corrige o }} no pdv.js e verifica todos os outros JS

$baseDir = "g:\VERSOES DO SISTEMA\site sistema\FC-Gest-o\sistema"

function FixDoubleCloseBrace($filePath) {
    $content = [System.IO.File]::ReadAllText($filePath, [System.Text.Encoding]::UTF8)
    
    # Verifica quantas ocorrências de }} existem que não são objetos JS válidos
    # Procura por: linha com apenas }} (possivelmente com whitespace)
    $lines = $content.Split("`n")
    $fixed = $false
    $result = New-Object System.Collections.Generic.List[string]
    
    for ($i = 0; $i -lt $lines.Length; $i++) {
        $line = $lines[$i]
        $trimmed = $line.TrimEnd("`r").Trim()
        
        # Se a linha é APENAS }} (fechamento duplo sem contexto de objeto/array)
        if ($trimmed -eq '}}') {
            # Verifica linha anterior
            $prevLine = if ($i -gt 0) { $lines[$i-1].TrimEnd("`r").Trim() } else { "" }
            
            # Se a linha anterior termina com ; ou com }) - provavelmente é fechamento duplo errado
            if ($prevLine.EndsWith(';') -or $prevLine.EndsWith(');') -or $prevLine.EndsWith('});')) {
                # Substitui }} por }
                $newLine = $line.Replace('}}', '}')
                $result.Add($newLine)
                Write-Host "  Linha $($i+1): substituido '}}}' por '}' em $([System.IO.Path]::GetFileName($filePath))"
                $fixed = $true
                continue
            }
        }
        $result.Add($line)
    }
    
    if ($fixed) {
        $newContent = [string]::Join("`n", $result)
        [System.IO.File]::WriteAllText($filePath, $newContent, [System.Text.Encoding]::UTF8)
        return $true
    }
    return $false
}

$jsFiles = Get-ChildItem -Path $baseDir -Filter "*.js" -File | Where-Object { $_.Name -notlike "fc_cache*" }

$totalFixed = 0
foreach ($file in $jsFiles) {
    $result = FixDoubleCloseBrace $file.FullName
    if ($result) {
        Write-Host "CORRIGIDO: $($file.Name)"
        $totalFixed++
    }
}

Write-Host ""
Write-Host "Total corrigidos: $totalFixed"
Write-Host "Concluido!"
