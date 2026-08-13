$files = Get-ChildItem -Filter *.html
$agendaLink = "`r`n                <a href=`"agenda.html`" class=`"nav-btn w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors hover:bg-slate-800 text-slate-300`" data-target=`"agenda`"><i class=`"fa-regular fa-calendar w-5 text-center`"></i> Agenda</a>"

$count = 0
foreach ($f in $files) {
    if ($f.Name -eq "agenda.html") { continue }
    
    $content = Get-Content $f.FullName -Raw -Encoding UTF8
    if ($content -notmatch 'agenda\.html' -and $content -match 'href="estoque\.html"') {
        $content = $content -replace '(<a href="estoque\.html".*?</a>)', "`$1$agendaLink"
        Set-Content $f.FullName -Value $content -Encoding UTF8 -NoNewline
        Write-Host "Updated $($f.Name)"
        $count++
    }
}
Write-Host "Total files updated: $count"
