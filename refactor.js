const fs = require('fs');
const path = require('path');

const dir = __dirname;

const filesToProcess = [
    { html: 'cadastro.html', js: 'cadastro.js', views: ['produtos', 'clientes', 'fornecedores', 'funcionarios', 'estoque'] },
    { html: 'gestao.html', js: 'gestao.js', views: ['financeiro', 'compras', 'relatorios'] },
    { html: 'operacao.html', js: 'operacao.js', views: ['pdv', 'orcamentos'] }
];

function extractViews(htmlContent, views) {
    let extracted = {};
    
    for (let view of views) {
        const viewId = `id="view-${view}"`;
        const startIdx = htmlContent.indexOf(viewId);
        if (startIdx === -1) continue;
        
        let divStart = htmlContent.lastIndexOf('<div', startIdx);
        
        let tagCount = 0;
        let i = divStart;
        let endIdx = -1;
        while (i < htmlContent.length) {
            let nextDivStart = htmlContent.indexOf('<div', i);
            let nextDivEnd = htmlContent.indexOf('</div', i);
            
            if (nextDivStart !== -1 && nextDivStart < nextDivEnd) {
                tagCount++;
                i = nextDivStart + 4;
            } else if (nextDivEnd !== -1) {
                tagCount--;
                i = nextDivEnd + 5;
                if (tagCount === 0) {
                    endIdx = htmlContent.indexOf('>', i) + 1;
                    break;
                }
            } else {
                break;
            }
        }
        
        if (endIdx !== -1) {
            extracted[view] = htmlContent.substring(divStart, endIdx);
            
            // Fix hidden classes
            extracted[view] = extracted[view].replace(/class="([^"]*)hidden([^"]*)"/g, (match, p1, p2) => {
                // Only replace if it's the main view section
                if (match.includes('view-section')) {
                    return `class="${p1}active${p2}"`.replace('  ', ' ');
                }
                return match;
            });
            if (extracted[view].includes('view-section') && !extracted[view].includes('active')) {
                extracted[view] = extracted[view].replace('class="', 'class="active ');
            }
        }
    }
    
    return extracted;
}

for (let cfg of filesToProcess) {
    const htmlPath = path.join(dir, cfg.html);
    const jsPath = path.join(dir, cfg.js);
    
    if (!fs.existsSync(htmlPath) || !fs.existsSync(jsPath)) {
        console.log(`Skipping ${cfg.html} / ${cfg.js} - not found`);
        continue;
    }
    
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    const jsContent = fs.readFileSync(jsPath, 'utf8');
    
    const extractedViews = extractViews(htmlContent, cfg.views);
    
    for (let view of cfg.views) {
        if (!extractedViews[view]) {
            console.log(`View ${view} not found in ${cfg.html}`);
            continue;
        }
        
        let newHtml = htmlContent;
        for (let otherView of cfg.views) {
            if (otherView !== view && extractedViews[otherView]) {
                newHtml = newHtml.replace(extractedViews[otherView], '');
            }
        }
        
        newHtml = newHtml.replace(`<script src="${cfg.js}"></script>`, `<script src="${view}.js"></script>`);
        newHtml = newHtml.replace(/<title>.*?<\/title>/, `<title>FC Móveis - ${view.toUpperCase()}</title>`);
        
        // Remove empty lines created by deleting views
        newHtml = newHtml.replace(/^\s*$(?:\r\n?|\n)/gm, "");
        
        fs.writeFileSync(path.join(dir, `${view}.html`), newHtml, 'utf8');
        
        let newJs = jsContent;
        
        // Substituir a inicialização do MudarVisaoLocal
        // No cadastro.js e gestao.js
        if (newJs.includes("const view = urlParams.get('view');")) {
            newJs = newJs.replace(
                /const urlParams = new URLSearchParams\(window\.location\.search\);\s*const view = urlParams\.get\('view'\);\s*mudarVisaoLocal\(view \|\| '.*?'\);/,
                `mudarVisaoLocal('${view}');`
            );
        } else if (newJs.includes("const view = urlParams.get('view') ||")) {
            newJs = newJs.replace(
                /const urlParams = new URLSearchParams\(window\.location\.search\);\s*const view = urlParams\.get\('view'\) \|\| '.*?';\s*mudarVisaoLocal\(view\);/,
                `mudarVisaoLocal('${view}');`
            );
        }
        
        fs.writeFileSync(path.join(dir, `${view}.js`), newJs, 'utf8');
        console.log(`Created ${view}.html and ${view}.js`);
    }
}

// 2. Update links
const allHtmlFiles = fs.readdirSync(dir).filter(f => f.endsWith('.html'));
const linkReplacements = [
    { old: 'cadastro.html?view=produtos', new: 'produtos.html' },
    { old: 'cadastro.html?view=clientes', new: 'clientes.html' },
    { old: 'cadastro.html?view=fornecedores', new: 'fornecedores.html' },
    { old: 'cadastro.html?view=funcionarios', new: 'funcionarios.html' },
    { old: 'cadastro.html?view=estoque', new: 'estoque.html' },
    { old: 'gestao.html?view=financeiro', new: 'financeiro.html' },
    { old: 'gestao.html?view=compras', new: 'compras.html' },
    { old: 'gestao.html?view=relatorios', new: 'relatorios.html' },
    { old: 'operacao.html?view=pdv', new: 'pdv.html' },
    { old: 'operacao.html?view=orcamentos', new: 'orcamentos.html' },
    { old: 'operacao.html?view=historico', new: 'vendas_operacao.html' }
];

for (let file of allHtmlFiles) {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;
    
    for (let rep of linkReplacements) {
        if (content.includes(rep.old)) {
            content = content.split(rep.old).join(rep.new);
            changed = true;
        }
    }
    
    // Some buttons have onclick="window.location.href='...'"
    for (let rep of linkReplacements) {
        const jsOld = rep.old.replace('?', '\\?');
        const re = new RegExp(`'${jsOld}'|"jsOld"`, 'g');
        if (content.match(re)) {
            content = content.replace(re, `'${rep.new}'`);
            changed = true;
        }
    }
    
    if (changed) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated links in ${file}`);
    }
}

