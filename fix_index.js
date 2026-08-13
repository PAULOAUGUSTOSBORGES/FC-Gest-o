const fs = require('fs');
const file = 'g:/VERSOES DO SISTEMA/site sistema/index.js';
let lines = fs.readFileSync(file, 'utf8').split('\n');

// Find the line that has: let totalPago = receber.filter...
let start = lines.findIndex(l => l.includes('let totalPago = receber.filter(c => c.status === \'PAGO\')'));

// Find the next window.onload
let end = lines.findIndex((l, i) => i > start && l.includes('window.onload = () => {'));

if (start !== -1 && end !== -1) {
    let before = lines.slice(0, start + 1);
    let after = lines.slice(end);
    let injection = [
        "    let totalAtrasado = receber.filter(c => c.status === 'PENDENTE' && c.data && new Date(c.data).getTime() < hoje).reduce((a,b) => a + (Number(b.valor) || 0), 0);",
        "    let totalPendenteDia = receber.filter(c => c.status === 'PENDENTE' && c.data && new Date(c.data).getTime() >= hoje).reduce((a,b) => a + (Number(b.valor) || 0), 0);",
        "",
        "    chartInadimplencia.updateSeries([",
        "        { name: 'Recebidos', data: [totalPago] },",
        "        { name: 'Em Atraso', data: [totalAtrasado] },",
        "        { name: 'A Vencer', data: [totalPendenteDia] }",
        "    ]);",
        "}",
        ""
    ];
    
    let newLines = [...before, ...injection, ...after];
    fs.writeFileSync(file, newLines.join('\n'));
    console.log('Fixed index.js, removed lines from', start + 1, 'to', end - 1);
} else {
    console.log('Could not find start or end bounds');
}
