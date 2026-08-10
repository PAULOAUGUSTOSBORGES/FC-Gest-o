$globalJsPath = ".\global.js"
$content = Get-Content $globalJsPath -Raw -Encoding UTF8

$regex = '(?s)// Usu.*?rio n.*?o est.*? na tabela \(nova conta criada\).*?console\.warn\("Usu.*?rio n.*?o cadastrado na base de funcion.*?rios."\);'

$replacement = @'
                      // Usuário não está na tabela (nova conta criada)
                      console.warn("Usuário não cadastrado na base de funcionários.");
                      window.currentUserInfo = { isAdmin: false, perm_dashboard: false, perm_pdv: false, perm_cadastros: false, perm_gestao: false, perm_config: false };
'@

if ($content -match $regex) {
    $content = $content -replace $regex, $replacement
    Set-Content -Path $globalJsPath -Value $content -Encoding UTF8
    Write-Host "Fixed window.currentUserInfo in global.js"
} else {
    Write-Host "Could not match global.js regex for currentUserInfo fix!"
}
