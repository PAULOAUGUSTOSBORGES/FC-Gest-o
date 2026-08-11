$files = @("gestao.html", "financeiro.html")
foreach ($file in $files) {
    if (Test-Path $file) {
        $content = Get-Content $file -Raw
        $pattern = '(?s)\s*<th class="p-4 text-center">Tipo</th>\s*<th class="p-4 text-right">Valor Total</th>\s*<th class="p-4 text-center print:hidden">A.es</th>\s*</tr>\s*</thead>\s*<tbody id="tabela-compras-hist".*?</tbody>\s*</table>\s*</div>\s*</div>\s*</div>\s*'
        $content = [System.Text.RegularExpressions.Regex]::Replace($content, $pattern, "`n")
        
        # Another pattern just in case encoding got messed up
        $pattern2 = '(?s)\s*<th class="p-4 text-center">Tipo</th>\s*<th class="p-4 text-right">Valor Total</th>\s*<th class="p-4 text-center print:hidden">A.*?es</th>\s*</tr>\s*</thead>\s*<tbody id="tabela-compras-hist".*?</tbody>\s*</table>\s*</div>\s*</div>\s*</div>\s*'
        $content = [System.Text.RegularExpressions.Regex]::Replace($content, $pattern2, "`n")

        [System.IO.File]::WriteAllText((Get-Item $file).FullName, $content, [System.Text.Encoding]::UTF8)
    }
}
