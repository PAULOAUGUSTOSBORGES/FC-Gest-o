const fs = require('fs');
const path = require('path');

const dir = 'g:/VERSOES DO SISTEMA/site sistema/FC-Gest-o/sistema';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));

const regex = /if\s*\(\s*el\s*\)\s*el\.value\s*=\s*c\[campo\]\s*\|\|\s*'';/g;
const replacement = `if (el) {
            if (campo === 'doc' && !c['doc']) el.value = c['cpf'] || c['cnpj'] || c['documento'] || '';
            else if (campo === 'wpp' && !c['wpp']) el.value = c['telefone'] || c['celular'] || c['contato'] || '';
            else if (campo === 'rua' && !c['rua']) el.value = c['endereco'] || c['logradouro'] || '';
            else if (campo === 'numero' && !c['numero']) el.value = c['num'] || '';
            else if (campo === 'obs' && !c['obs']) el.value = c['observacao'] || c['historico'] || '';
            else if (campo === 'fixo' && !c['fixo']) el.value = c['telefone_fixo'] || c['tel'] || '';
            else el.value = c[campo] || '';
        }`;

files.forEach(f => {
    const filePath = path.join(dir, f);
    let content = fs.readFileSync(filePath, 'utf8');
    if (regex.test(content)) {
        content = content.replace(regex, replacement);
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('Updated ' + f);
    }
});
