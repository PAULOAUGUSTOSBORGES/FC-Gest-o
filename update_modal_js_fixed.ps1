$jsPath = ".\funcionarios.js"
$content = Get-Content $jsPath -Raw -Encoding UTF8

$regexOpenModal = '(?s)function abrirModalFuncionario\(id = null\) \{'
$replacementOpenModal = @'
function abrirModalFuncionario(id = null) {
    if (window.currentUserInfo && window.currentUserInfo.isAdmin) {
        document.getElementById('admin-checkbox-container').classList.remove('hidden');
    } else {
        document.getElementById('admin-checkbox-container').classList.add('hidden');
    }
'@

if ($content -match $regexOpenModal) {
    $content = $content -replace $regexOpenModal, $replacementOpenModal
    Set-Content -Path $jsPath -Value $content -Encoding UTF8
    Write-Host "Updated abrirModalFuncionario in funcionarios.js"
} else {
    Write-Host "Could not match abrirModalFuncionario regex!"
}
