$ErrorActionPreference = "Stop"

function Clean-HtmlFile {
    param($FilePath)
    if (-Not (Test-Path $FilePath)) { return }
    $content = Get-Content $FilePath -Raw -Encoding UTF8
    
    $startStr = '                                        <th class="p-4 text-center">Tipo</th>'
    $endStr = '                            </table>'
    
    $startIndex = $content.IndexOf($startStr)
    $endIndex = $content.IndexOf($endStr, $startIndex)
    
    if ($startIndex -ne -1 -and $endIndex -ne -1) {
        # The part we want to remove starts slightly before $startStr and ends at $endIndex + length
        $part1 = $content.Substring(0, $startIndex)
        $part3 = $content.Substring($endIndex + $endStr.Length)
        
        # also remove the trailing </div></div></div>
        $part3 = $part3 -replace '^\s*</div>\s*</div>\s*</div>', ''
        
        $newContent = $part1 + $part3
        [IO.File]::WriteAllText("$PWD\$FilePath", $newContent, [System.Text.Encoding]::UTF8)
        Write-Host "Cleaned $FilePath"
    }
}

Clean-HtmlFile "financeiro.html"
Clean-HtmlFile "relatorios.html"
Clean-HtmlFile "vendas_gestao.html"
Clean-HtmlFile "gestao.html"
