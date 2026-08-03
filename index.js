// index.js - Lógica exclusiva do Dashboard

function renderDashboard() {
    const vendas = db.vendas || [];
    
    const fatTotal = vendas.reduce((a, b) => a + (b.tot || 0), 0); 
    const cmvTotal = vendas.reduce((a, b) => a + (b.custoTotal || 0), 0);
    const taxasTotal = vendas.reduce((a, b) => a + (b.taxaValor || 0), 0);
    const lucroReal = fatTotal - cmvTotal - taxasTotal;
    
    const aReceber = (db.financeiro || []).filter(f => f.status === 'PENDENTE' && (!f.tipo || f.tipo === 'RECEITA')).reduce((a, b) => a + (Number(b.valor) || 0), 0);
    
    document.getElementById('dash-faturamento').innerText = formatMoney(fatTotal); 
    document.getElementById('dash-lucro').innerText = formatMoney(lucroReal);
    document.getElementById('dash-receber').innerText = formatMoney(aReceber); 
    document.getElementById('dash-produtos').innerText = (db.produtos || []).length;
}

async function migrarBancoAntigo() {
    try {
        const docRef = firestore.collection("fc_moveis").doc("banco_principal");
        const docSnap = await docRef.get();
        if (docSnap.exists) {
            const dados = docSnap.data();
            if (dados.migrado) return;
            
            showToast("Sincronizando banco de dados para a nova versão...", "info");
            
            // O batch do Firebase tem limite de 500 operações por vez. 
            // Vamos fazer gravações individuais ou em batches. Por simplicidade faremos promises individuais.
            const colecoes = ['produtos', 'clientes', 'fornecedores', 'vendas', 'movimentacoes', 'financeiro', 'compras'];
            let count = 0;
            const promessas = [];
            
            for (let col of colecoes) {
                if (dados[col] && Array.isArray(dados[col])) {
                    for (let item of dados[col]) {
                        const id = item.id ? String(item.id) : firestore.collection(col).doc().id;
                        promessas.push(firestore.collection(col).doc(id).set(item));
                        count++;
                    }
                }
            }
            
            if (dados.caixa) promessas.push(firestore.collection("fc_moveis").doc("caixa").set(dados.caixa));
            if (dados.config) promessas.push(firestore.collection("fc_moveis").doc("config").set(dados.config, {merge: true}));
            
            await Promise.all(promessas);
            await docRef.update({ migrado: true });
            
            showToast(`Migração concluída! ${count} registros importados.`, "success");
            setTimeout(() => window.location.reload(), 1500);
        }
    } catch (e) {
        console.error("Erro ao migrar dados: ", e);
    }
}

function inicializarDashboard() {
    migrarBancoAntigo();

    firestore.collection('produtos').onSnapshot(snap => {
        db.produtos = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderDashboard();
    });
    firestore.collection('vendas').onSnapshot(snap => {
        db.vendas = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderDashboard();
    });
    firestore.collection('financeiro').onSnapshot(snap => {
        db.financeiro = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderDashboard();
    });
}

window.onload = () => { 
    initGlobalData(inicializarDashboard); 
};