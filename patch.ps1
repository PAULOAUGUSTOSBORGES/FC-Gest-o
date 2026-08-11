Copy-Item 'g:\site sistema\estoque.js' -Destination 'G:\VERSOES DO SISTEMA\site sistema\estoque.js' -Force
$content = [System.IO.File]::ReadAllText('G:\VERSOES DO SISTEMA\site sistema\estoque.js', [System.Text.Encoding]::UTF8)
$content = $content.Replace("if (typeof renderFuncionarios === 'function') renderFuncionarios();", "")
[System.IO.File]::WriteAllText('G:\VERSOES DO SISTEMA\site sistema\estoque.js', $content, [System.Text.Encoding]::UTF8)

Copy-Item 'g:\site sistema\compras.js' -Destination 'G:\VERSOES DO SISTEMA\site sistema\compras.js' -Force
$content2 = [System.IO.File]::ReadAllText('G:\VERSOES DO SISTEMA\site sistema\compras.js', [System.Text.Encoding]::UTF8)
$content2 = $content2.Replace("document.getElementById('modal-detalhes-nf').classList.remove('hidden');", "const m = document.getElementById('modal-detalhes-nf'); if(m) m.classList.remove('hidden');")
[System.IO.File]::WriteAllText('G:\VERSOES DO SISTEMA\site sistema\compras.js', $content2, [System.Text.Encoding]::UTF8)
