// ==========================================================================
// SCRIPT DE BACKUP COMPLETO DAS COLEÇÕES ANTIGAS (LEGADAS) DO FIRESTORE
// Projeto: lojafc-a31f9
// ==========================================================================

const fs = require('fs');
const path = require('path');

const PROJECT_ID = 'lojafc-a31f9';
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

const COLECOES = [
    'produtos',
    'vendas',
    'clientes',
    'fornecedores',
    'categorias',
    'financeiro',
    'compras',
    'movimentacoes',
    'orcamentos',
    'pedidos_site',
    'funcionarios',
    'notas_servico',
    'notas_devolucao',
    'notas_avulsas',
    'notas_fiscais',
    'caixa',
    'caixa_fechamentos',
    'fechamentos_caixa',
    'marketing_historico',
    'relatorios_ia_historico',
    'fc_moveis'
];

function fromFirestoreValue(val) {
    if (!val) return null;
    if ('stringValue' in val) return val.stringValue;
    if ('integerValue' in val) return parseInt(val.integerValue, 10);
    if ('doubleValue' in val) return parseFloat(val.doubleValue);
    if ('booleanValue' in val) return val.booleanValue;
    if ('timestampValue' in val) return val.timestampValue;
    if ('nullValue' in val) return null;
    if ('mapValue' in val) {
        const res = {};
        const fields = val.mapValue.fields || {};
        for (const k in fields) res[k] = fromFirestoreValue(fields[k]);
        return res;
    }
    if ('arrayValue' in val) {
        const values = val.arrayValue.values || [];
        return values.map(fromFirestoreValue);
    }
    return val;
}

async function baixarColecao(nomeColecao) {
    let docs = [];
    let pageToken = '';

    do {
        let url = `${BASE_URL}/${encodeURIComponent(nomeColecao)}?pageSize=300${pageToken ? '&pageToken=' + pageToken : ''}`;
        try {
            const resp = await fetch(url);
            if (!resp.ok) {
                const errText = await resp.text();
                return { sucesso: false, erro: resp.status + ': ' + errText, docs: [] };
            }
            const data = await resp.json();
            if (data.documents && data.documents.length) {
                for (const doc of data.documents) {
                    const id = decodeURIComponent(doc.name.split('/').pop());
                    const obj = {};
                    for (const k in doc.fields) {
                        obj[k] = fromFirestoreValue(doc.fields[k]);
                    }
                    docs.push({ _id: id, ...obj });
                }
            }
            pageToken = data.nextPageToken || '';
        } catch (e) {
            return { sucesso: false, erro: e.message, docs };
        }
    } while (pageToken);

    return { sucesso: true, docs };
}

async function executarBackup() {
    console.log('====================================================');
    console.log('INICIANDO BACKUP DAS COLEÇÕES ANTIGAS DO BANCO...');
    console.log(`Projeto: ${PROJECT_ID}`);
    console.log('====================================================\n');

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const pastaDestino = path.join(__dirname, '..', 'backups');
    if (!fs.existsSync(pastaDestino)) {
        fs.mkdirSync(pastaDestino, { recursive: true });
    }

    const backupCompleto = {
        meta: {
            projeto: PROJECT_ID,
            dataBackup: new Date().toISOString(),
            tipo: 'backup_colecoes_antigas_raiz'
        },
        colecoes: {},
        resumo: {}
    };

    let totalGeralDocs = 0;

    for (const col of COLECOES) {
        process.stdout.write(`⏳ Baixando '${col}'... `);
        const res = await baixarColecao(col);
        if (res.sucesso) {
            backupCompleto.colecoes[col] = res.docs;
            backupCompleto.resumo[col] = res.docs.length;
            totalGeralDocs += res.docs.length;
            console.log(`✅ ${res.docs.length} documento(s)`);
        } else {
            console.log(`⚠️ Ignorado (${res.erro})`);
            backupCompleto.resumo[col] = `Erro: ${res.erro}`;
        }
    }

    const nomeArquivo = `backup_firestore_antigo_${timestamp}.json`;
    const caminhoFinal = path.join(pastaDestino, nomeArquivo);

    fs.writeFileSync(caminhoFinal, JSON.stringify(backupCompleto, null, 2), 'utf8');

    console.log('\n====================================================');
    console.log('🎉 BACKUP CONCLUÍDO COM SUCESSO!');
    console.log(`📦 Total de documentos salvos: ${totalGeralDocs}`);
    console.log(`📁 Arquivo salvo em:\n${caminhoFinal}`);
    console.log('====================================================');
}

executarBackup();
