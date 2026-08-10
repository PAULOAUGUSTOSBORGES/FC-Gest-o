$rulesPath = ".\firestore.rules"
$content = Get-Content $rulesPath -Raw -Encoding UTF8

$regex = '(?s)match /funcionarios/\{userId\} \{.*?allow write: if isAdmin\(\);.*?\}'

$replacement = @'
    match /funcionarios/{userId} {
      allow read: if isAdmin() || request.auth.uid == userId;
      allow create: if request.auth.uid == userId 
                    && (request.resource.data.isAdmin == false || request.resource.data.isAdmin == 'false')
                    && (request.resource.data.perm_dashboard == false || request.resource.data.perm_dashboard == 'false')
                    && (request.resource.data.perm_pdv == false || request.resource.data.perm_pdv == 'false')
                    && (request.resource.data.perm_cadastros == false || request.resource.data.perm_cadastros == 'false')
                    && (request.resource.data.perm_gestao == false || request.resource.data.perm_gestao == 'false')
                    && (request.resource.data.perm_config == false || request.resource.data.perm_config == 'false');
      allow update, delete: if isAdmin();
    }
'@

if ($content -match $regex) {
    $content = $content -replace $regex, $replacement
    Set-Content -Path $rulesPath -Value $content -Encoding UTF8
    Write-Host "Updated firestore.rules"
} else {
    Write-Host "Could not match firestore.rules regex!"
}
