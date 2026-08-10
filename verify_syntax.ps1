Add-Type -AssemblyName Microsoft.JScript
$code = Get-Content compras.js -Raw -Encoding UTF8
try {
    $engine = [Microsoft.JScript.Vsa.VsaEngine]::CreateEngine()
    $result = [Microsoft.JScript.Eval]::JScriptEvaluate($code, $engine)
    Write-Host 'Syntax OK'
} catch {
    Write-Host "Syntax Error: $($_.Exception.Message)"
}
