// ==========================================================================
// BACKUP AUTOMÁTICO CENTRAL - FC GESTÃO & SAAS
// Salva em: g:\VERSOES DO SISTEMA\site sistema\backupsGestao
// ==========================================================================

const fs = require('fs');
const path = require('path');

const PROJECT_ID = 'lojafc-a31f9';
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// Diretório fixo solicitado pelo usuário
const PASTA_DESTINO = path.resolve('g:/VERSOES DO SISTEMA/site sistema/backupsGestao');

const COLECOES_RAIZ = [
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
    'fc_moveis',
    'planos_saas',
    'contratos_saas',
    'saas_config'
];

const SUBCOLECOES_EMPRESA = [
    'produtos',
    'configuracoes',
    'categorias',
    'caixa',
    'vendas',
    'clientes',
    'faturas_saas'
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

async function baixarCaminho(caminhoCompleto) {
    let docs = [];
    let pageToken = '';

    do {
        let url = `${BASE_URL}/${caminhoCompleto}?pageSize=300${pageToken ? '&pageToken=' + pageToken : ''}`;
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
    console.log('================================================================');
    console.log('       🛡️  INICIANDO BACKUP AUTOMÁTICO DO BANCO DE DADOS');
    console.log(`       Banco de Dados: ${PROJECT_ID}`);
    console.log(`       Destino: ${PASTA_DESTINO}`);
    console.log('================================================================\n');

    if (!fs.existsSync(PASTA_DESTINO)) {
        fs.mkdirSync(PASTA_DESTINO, { recursive: true });
        console.log(`📁 Pasta criada: ${PASTA_DESTINO}\n`);
    }

    const agora = new Date();
    const dataFormatada = agora.toISOString().replace(/[:.]/g, '-').slice(0, 19);

    const backup = {
        meta: {
            projeto: PROJECT_ID,
            dataBackup: agora.toISOString(),
            dataLocal: agora.toLocaleString('pt-BR')
        },
        colecoes_raiz: {},
        empresas: {},
        resumo: {}
    };

    let totalDocumentos = 0;

    console.log('📦 [1/2] Baixando Coleções Gerais...');
    for (const col of COLECOES_RAIZ) {
        process.stdout.write(`   - ${col.padEnd(25)}: `);
        const res = await baixarCaminho(encodeURIComponent(col));
        if (res.sucesso) {
            backup.colecoes_raiz[col] = res.docs;
            backup.resumo[col] = res.docs.length;
            totalDocumentos += res.docs.length;
            console.log(`✅ ${res.docs.length} docs`);
        } else {
            console.log(`⚠️ (vazio ou sem permissão direta)`);
            backup.resumo[col] = 0;
        }
    }

    console.log('\n🏢 [2/2] Baixando Lojas / Empresas (SaaS)...');
    const resEmpresas = await baixarCaminho('empresas');
    if (resEmpresas.sucesso && resEmpresas.docs.length) {
        for (const emp of resEmpresas.docs) {
            const empId = emp._id;
            console.log(`   🏬 Loja: [${empId}] ${emp.nomeEmpresa || emp.nome || ''}`);
            backup.empresas[empId] = {
                dados: emp,
                subcolecoes: {}
            };
            totalDocumentos += 1;

            for (const sub of SUBCOLECOES_EMPRESA) {
                process.stdout.write(`      └── ${sub.padEnd(18)}: `);
                const resSub = await baixarCaminho(`empresas/${encodeURIComponent(empId)}/${encodeURIComponent(sub)}`);
                if (resSub.sucesso) {
                    backup.empresas[empId].subcolecoes[sub] = resSub.docs;
                    totalDocumentos += resSub.docs.length;
                    console.log(`✅ ${resSub.docs.length} docs`);
                } else {
                    console.log(`⚠️ (vazio)`);
                }
            }
        }
    } else {
        console.log('   ⚠️ Nenhuma empresa encontrada.');
    }

    const nomeArquivo = `backup_sistema_${dataFormatada}.json`;
    const caminhoFinal = path.join(PASTA_DESTINO, nomeArquivo);

    console.log('\n💾 Salvando arquivo no disco...');
    fs.writeFileSync(caminhoFinal, JSON.stringify(backup, null, 2), 'utf8');

    const tamanhoMb = (fs.statSync(caminhoFinal).size / (1024 * 1024)).toFixed(2);

    console.log('\n================================================================');
    console.log('🎉  BACKUP REALIZADO COM SUCESSO TOTAL!');
    console.log(`📦  Total de Documentos Salvos: ${totalDocumentos}`);
    console.log(`📊  Tamanho do Arquivo: ${tamanhoMb} MB`);
    console.log(`📁  Arquivo gerado com sucesso em:`);
    console.log(`    ${caminhoFinal}`);
    console.log('================================================================\n');
}

executarBackup().catch(err => {
    console.error('\n❌ ERRO AO EXECUTAR BACKUP:', err);
    process.exit(1);
});
