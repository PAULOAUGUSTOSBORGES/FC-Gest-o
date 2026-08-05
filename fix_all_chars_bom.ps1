$chars = @(
    "á", "é", "í", "ó", "ú",
    "â", "ê", "ô",
    "ã", "õ",
    "ç",
    "Á", "É", "Í", "Ó", "Ú",
    "Â", "Ê", "Ô",
    "Ã", "Õ",
    "Ç",
    "º", "ª"
)

function Get-Mangled($c) {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($c)
    return [System.Text.Encoding]::GetEncoding(1252).GetString($bytes)
}

$directory = "g:\site sistema"
$files = Get-ChildItem -Path $directory -Include *.html, *.js -Recurse

foreach ($file in $files) {
    try {
        $content = Get-Content $file.FullName -Raw -Encoding UTF8
        $original = $content

        foreach ($c in $chars) {
            $mangled = Get-Mangled $c
            if ($content.Contains($mangled)) {
                $content = $content.Replace($mangled, $c)
            }
        }

        if ($content -cne $original) {
            [IO.File]::WriteAllText($file.FullName, $content, [System.Text.Encoding]::UTF8)
            Write-Host "Fixed in $($file.Name)"
        }
    } catch { }
}
