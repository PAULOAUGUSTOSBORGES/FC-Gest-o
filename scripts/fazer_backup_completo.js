// ==========================================================================
// BACKUP AUTOMÁTICO CENTRAL - FC GESTÃO & SAAS
// Salva em: g:\VERSOES DO SISTEMA\site sistema\backupsGestao
// ==========================================================================

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const PROJECT_ID = 'lojafc-a31f9';
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// Diretório fixo solicitado pelo usuário
const PASTA_DESTINO = path.resolve('g:/VERSOES DO SISTEMA/site sistema/backupsGestao');

const SUBCOLECOES_PADRAO = [
    'produtos',
    'configuracoes',
    'categorias',
    'caixa',
    'caixa_fechamentos',
    'fechamentos_caixa',
    'vendas',
    'clientes',
    'fornecedores',
    'financeiro',
    'movimentacoes',
    'funcionarios',
    'orcamentos',
    'compras',
    'pedidos_site',
    'notas_servico',
    'notas_devolucao',
    'notas_avulsas',
    'notas_fiscais',
    'marketing_historico',
    'relatorios_ia_historico',
    'faturas_saas'
];

const COLECOES_RAIZ_PADRAO = [
    'usuarios',
    'planos_saas',
    'saas_config',
    'pagamentos_pendentes',
    'pagamentos_pendentes_email'
];

let TOKEN_ACESSO = null;

function obterTokenAutenticacao() {
    const configPath = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
    if (!fs.existsSync(configPath)) {
        console.warn('⚠️ Arquivo de credenciais do Firebase CLI não encontrado em:', configPath);
        return null;
    }

    try {
        let dados = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (!dados.tokens) return null;

        const expiresAt = dados.tokens.expires_at || 0;
        if (Date.now() > expiresAt - 60000) {
            console.log('🔄 Renovando token de acesso do Firebase...');
            try {
                execSync('firebase projects:list', { stdio: 'ignore' });
                dados = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            } catch (errRenovacao) {
                console.warn('⚠️ Não foi possível renovar automaticamente:', errRenovacao.message);
            }
        }

        const userEmail = dados.user ? dados.user.email : 'Super Admin';
        console.log(`🔑 Autenticado com sucesso via Firebase CLI: ${userEmail}\n`);
        return dados.tokens.access_token;
    } catch (e) {
        console.warn('⚠️ Erro ao ler credenciais do Firebase:', e.message);
        return null;
    }
}

function getHeaders() {
    const h = { 'Content-Type': 'application/json' };
    if (TOKEN_ACESSO) {
        h['Authorization'] = `Bearer ${TOKEN_ACESSO}`;
    }
    return h;
}

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

async function listarIdsSubcolecoes(caminhoPai) {
    const url = `https://firestore.googleapis.com/v1/${caminhoPai}:listCollectionIds`;
    try {
        const resp = await fetch(url, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({})
        });
        if (!resp.ok) return [];
        const data = await resp.json();
        return data.collectionIds || [];
    } catch (e) {
        return [];
    }
}

async function baixarCaminho(caminhoCompleto) {
    let docs = [];
    let pageToken = '';

    do {
        let url = `${BASE_URL}/${caminhoCompleto}?pageSize=300${pageToken ? '&pageToken=' + pageToken : ''}`;
        try {
            const resp = await fetch(url, { headers: getHeaders() });
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

    TOKEN_ACESSO = obterTokenAutenticacao();

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

    console.log('📦 [1/2] Baixando Coleções Gerais do Sistema...');
    const colsRaizDinamicas = await listarIdsSubcolecoes(`projects/${PROJECT_ID}/databases/(default)/documents`);
    const colsRaiz = Array.from(new Set([...COLECOES_RAIZ_PADRAO, ...colsRaizDinamicas]))
        .filter(c => c !== 'empresas');

    for (const col of colsRaiz) {
        process.stdout.write(`   - ${col.padEnd(30)}: `);
        const res = await baixarCaminho(encodeURIComponent(col));
        if (res.sucesso) {
            backup.colecoes_raiz[col] = res.docs;
            backup.resumo[col] = res.docs.length;
            totalDocumentos += res.docs.length;
            console.log(`✅ ${res.docs.length} docs`);
        } else {
            console.log(`⚠️ (vazio)`);
            backup.resumo[col] = 0;
        }
    }

    console.log('\n🏢 [2/2] Baixando Todas as Lojas / Empresas (SaaS)...');
    const resEmpresas = await baixarCaminho('empresas');
    if (resEmpresas.sucesso && resEmpresas.docs.length) {
        for (const emp of resEmpresas.docs) {
            const empId = emp._id;
            const nomeLoja = emp.nomeEmpresa || emp.nome || emp.razaoSocial || 'Loja';
            console.log(`\n   🏬 Loja: [${empId}] ${nomeLoja}`);
            backup.empresas[empId] = {
                dados: emp,
                subcolecoes: {}
            };
            totalDocumentos += 1;

            const subsDinamicas = await listarIdsSubcolecoes(`projects/${PROJECT_ID}/databases/(default)/documents/empresas/${encodeURIComponent(empId)}`);
            const subcolecoes = Array.from(new Set([...subsDinamicas, ...SUBCOLECOES_PADRAO]));

            for (const sub of subcolecoes) {
                const caminhoSub = `empresas/${encodeURIComponent(empId)}/${encodeURIComponent(sub)}`;
                const resSub = await baixarCaminho(caminhoSub);
                if (resSub.sucesso && resSub.docs.length > 0) {
                    process.stdout.write(`      └── ${sub.padEnd(25)}: `);
                    backup.empresas[empId].subcolecoes[sub] = resSub.docs;
                    totalDocumentos += resSub.docs.length;
                    console.log(`✅ ${resSub.docs.length} docs`);
                } else if (subsDinamicas.includes(sub)) {
                    process.stdout.write(`      └── ${sub.padEnd(25)}: `);
                    console.log(`ℹ️ 0 docs`);
                }
            }
        }
    } else {
        console.log('   ⚠️ Nenhuma empresa encontrada.');
    }

    const nomeArquivo = `backup_sistema_${dataFormatada}.json`;
    const caminhoFinal = path.join(PASTA_DESTINO, nomeArquivo);

    console.log('\n💾 Salvando arquivo compactado no disco...');
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
