const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'sistema');
const files = fs.readdirSync(dir);

const badStr = `// Correção: divide por \r
 (Windows), \n (Linux) ou \r (Mac/Excel antigo)`;

// I'll use a regex to match the broken comment and replace it with a clean one
const badRegex = /\/\/\s*Correção:\s*divide\s*por\s*[\r\n\s]*\(Windows\),\s*[\r\n\s]*\(Linux\)\s*ou\s*[\r\n\s]*\(Mac\/Excel\s*antigo\)/g;

for (const file of files) {
    if (file.endsWith('.js')) {
        let content = fs.readFileSync(path.join(dir, file), 'utf8');
        let originalContent = content;
        
        if (badRegex.test(content)) {
            content = content.replace(badRegex, '// Correcao: divide por CRLF, LF ou CR');
        }

        // Also fix another possible variant
        const badRegex2 = /\/\/\s*Correção:\s*divide\s*por\s*[\s\S]*?\(Mac\/Excel\s*antigo\)/g;
        if (badRegex2.test(content)) {
             content = content.replace(badRegex2, '// Correcao: divide por CRLF, LF ou CR');
        }

        if (content !== originalContent) {
            fs.writeFileSync(path.join(dir, file), content, 'utf8');
            console.log('Fixed syntax error in:', file);
        }
    }
}
