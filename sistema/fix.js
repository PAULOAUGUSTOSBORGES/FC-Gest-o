const fs = require('fs');
const file = 'g:\\VERSOES DO SISTEMA\\site sistema\\gestao_v2.js';
let content = fs.readFileSync(file, 'utf8');

const target = `                }
            }

    let fluxo30 = 0; let fluxo60 = 0; let fluxo90 = 0; let inadimplencia = 0;`;

const replacement = `                }
            }
        }

        if (dados.caixa) promessas.push(window.getEmpresaRef().collection('caixa').doc('caixa_atual').set(dados.caixa, { merge: true }));
        if (dados.config) promessas.push(window.getEmpresaRef().collection('configuracoes').doc('config').set(dados.config, { merge: true }));

        await Promise.all(promessas);
        // Marca como migrado
        try { await firestore.collection('fc_moveis').doc('banco_principal').update({ migrado: true }); } catch (e2) { console.error("Erro interno:", e2); }

        showToast('Dados importados com sucesso! Recarregando...', 'success');
        setTimeout(() => window.location.reload(), 2000);

    } catch (e) {
        console.error('Erro na migração:', e);
        showToast('Aviso: Erro ao importar dados anteriores.', 'error');
    }
}

function inicializarGestao() {
    // Primeiro tenta migrar dados do banco antigo se necessário
    migrarDadosSeNecessario();

    // Controla quantas coleções já carregaram o primeiro snapshot
    let colecoesProntas = 0;
    const totalColecoes = 7;
    function tentarRefresh() {
        colecoesProntas++;
        if (colecoesProntas >= totalColecoes) refreshCurrentView();
    }

    window.getEmpresaRef().collection('vendas').onSnapshot(snap => {
        db.vendas = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        tentarRefresh();
    });
    window.getEmpresaRef().collection('financeiro').onSnapshot(snap => {
        db.financeiro = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        tentarRefresh();
    });
    window.getEmpresaRef().collection('compras').onSnapshot(snap => {
        db.compras = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        tentarRefresh();
    });
    window.getEmpresaRef().collection('produtos').onSnapshot(snap => {
        db.produtos = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        tentarRefresh();
    });
    window.getEmpresaRef().collection('clientes').onSnapshot(snap => {
        db.clientes = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        tentarRefresh();
    });
    window.getEmpresaRef().collection('fornecedores').onSnapshot(snap => {
        db.fornecedores = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        tentarRefresh();
    });
    window.getEmpresaRef().collection('funcionarios').onSnapshot(snap => {
        db.funcionarios = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        tentarRefresh();
    });
    window.getEmpresaRef().collection('caixa').doc('caixa_atual').onSnapshot(doc => {
        if(doc.exists) db.caixa = doc.data();
        else db.caixa = { status: 'FECHADO', saldo: 0, historico: [] };
        if (colecoesProntas >= totalColecoes) refreshCurrentView();
    });
}

window.addEventListener('load', () => { initGlobalData(inicializarGestao); });

function atualizarCardsFluxoDeCaixa() {
    if (!db.financeiro) return;
    
    const hoje = new Date();
    hoje.setHours(0,0,0,0);
    const msPorDia = 24 * 60 * 60 * 1000;

    let fluxo30 = 0; let fluxo60 = 0; let fluxo90 = 0; let inadimplencia = 0;`;

// Handle possible \r\n vs \n differences
const regexTarget = new RegExp(target.replace(/\r?\n/g, '\\r?\\n').replace(/\s+/g, '\\s+'));

if (regexTarget.test(content)) {
    content = content.replace(regexTarget, replacement);
    fs.writeFileSync(file, content, 'utf8');
    console.log('Fixed gestao_v2.js successfully!');
} else {
    console.log('Target not found! Dump around that area:');
    const startIdx = content.indexOf('inadimplencia = 0;');
    console.log(content.substring(startIdx - 100, startIdx + 100));
}


