$c = [System.IO.File]::ReadAllText("financeiro.js", [System.Text.Encoding]::UTF8)
$old = "if (val === '__novo__' || val === '' || val === '__avulso__') {"
$new = "if (val === '__novo__' || val === '' || val === '__avulso__') {
        const p = wrap.querySelector('p');
        if (p) {
            if (val === '__avulso__') p.innerHTML = '<i class=`"fa-solid fa-circle-info mr-1`"></i>Será lançado apenas nesta conta (NÃO será cadastrado).';
            else p.innerHTML = '<i class=`"fa-solid fa-circle-info mr-1`"></i>Será cadastrado automaticamente ao salvar.';
        }"
$c = $c.Replace($old, $new)
[System.IO.File]::WriteAllText("financeiro.js", $c, [System.Text.Encoding]::UTF8)
