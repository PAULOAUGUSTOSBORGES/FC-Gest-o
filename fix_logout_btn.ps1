$globalJsPath = ".\global.js"
$content = Get-Content $globalJsPath -Raw -Encoding UTF8

# Fix the encoding issue on the yellow badge
$content = $content -replace "permissÃµes", "permissões"

# If it didn't match the corrupted text, just replace the whole warning text safely using HTML entities
$regexWarning = '(?s)Aguarde o Administrador liberar suas.*?de acesso\.'
$replacementWarning = 'Aguarde o Administrador liberar suas permiss&otilde;es de acesso.'
$content = $content -replace $regexWarning, $replacementWarning


# Add a Logout button next to the Voltar button
$regexBtn = '(?s)<button onclick="window\.history\.back\(\)".*?</button>'
$replacementBtn = @'
                      <button onclick="window.history.back()" class="mt-8 bg-slate-800 dark:bg-slate-700 hover:bg-slate-700 dark:hover:bg-slate-600 text-white px-6 py-3 rounded-lg font-bold transition-colors shadow-md">
                          <i class="fa-solid fa-arrow-left mr-2"></i> Voltar
                      </button>
                      <button onclick="firebase.auth().signOut().then(() => window.location.href='login.html')" class="mt-8 ml-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-bold transition-colors shadow-md">
                          <i class="fa-solid fa-right-from-bracket mr-2"></i> Sair / Trocar Conta
                      </button>
'@

if ($content -match $regexBtn) {
    $content = $content -replace $regexBtn, $replacementBtn
    Set-Content -Path $globalJsPath -Value $content -Encoding UTF8
    Write-Host "Updated global.js with Logout button"
} else {
    Write-Host "Could not match global.js regex for Logout button!"
}
