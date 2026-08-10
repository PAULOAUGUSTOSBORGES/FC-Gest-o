$globalJsPath = ".\global.js"
$content = Get-Content $globalJsPath -Raw -Encoding UTF8

$regex = '(?s)// Usu.*?rio n.*?o est.*? na tabela \(nova conta criada\).*?document\.body\.appendChild\(avisoAprovacao\);'

$replacement = @'
                      // Usuário não está na tabela (nova conta criada)
                      console.warn("Usuário não cadastrado na base de funcionários.");
                      
                      try {
                          await firestore.collection('funcionarios').doc(user.uid).set({
                              nome: "NOVO CADASTRO", email: user.email || '', isAdmin: false,
                              perm_dashboard: false, perm_pdv: false, perm_cadastros: false,
                              perm_gestao: false, perm_config: false, dataCadastro: new Date().toISOString(), status: 'PENDENTE'
                          });
                      } catch(e) { console.error("Erro ao registrar no banco:", e); }
                      
                      const avisoAprovacao = document.createElement('div');
                      avisoAprovacao.style.cssText = "position:absolute; top:20px; left:50%; transform:translateX(-50%); z-index:999999; background:#eab308; color:black; padding:15px 30px; font-size:16px; font-weight:bold; border-radius:10px; text-align:center; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);";
                      avisoAprovacao.innerHTML = "<i class='fa-solid fa-clock'></i> Conta Registrada!<br><span style='font-size:13px; font-weight:normal;'>Aguarde o Administrador liberar suas permissões de acesso.</span>";
                      document.body.appendChild(avisoAprovacao);
'@

if ($content -match $regex) {
    $content = $content -replace $regex, $replacement
    Set-Content -Path $globalJsPath -Value $content -Encoding UTF8
    Write-Host "Updated global.js with DB insert for new users"
} else {
    Write-Host "Could not match global.js regex!"
}
