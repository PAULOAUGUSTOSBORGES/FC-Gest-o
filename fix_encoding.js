const fs = require('fs');
const path = require('path');

const map = {
    '\u00C3\u00A1': 'á',
    '\u00C3\u00A2': 'â',
    '\u00C3\u00A3': 'ã',
    '\u00C3\u00A4': 'ä',
    '\u00C3\u00A9': 'é',
    '\u00C3\u00AA': 'ê',
    '\u00C3\u00AD': 'í',
    '\u00C3\u00B3': 'ó',
    '\u00C3\u00B4': 'ô',
    '\u00C3\u00B5': 'õ',
    '\u00C3\u00BA': 'ú',
    '\u00C3\u00A7': 'ç',
    '\u00C3\u0081': 'Á',
    '\u00C3\u0082': 'Â',
    '\u00C3\u0083': 'Ã',
    '\u00C3\u0084': 'Ä',
    '\u00C3\u0089': 'É',
    '\u00C3\u008A': 'Ê',
    '\u00C3\u008D': 'Í',
    '\u00C3\u0093': 'Ó',
    '\u00C3\u0094': 'Ô',
    '\u00C3\u0095': 'Õ',
    '\u00C3\u009A': 'Ú',
    '\u00C3\u0087': 'Ç',
    '\u00C3\u00A0': 'à',
    '\u00C3\u0080': 'À',
    '\u00C2\u00BA': 'º',
    '\u00C2\u00AA': 'ª',
    
    // Also include the "ï¿½" (U+FFFD) mojibake from before just in case
    'ï¿½': 'ç', // Fallback, we'll try to do smart replacement below
};

function fixContent(content) {
    let fixed = content;
    for (const [bad, good] of Object.entries(map)) {
        // use regex to replace all
        const regex = new RegExp(bad, 'g');
        fixed = fixed.replace(regex, good);
    }
    
    // Some specific manual fixes for U+FFFD (since it destroyed data)
    fixed = fixed.replace(/Opera\uFFFD\uFFFDo/g, 'Operação');
    fixed = fixed.replace(/opera\uFFFD\uFFFDo/g, 'operação');
    fixed = fixed.replace(/OPERA\uFFFD\uFFFDO/g, 'OPERAÇÃO');
    fixed = fixed.replace(/Hist\uFFFDrico/g, 'Histórico');
    fixed = fixed.replace(/F\uFFFDsico/g, 'Físico');
    fixed = fixed.replace(/Relat\uFFFDrios/g, 'Relatórios');
    fixed = fixed.replace(/Or\uFFFDamentos/g, 'Orçamentos');
    fixed = fixed.replace(/Configura\uFFFD\uFFFDes/g, 'Configurações');
    fixed = fixed.replace(/A\uFFFD\uFFFDo/g, 'Ação');
    fixed = fixed.replace(/a\uFFFD\uFFFDo/g, 'ação');
    fixed = fixed.replace(/Gest\uFFFD/g, 'Gestão');
    fixed = fixed.replace(/Funcion\uFFFDrios/g, 'Funcionários');
    
    // Also manual fixes for any weird sequences
    fixed = fixed.replace(/Opera\u00C3\u00A7\u00C3\u00A3o/g, 'Operação');
    fixed = fixed.replace(/Opera\u00C3\u0083\u00C2\u00A7\u00C3\u0083\u00C2\u00A3o/g, 'Operação');
    
    return fixed;
}

const dir = 'g:\\site sistema';
const files = fs.readdirSync(dir);

let totalFixed = 0;
for (const file of files) {
    if (file.endsWith('.html') || file.endsWith('.js') || file.endsWith('.css')) {
        const filePath = path.join(dir, file);
        const original = fs.readFileSync(filePath, 'utf8');
        const fixed = fixContent(original);
        if (original !== fixed) {
            fs.writeFileSync(filePath, fixed, 'utf8');
            console.log(`Fixed: ${file}`);
            totalFixed++;
        }
    }
}

console.log(`Done. Fixed ${totalFixed} files.`);
