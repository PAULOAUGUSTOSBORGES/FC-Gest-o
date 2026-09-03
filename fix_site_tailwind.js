const fs = require('fs');
const path = require('path');

const files = ['site/index.html', 'site/produto.html'];

for (const file of files) {
    if (!fs.existsSync(file)) continue;
    let content = fs.readFileSync(file, 'utf8');

    // 1. Encontrar onde a tag do CDN está
    const cdnIndex = content.indexOf('<script src="https://cdn.tailwindcss.com"></script>');
    if (cdnIndex === -1) continue;

    // 2. Encontrar onde a tag do config.tailwind está (logo depois)
    const regexConfig = /<script>\s*tailwind\.config\s*=\s*{[\s\S]*?};\s*<\/script>/;
    const match = content.match(regexConfig);
    
    if (match) {
        // Se a config estiver DEPOIS do CDN, nós a movemos para antes
        if (content.indexOf(match[0]) > cdnIndex) {
            // Remove a config atual
            content = content.replace(match[0], '');
            
            // Adiciona window.tailwind = window.tailwind || {}; para garantir a criação antes
            let newConfig = match[0].replace('tailwind.config', 'window.tailwind = window.tailwind || {};\n        tailwind.config');
            
            // Insere antes do CDN
            content = content.replace('<script src="https://cdn.tailwindcss.com"></script>', newConfig + '\n    <script src="https://cdn.tailwindcss.com"></script>');
            
            fs.writeFileSync(file, content, 'utf8');
            console.log('Fixed:', file);
        } else {
            console.log('Already fixed (config before CDN):', file);
        }
    } else {
        console.log('No tailwind.config found in', file);
    }
}
