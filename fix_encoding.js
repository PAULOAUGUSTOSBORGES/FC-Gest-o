const fs = require('fs');
const file = 'g:\\VERSOES DO SISTEMA\\site sistema\\financeiro.html';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/Este MÃªs/g, 'Este Mês');
content = content.replace(/PrÃ³ximos/g, 'Próximos');
content = content.replace(/HistÃ³rico/g, 'Histórico');

fs.writeFileSync(file, content, 'utf8');
console.log('Done');
