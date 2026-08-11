$htmlPath = ".\funcionarios.html"
$content = Get-Content $htmlPath -Raw -Encoding UTF8

$regex = '(?s)Controle de Acesso \(Permiss.*?es\)</h4>.*?gap-3 mb-2">'
$replacement = @'
Controle de Acesso (Permissões)</h4>
                  
                  <!-- Opção exclusiva para tornar Admin -->
                  <div class="mb-4 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-200 dark:border-red-800/50 hidden" id="admin-checkbox-container">
                      <label class="flex items-center gap-3 cursor-pointer">
                          <input type="checkbox" id="func-perm-admin" class="w-5 h-5 text-red-600 rounded focus:ring-red-500 bg-white dark:bg-slate-900 border-red-300 dark:border-red-700">
                          <span class="text-sm font-bold text-red-700 dark:text-red-400 uppercase">Tornar este usuário um Administrador Geral (Acesso Total)</span>
                      </label>
                      <p class="text-[11px] text-red-600 dark:text-red-500 mt-1 ml-8">Cuidado! Isso dará acesso ilimitado e irrestrito ao sistema para este e-mail.</p>
                  </div>

                  <div class="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-2">
'@

if ($content -match $regex) {
    $content = $content -replace $regex, $replacement
    Set-Content -Path $htmlPath -Value $content -Encoding UTF8
    Write-Host "Updated funcionarios.html"
} else {
    Write-Host "Could not match funcionarios.html regex!"
}
