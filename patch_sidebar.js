const fs = require('fs');
const path = require('path');

const dir = 'g:/VERSOES DO SISTEMA/site sistema';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

const agendaLink = `\n                <a href="agenda.html" class="nav-btn w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors hover:bg-slate-800 text-slate-300" data-target="agenda"><i class="fa-regular fa-calendar w-5 text-center"></i> Agenda</a>`;

let count = 0;
files.forEach(f => {
    const fullPath = path.join(dir, f);
    let content = fs.readFileSync(fullPath, 'utf8');
    
    // Check if it's already patched
    if (!content.includes('href="agenda.html"') && content.includes('href="estoque.html"')) {
        content = content.replace(/(<a href="estoque\.html".*?<\/a>)/g, `$1${agendaLink}`);
        fs.writeFileSync(fullPath, content, 'utf8');
        count++;
        console.log(`Updated ${f}`);
    }
});

console.log(`Total files updated: ${count}`);
