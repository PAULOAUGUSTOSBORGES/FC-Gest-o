$scriptContent = [System.IO.File]::ReadAllText("$(Get-Location)\fix_encoding_bg2.ps1", [System.Text.Encoding]::UTF8)
Invoke-Command -ScriptBlock ([scriptblock]::Create($scriptContent))
