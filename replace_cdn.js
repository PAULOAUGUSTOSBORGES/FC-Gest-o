const fs = require('fs');
const path = require('path');

function processDir(dir, depth) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            if (file !== 'node_modules' && file !== '.firebase' && file !== '.git') {
                processDir(fullPath, depth + 1);
            }
        } else if (fullPath.endsWith('.html')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let originalContent = content;

            // Remove the tailwind CDN script tag
            content = content.replace(/<script src="https:\/\/cdn\.tailwindcss\.com"><\/script>\n?/g, '');
            
            // Remove the inline script block configuring tailwind
            const regexConfig = /<script>[\s\S]*?tailwind\.config[\s\S]*?<\/script>\n?/g;
            content = content.replace(regexConfig, '');

            // Ensure our new CSS is linked. We need to determine the relative path to root
            let relativePrefix = depth === 1 ? '../' : (depth === 0 ? './' : '../../');
            const linkTag = `<link rel="stylesheet" href="${relativePrefix}tailwind-built.css?v=202609021950">`;
            
            if (!content.includes('tailwind-built.css')) {
                // Insert it right after the custom style.css or before </head>
                if (content.includes('</head>')) {
                    content = content.replace('</head>', `    ${linkTag}\n</head>`);
                }
            }

            if (content !== originalContent) {
                fs.writeFileSync(fullPath, content, 'utf8');
                console.log('Processed:', fullPath);
            }
        }
    }
}

processDir(path.join(__dirname, 'sistema'), 1);
processDir(path.join(__dirname, 'site'), 1);
processDir(__dirname, 0); // root for gestao_site.html etc.
