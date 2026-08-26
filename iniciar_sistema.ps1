# ==============================================================
# Servidor Web Local - FC Gestão
# Este script cria um servidor local para que o sistema rode em 
# http://localhost:8080 em vez de file:///
# Isso destrava a persistência offline do Firebase no Chrome.
# ==============================================================

$port = 8080
$root = $PSScriptRoot
if ([string]::IsNullOrEmpty($root)) { $root = (Get-Location).Path }

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")

try {
    $listener.Start()
} catch {
    Write-Host "Erro ao iniciar servidor na porta $port. Ela pode estar em uso."
    Write-Host "Pressione qualquer tecla para sair..."
    $null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
    exit
}

Write-Host "=======================================================" -ForegroundColor Green
Write-Host " FC GESTAO - SERVIDOR LOCAL ATIVO" -ForegroundColor Green
Write-Host " O sistema esta rodando em: http://localhost:$port/" -ForegroundColor Green
Write-Host " O Firebase Offline agora deve funcionar perfeitamente." -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Green
Write-Host "Pressione CTRL+C nesta janela para DESLIGAR o servidor." -ForegroundColor Yellow

# Abre o navegador padrão automaticamente
Start-Process "http://localhost:$port/index.html"

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $url = $request.Url.LocalPath
        if ($url -eq "/") { $url = "/index.html" }
        
        $filePath = Join-Path $root $url.Replace('/', '\')

        if (Test-Path $filePath -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            $mime = "application/octet-stream"
            switch ($ext) {
                ".html" { $mime = "text/html" }
                ".htm"  { $mime = "text/html" }
                ".js"   { $mime = "application/javascript" }
                ".css"  { $mime = "text/css" }
                ".png"  { $mime = "image/png" }
                ".jpg"  { $mime = "image/jpeg" }
                ".jpeg" { $mime = "image/jpeg" }
                ".gif"  { $mime = "image/gif" }
                ".svg"  { $mime = "image/svg+xml" }
                ".ico"  { $mime = "image/x-icon" }
                ".json" { $mime = "application/json" }
            }
            
            $response.ContentType = "$mime; charset=utf-8"
            try {
                $content = [System.IO.File]::ReadAllBytes($filePath)
                $response.ContentLength64 = $content.Length
                $response.OutputStream.Write($content, 0, $content.Length)
                $response.StatusCode = 200
            } catch {
                $response.StatusCode = 500
            }
        } else {
            $response.StatusCode = 404
        }
        $response.Close()
    }
} finally {
    $listener.Stop()
}
