const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");
const forge = require("node-forge");
const crypto = require("crypto");
const { emitirNotaDiretoSefaz, cancelarNotaDiretoSefaz, cartaCorrecaoDiretoSefaz, transmitirNotaContingenciaSefaz } = require("./fiscal/sefaz_engine");
const { extrairChavesDoPfx } = require("./fiscal/sefaz_signer");

admin.initializeApp();
const db = admin.firestore();

/**
 * Função para Emitir NFC-e (Cupom Fiscal)
 * Chamada pelo Frontend passando { vendaId: '...' }
 */
exports.chamarGemini = functions.runWith({ serviceAccount: 'lojafc-a31f9@appspot.gserviceaccount.com' }).https.onCall(async (data, context) => {
    const empId = (data && data.empId) ? data.empId : 'emp_fc_moveis';
    const empresaRef = db.collection('empresas').doc(empId);
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Usuário não autenticado.");
    
    // Validar se tem permissão (Admin, Gestão ou Marketing)
    const funcSnap = await empresaRef.collection("funcionarios").doc(context.auth.uid).get();
    const isPermitido = funcSnap.exists && (funcSnap.data().isAdmin || funcSnap.data().perm_gestao);
    if (!isPermitido) throw new functions.https.HttpsError("permission-denied", "Sem permissão para usar IA.");

    const configSnap = await empresaRef.collection("configuracoes").doc("config").get();
    const configGemini = configSnap.data()?.geminiApiKey;
    if (!configGemini) throw new functions.https.HttpsError("failed-precondition", "API Key não configurada.");

    try {
        const res = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${configGemini}`, {
            contents: [{ parts: [{ text: data.prompt }] }]
        });
        return res.data.candidates?.[0]?.content?.parts?.[0]?.text || "Resposta indisponível.";
    } catch (e) {
        throw new functions.https.HttpsError("internal", "Falha ao chamar API.");
    }
});

// ==========================================
// UTILITÁRIOS AUXILIARES DO MOTOR FISCAL
// ==========================================

/**
 * Mapeia formas de pagamento do sistema para códigos da Focus NFe / SEFAZ
 */
function mapearFormasPagamento(venda) {
    const mapa = {
        'DINHEIRO': '01',
        'CHEQUE': '02',
        'CARTÃO CRÉDITO': '03',
        'CARTAO CREDITO': '03',
        'CRÉDITO': '03',
        'CREDITO': '03',
        'CARTÃO DÉBITO': '04',
        'CARTAO DEBITO': '04',
        'DÉBITO': '04',
        'DEBITO': '04',
        'CRÉDITO LOJA': '05',
        'FIADO': '05',
        'VALE ALIMENTAÇÃO': '10',
        'VALE REFEIÇÃO': '11',
        'VALE PRESENTE': '12',
        'VALE COMBUSTÍVEL': '13',
        'DUPLICATA MERCANTIL': '14',
        'BOLETO': '15',
        'BOLETO BANCÁRIO': '15',
        'DEPÓSITO BANCÁRIO': '16',
        'PIX': '17',
        'TRANSFERÊNCIA BANCÁRIA': '18',
        'PROGRAMA DE FIDELIDADE': '19',
        'SEM PAGAMENTO': '90',
        'OUTROS': '99'
    };

    if (venda.pagamentos && Array.isArray(venda.pagamentos) && venda.pagamentos.length > 0) {
        return venda.pagamentos.map(p => {
            const metUpper = String(p.metodo || '').toUpperCase().trim();
            let cod = '99';
            for (const [chave, val] of Object.entries(mapa)) {
                if (metUpper.includes(chave)) {
                    cod = val;
                    break;
                }
            }
            return {
                forma_pagamento: cod,
                valor_pagamento: Number(p.valor || 0)
            };
        });
    }

    // Fallback para venda.pag texto
    let formaPagamento = "01";
    const pagUpper = String(venda.pag || "").toUpperCase();
    if (pagUpper.includes("PIX")) formaPagamento = "17";
    else if (pagUpper.includes("CRÉDITO") || pagUpper.includes("CREDITO")) formaPagamento = "03";
    else if (pagUpper.includes("DÉBITO") || pagUpper.includes("DEBITO")) formaPagamento = "04";
    else if (pagUpper.includes("BOLETO")) formaPagamento = "15";
    else if (pagUpper.includes("FIADO")) formaPagamento = "05";

    return [{
        forma_pagamento: formaPagamento,
        valor_pagamento: Number(venda.tot || venda.valorLiquido || 0)
    }];
}

/**
 * Monta os itens para envio fiscal, enriquecendo dados fiscais faltantes direto da coleção de produtos
 */
async function montarItensFocus(produtosVenda) {
    const itensFocus = [];

    for (let index = 0; index < produtosVenda.length; index++) {
        const item = produtosVenda[index];
        const qtd = Number(item.qtd) || 1;
        const preco = Number(item.preco) || 0;

        let ncm = item.ncm ? String(item.ncm).replace(/\D/g, "") : "";
        let cfop = item.cfop ? String(item.cfop).replace(/\D/g, "") : "";
        let csosn = item.csosn ? String(item.csosn).replace(/\D/g, "") : "";
        let origem = item.origem ? String(item.origem) : "";
        let unidade = item.unidade ? String(item.unidade).trim() : "";
        let cest = item.cest ? String(item.cest).replace(/\D/g, "") : "";

        // Se faltar NCM ou CFOP, busca o produto no banco de dados como fallback de segurança
        if (!ncm || ncm === "00000000" || !cfop) {
            try {
                if (item.id) {
                    const pSnap = await empresaRef.collection("produtos").doc(String(item.id)).get();
                    if (pSnap.exists) {
                        const pData = pSnap.data();
                        if (!ncm && pData.ncm) ncm = String(pData.ncm).replace(/\D/g, "");
                        if (!cfop && pData.cfop) cfop = String(pData.cfop).replace(/\D/g, "");
                        if (!csosn && pData.csosn) csosn = String(pData.csosn).replace(/\D/g, "");
                        if (!origem && pData.origem !== undefined) origem = String(pData.origem);
                        if (!unidade && pData.unidade) unidade = String(pData.unidade).trim();
                        if (!cest && pData.cest) cest = String(pData.cest).replace(/\D/g, "");
                    }
                }
            } catch (errProd) {
                console.warn("Aviso ao buscar produto no Firestore:", errProd.message);
            }
        }

        // Padrões fiscais seguros caso ainda não preenchidos
        if (!ncm || ncm.length < 8) ncm = "94036000"; // Móveis de madeira / Outros móveis
        if (!cfop) cfop = "5102"; // Venda de mercadoria adquirida de terceiros dentro do estado
        if (!csosn) csosn = "102"; // Tributada pelo Simples Nacional sem permissão de crédito
        if (!origem) origem = "0"; // Nacional
        if (!unidade) unidade = "UN"; // Unidade

        const itemObj = {
            numero_item: index + 1,
            codigo_produto: String(item.id || `PROD-${index + 1}`),
            descricao: item.nome || `Produto ${index + 1}`,
            cfop: cfop,
            codigo_ncm: ncm,
            quantidade_comercial: qtd,
            quantidade_tributavel: qtd,
            valor_unitario_comercial: preco,
            valor_unitario_tributavel: preco,
            valor_bruto: Number((qtd * preco).toFixed(2)),
            unidade_comercial: unidade,
            unidade_tributavel: unidade,
            icms_origem: origem,
            icms_situacao_tributaria: csosn
        };

        if (cest && cest.length >= 7) {
            itemObj.codigo_cest = cest;
        }

        if (item.desconto && Number(item.desconto) > 0) {
            itemObj.valor_desconto = Number(Number(item.desconto).toFixed(2));
        }

        itensFocus.push(itemObj);
    }

    return itensFocus;
}

// ==========================================
// ==========================================
// HELPERS MULTI-TENANT & FALLBACK FISCAL
// ==========================================
async function localizarVendaEConfig(vendaId, empId) {
    const id = String(vendaId).trim();
    let empresaRef = db.collection('empresas').doc(empId || 'emp_fc_moveis');
    
    // 1. Tenta na subcolecao da empresa
    let vendaSnap = await empresaRef.collection("vendas").doc(id).get();
    if (vendaSnap.exists) {
        return { vendaSnap, empresaRef, vendaRef: vendaSnap.ref };
    }
    
    // 2. Tenta na raiz (legado)
    const raizSnap = await db.collection("vendas").doc(id).get();
    if (raizSnap.exists) {
        return { vendaSnap: raizSnap, empresaRef, vendaRef: raizSnap.ref };
    }
    
    // 3. Tenta em collectionGroup('vendas') em caso de empId divergente ou nao especificado
    try {
        const cgSnap = await db.collectionGroup("vendas").where(admin.firestore.FieldPath.documentId(), "==", id).limit(1).get();
        if (!cgSnap.empty) {
            const foundSnap = cgSnap.docs[0];
            const parentEmp = foundSnap.ref.parent ? foundSnap.ref.parent.parent : null;
            if (parentEmp) {
                empresaRef = parentEmp;
            }
            return { vendaSnap: foundSnap, empresaRef, vendaRef: foundSnap.ref };
        }
    } catch (e) {
        console.warn("[localizarVendaEConfig] Aviso na busca collectionGroup:", e.message);
    }
    
    return { vendaSnap, empresaRef, vendaRef: empresaRef.collection("vendas").doc(id) };
}

async function verificarPermissaoUsuario(empresaRef, uid, tiposPermissao = ['isAdmin', 'perm_pdv', 'perm_gestao']) {
    try {
        const funcSnap = await empresaRef.collection("funcionarios").doc(uid).get();
        if (funcSnap.exists) {
            const d = funcSnap.data() || {};
            if (tiposPermissao.some(p => Boolean(d[p]))) return true;
        }
    } catch (e) {}

    try {
        const raizFuncSnap = await db.collection("funcionarios").doc(uid).get();
        if (raizFuncSnap.exists) {
            const d = raizFuncSnap.data() || {};
            if (tiposPermissao.some(p => Boolean(d[p]))) return true;
        }
    } catch (e) {}

    return false;
}

async function obterConfigEmpresaComFallback(empresaRef) {
    let configSnap = await empresaRef.collection("configuracoes").doc("config").get();
    let config = configSnap.data() || {};
    
    // ATENÇÃO MULTI-TENANT: Fallback para doc padrão/raiz SOMENTE é permitido para a empresa legada 'emp_fc_moveis'.
    // Empresas terceiras/filiais NUNCA podem herdar certificado ou dados fiscais de outra empresa!
    if (empresaRef && empresaRef.id === 'emp_fc_moveis') {
        if (!config.empresa || !config.empresa.certificadoBase64) {
            try {
                const raizConfigSnap = await db.collection("configuracoes").doc("config").get();
                if (raizConfigSnap.exists && raizConfigSnap.data()?.empresa?.certificadoBase64) {
                    config = { ...raizConfigSnap.data(), ...config, empresa: { ...(raizConfigSnap.data().empresa || {}), ...(config.empresa || {}) } };
                }
            } catch (e) {}
        }
    }
    
    return config;
}

// 1. EMISSÃO DE NFC-e (CUPOM FISCAL / MOD 65)
// ==========================================
exports.emitirNFCe = functions.runWith({ serviceAccount: 'lojafc-a31f9@appspot.gserviceaccount.com' }).https.onCall(async (data, context) => {
    const empId = (data && data.empId) ? data.empId : 'emp_fc_moveis';
    let empresaRef = db.collection('empresas').doc(empId);
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Usuário não autenticado.");

    // Validação de permissão
    const hasPerm = await verificarPermissaoUsuario(empresaRef, context.auth.uid, ['isAdmin', 'perm_pdv', 'perm_gestao']);
    if (!hasPerm) throw new functions.https.HttpsError("permission-denied", "Sem permissão para emitir NFC-e.");

    try {
        const vendaId = data.vendaId;
        if (!vendaId) throw new functions.https.HttpsError("invalid-argument", "vendaId não informado.");

        // 1. Buscar Venda e Configurações da Empresa
        const loc = await localizarVendaEConfig(vendaId, empId);
        const vendaSnap = loc.vendaSnap;
        empresaRef = loc.empresaRef;
        const vendaRef = loc.vendaRef;
        if (!vendaSnap.exists) throw new functions.https.HttpsError("not-found", "Venda não encontrada.");
        const venda = vendaSnap.data();

        const config = await obterConfigEmpresaComFallback(empresaRef);
        if (!config || !config.empresa) throw new functions.https.HttpsError("failed-precondition", "Configurações da empresa incompletas.");
        const empresa = config.empresa;

        if (!empresa.ambienteFiscal || empresa.ambienteFiscal !== 'producao') {
            empresa.ambienteFiscal = 'producao';
            empresaRef.collection("configuracoes").doc("config").set({ empresa: { ambienteFiscal: 'producao' } }, { merge: true }).catch(console.error);
        }

        if (!empresa.certificadoBase64) {
            throw new functions.https.HttpsError(
                "failed-precondition",
                "Certificado Digital A1 (.pfx) não configurado. Acesse Configurações > Emissor Fiscal para fazer o upload do certificado e salvar a senha."
            );
        }

        if (!empresa.cscToken || !empresa.cscToken.trim()) {
            throw new functions.https.HttpsError(
                "failed-precondition",
                "Token CSC não configurado! Acesse Configurações > Emissor Fiscal e preencha o Token CSC e o ID do Token para emitir NFC-e."
            );
        }

        console.log(`[SEFAZ NFC-e] Configuração CSC da Empresa: cscId="${empresa.cscId}", cscToken="${empresa.cscToken ? (empresa.cscToken.trim().substring(0, 4) + '...' + empresa.cscToken.trim().slice(-4)) : 'VAZIO'}", tamanho=${empresa.cscToken ? empresa.cscToken.trim().length : 0}`);

        const produtos = venda.itens || venda.produtos || [];
        if (produtos.length === 0) throw new functions.https.HttpsError("invalid-argument", "A venda não possui itens.");

        const isContingencia = Boolean(data.contingencia);
        const justificativa = data.justificativa || "Instabilidade momentanea na comunicacao com a SEFAZ";

        console.log(`Emitindo NFC-e ${isContingencia ? 'EM CONTINGÊNCIA' : 'via SEFAZ Direto'} para a venda ${vendaId}...`);
        let clienteData = null;
        if (venda.clienteId && venda.clienteId !== '0') {
            const cliSnap = await empresaRef.collection("clientes").doc(String(venda.clienteId)).get();
            if (cliSnap.exists) clienteData = cliSnap.data();
        }

        const resultadoSefaz = await emitirNotaDiretoSefaz('65', venda, empresa, produtos, clienteData, {
            contingencia: isContingencia,
            justificativaContingencia: justificativa,
            fallbackContingencia: Boolean(data.fallbackContingencia)
        });

        const statusFiscal = resultadoSefaz.contingencia ? "contingencia" : (resultadoSefaz.sucesso ? "autorizado" : "erro_autorizacao");

        const dadosRetorno = {
            tipo: "NFC-e",
            modelo: "65",
            contingencia: Boolean(resultadoSefaz.contingencia),
            status_sefaz: statusFiscal,
            mensagem_sefaz: resultadoSefaz.mensagemSefaz || "",
            chave_nfe: resultadoSefaz.chave || "",
            numero: resultadoSefaz.numero || "",
            serie: resultadoSefaz.serie || (empresa.serieNFCe || "1"),
            protocolo: resultadoSefaz.protocolo || "",
            ambiente: resultadoSefaz.ambiente || empresa.ambienteFiscal || "producao",
            data_emissao: resultadoSefaz.dataAutorizacao || new Date().toISOString(),
            qr_code_url: resultadoSefaz.qrCodeUrl || "",
            xml_conteudo: resultadoSefaz.xml || "",
            motor: "sefaz_direto"
        };

        await vendaRef.set({
            nfce: dadosRetorno,
            status_fiscal: dadosRetorno.status_sefaz,
            tipo_fiscal: "NFC-e",
            fiscal_chave: dadosRetorno.chave_nfe,
            fiscal_xml: dadosRetorno.xml_conteudo,
            fiscal_qrcode_url: dadosRetorno.qr_code_url,
            fiscal_motor: "sefaz_direto",
            fiscal_contingencia: Boolean(resultadoSefaz.contingencia)
        }, { merge: true });

        if (resultadoSefaz.sucesso && resultadoSefaz.numero) {
            const proxNum = parseInt(resultadoSefaz.numero, 10) + 1;
            await empresaRef.collection("configuracoes").doc("config").set({
                empresa: { proximoNumeroNFCe: proxNum }
            }, { merge: true });
        }

        if (!resultadoSefaz.sucesso && !resultadoSefaz.contingencia) {
            throw new functions.https.HttpsError("failed-precondition", resultadoSefaz.mensagemSefaz || "Rejeição na autorização da NFC-e pela SEFAZ.");
        }

        return {
            success: true,
            contingencia: Boolean(resultadoSefaz.contingencia),
            message: resultadoSefaz.contingencia 
                ? "NFC-e emitida em CONTINGÊNCIA off-line com sucesso! Cupom fiscal liberado para impressão." 
                : "NFC-e autorizada com sucesso via SEFAZ Direto!",
            data: dadosRetorno
        };

    } catch (error) {
        console.error("Erro ao emitir NFC-e:", error);
        if (error instanceof functions.https.HttpsError) throw error;
        throw new functions.https.HttpsError("internal", error.message);
    }
});

// ====================================================
// 1.1 TRANSMISSÃO DE NFC-e EMITIDA EM CONTINGÊNCIA
// ====================================================
exports.transmitirNFCeContingencia = functions.runWith({ serviceAccount: 'lojafc-a31f9@appspot.gserviceaccount.com' }).https.onCall(async (data, context) => {
    const empId = (data && data.empId) ? data.empId : 'emp_fc_moveis';
    let empresaRef = db.collection('empresas').doc(empId);
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Usuário não autenticado.");

    const hasPerm = await verificarPermissaoUsuario(empresaRef, context.auth.uid, ['isAdmin', 'perm_pdv', 'perm_gestao']);
    if (!hasPerm) throw new functions.https.HttpsError("permission-denied", "Sem permissão para transmitir nota.");

    try {
        const vendaId = data.vendaId;
        if (!vendaId) throw new functions.https.HttpsError("invalid-argument", "vendaId não informado.");

        const loc = await localizarVendaEConfig(vendaId, empId);
        const vendaSnap = loc.vendaSnap;
        empresaRef = loc.empresaRef;
        const vendaRef = loc.vendaRef;
        if (!vendaSnap.exists) throw new functions.https.HttpsError("not-found", "Venda não encontrada.");
        const venda = vendaSnap.data();

        const config = await obterConfigEmpresaComFallback(empresaRef);
        if (!config || !config.empresa) throw new functions.https.HttpsError("failed-precondition", "Configurações da empresa incompletas.");
        const empresa = config.empresa;

        const xmlAssinado = venda.fiscal_xml || venda.nfce?.xml_conteudo;
        const chave = venda.fiscal_chave || venda.nfce?.chave_nfe;

        if (!xmlAssinado || !chave) {
            throw new functions.https.HttpsError("failed-precondition", "A venda não possui o XML assinado da NFC-e em contingência.");
        }

        console.log(`[CONTINGÊNCIA] Transmitindo nota da venda ${vendaId} chave ${chave} para a SEFAZ...`);
        const resultado = await transmitirNotaContingenciaSefaz(xmlAssinado, chave, empresa, '65');

        if (resultado.sucesso) {
            const nfceAtualizada = {
                ...(venda.nfce || {}),
                status_sefaz: "autorizado",
                protocolo: resultado.nProt,
                data_autorizacao: resultado.dhRecbto || new Date().toISOString(),
                xml_conteudo: resultado.xmlProc || xmlAssinado,
                mensagem_sefaz: resultado.xMotivo || "Autorizado o uso da NFC-e",
                contingencia_transmitida: true
            };

            await vendaRef.set({
                nfce: nfceAtualizada,
                status_fiscal: "autorizado",
                fiscal_protocolo: resultado.nProt,
                fiscal_xml: resultado.xmlProc || xmlAssinado,
                fiscal_contingencia_transmitida: true
            }, { merge: true });

            return {
                success: true,
                message: `NFC-e emitida em contingência foi AUTORIZADA pela SEFAZ! Protocolo: ${resultado.nProt}`,
                protocolo: resultado.nProt,
                cStat: resultado.cStat
            };
        } else {
            throw new functions.https.HttpsError("failed-precondition", `Rejeição SEFAZ (${resultado.cStat}): ${resultado.xMotivo}`);
        }
    } catch (error) {
        console.error("Erro ao transmitir NFC-e em contingência:", error);
        if (error instanceof functions.https.HttpsError) throw error;
        throw new functions.https.HttpsError("internal", error.message);
    }
});

// ==========================================
// 2. EMISSÃO DE NF-e (MODELO 55 - NOTA COMPLETA)
// ==========================================
exports.emitirNFe = functions.runWith({ serviceAccount: 'lojafc-a31f9@appspot.gserviceaccount.com' }).https.onCall(async (data, context) => {
    const empId = (data && data.empId) ? data.empId : 'emp_fc_moveis';
    let empresaRef = db.collection('empresas').doc(empId);
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Usuário não autenticado.");

    // Validação de permissão
    const hasPerm = await verificarPermissaoUsuario(empresaRef, context.auth.uid, ['isAdmin', 'perm_pdv', 'perm_gestao']);
    if (!hasPerm) throw new functions.https.HttpsError("permission-denied", "Sem permissão para emitir NF-e.");

    try {
        const vendaId = data.vendaId;
        if (!vendaId) throw new functions.https.HttpsError("invalid-argument", "vendaId não informado.");

        // 1. Buscar Venda e Configurações da Empresa
        const loc = await localizarVendaEConfig(vendaId, empId);
        const vendaSnap = loc.vendaSnap;
        empresaRef = loc.empresaRef;
        const vendaRef = loc.vendaRef;
        if (!vendaSnap.exists) throw new functions.https.HttpsError("not-found", "Venda não encontrada.");
        const venda = vendaSnap.data();

        const config = await obterConfigEmpresaComFallback(empresaRef);
        if (!config || !config.empresa) throw new functions.https.HttpsError("failed-precondition", "Configurações da empresa incompletas.");
        const empresa = config.empresa;

        if (!empresa.ambienteFiscal || empresa.ambienteFiscal !== 'producao') {
            empresa.ambienteFiscal = 'producao';
            empresaRef.collection("configuracoes").doc("config").set({ empresa: { ambienteFiscal: 'producao' } }, { merge: true }).catch(console.error);
        }

        if (!empresa.certificadoBase64) {
            throw new functions.https.HttpsError(
                "failed-precondition",
                "Certificado Digital A1 (.pfx) não configurado. Acesse Configurações > Emissor Fiscal para fazer o upload do certificado e salvar a senha."
            );
        }

        // 2. Buscar Dados Completos do Cliente (Destinatário Obrigatório na NF-e)
        let clienteData = null;
        if (venda.clienteId && venda.clienteId !== '0') {
            const cliSnap = await empresaRef.collection("clientes").doc(String(venda.clienteId)).get();
            if (cliSnap.exists) clienteData = cliSnap.data();
        }

        const cliDoc = (clienteData && (clienteData.cpf || clienteData.cnpj || clienteData.doc)) || venda.clienteCpf || venda.clienteDoc || '';
        const docClean = String(cliDoc).replace(/\D/g, '');
        if (!docClean || (docClean.length !== 11 && docClean.length !== 14)) {
            throw new functions.https.HttpsError("failed-precondition", "Para emitir NF-e (Modelo 55), o cliente precisa ter CPF ou CNPJ válido cadastrado ou informado na venda.");
        }

        const produtos = venda.itens || venda.produtos || [];
        if (produtos.length === 0) throw new functions.https.HttpsError("invalid-argument", "A venda não possui itens.");

        console.log(`Emitindo NF-e (Mod 55) via SEFAZ Direto para a venda ${vendaId}...`);
        const resultadoSefaz = await emitirNotaDiretoSefaz('55', venda, empresa, produtos, clienteData);

        const dadosRetorno = {
            tipo: "NF-e",
            modelo: "55",
            status_sefaz: resultadoSefaz.sucesso ? "autorizado" : "erro_autorizacao",
            mensagem_sefaz: resultadoSefaz.mensagemSefaz || "",
            chave_nfe: resultadoSefaz.chave || "",
            numero: resultadoSefaz.numero || "",
            serie: resultadoSefaz.serie || (empresa.serieNFe || "1"),
            protocolo: resultadoSefaz.protocolo || "",
            ambiente: resultadoSefaz.ambiente || empresa.ambienteFiscal || "producao",
            data_emissao: resultadoSefaz.dataAutorizacao || new Date().toISOString(),
            xml_conteudo: resultadoSefaz.xml || "",
            motor: "sefaz_direto"
        };

        await vendaRef.set({
            nfe: dadosRetorno,
            status_fiscal: dadosRetorno.status_sefaz,
            tipo_fiscal: "NF-e",
            fiscal_chave: dadosRetorno.chave_nfe,
            fiscal_xml: dadosRetorno.xml_conteudo,
            fiscal_motor: "sefaz_direto"
        }, { merge: true });

        if (resultadoSefaz.sucesso && resultadoSefaz.numero) {
            const proxNum = parseInt(resultadoSefaz.numero, 10) + 1;
            await empresaRef.collection("configuracoes").doc("config").set({
                empresa: { proximoNumeroNFe: proxNum }
            }, { merge: true });
        }

        if (!resultadoSefaz.sucesso) {
            throw new functions.https.HttpsError("failed-precondition", resultadoSefaz.mensagemSefaz || "Rejeição na autorização da NF-e pela SEFAZ.");
        }

        return {
            success: true,
            message: "NF-e autorizada com sucesso via SEFAZ Direto!",
            data: dadosRetorno
        };

    } catch (error) {
        console.error("Erro ao emitir NF-e:", error);
        if (error instanceof functions.https.HttpsError) throw error;
        throw new functions.https.HttpsError("internal", error.message);
    }
});

// ==========================================
// 3. CANCELAMENTO DE NOTA FISCAL (NF-e OU NFC-e)
// ==========================================
exports.cancelarNotaFiscal = functions.runWith({ serviceAccount: 'lojafc-a31f9@appspot.gserviceaccount.com' }).https.onCall(async (data, context) => {
    const empId = (data && data.empId) ? data.empId : 'emp_fc_moveis';
    const empresaRef = db.collection('empresas').doc(empId);
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Usuário não autenticado.");

    const funcSnap = await empresaRef.collection("funcionarios").doc(context.auth.uid).get();
    const hasPerm = funcSnap.exists && (funcSnap.data().isAdmin || funcSnap.data().perm_gestao);
    if (!hasPerm) throw new functions.https.HttpsError("permission-denied", "Sem permissão para cancelar notas fiscais.");

    try {
        const { vendaId, tipo, justificativa, chave: chaveParam, numero: numeroParam } = data;
        if (!vendaId && !chaveParam && !numeroParam) {
            throw new functions.https.HttpsError("invalid-argument", "Identificador da nota fiscal não informado.");
        }
        if (!justificativa || justificativa.trim().length < 15) {
            throw new functions.https.HttpsError("invalid-argument", "A justificativa deve ter pelo menos 15 caracteres (exigência da SEFAZ).");
        }

        const tipoNormalizado = (tipo || "nfce").toLowerCase().replace('-', '');

        let targetDoc = null;
        let targetRef = null;
        let targetCollection = null;

        // 1. Tenta buscar na coleção 'vendas'
        if (vendaId) {
            const loc = await localizarVendaEConfig(vendaId, empId);
            if (loc.vendaSnap.exists) {
                targetDoc = loc.vendaSnap.data();
                targetRef = loc.vendaRef;
                targetCollection = "vendas";
                empresaRef = loc.empresaRef;
            }
        }

        // 2. Tenta buscar na coleção 'notas_devolucao'
        if (!targetDoc) {
            if (vendaId) {
                const devSnap = await empresaRef.collection("notas_devolucao").doc(String(vendaId)).get();
                if (devSnap.exists) {
                    targetDoc = devSnap.data();
                    targetRef = devSnap.ref;
                    targetCollection = "notas_devolucao";
                }
            }
            if (!targetDoc && chaveParam) {
                const limpaChave = String(chaveParam).replace(/\D/g, '');
                const qSnap = await empresaRef.collection("notas_devolucao").where("chave_nfe", "==", limpaChave).limit(1).get();
                if (!qSnap.empty) {
                    targetDoc = qSnap.docs[0].data();
                    targetRef = qSnap.docs[0].ref;
                    targetCollection = "notas_devolucao";
                }
            }
            if (!targetDoc && numeroParam) {
                const qSnap = await empresaRef.collection("notas_devolucao").where("numero", "==", String(numeroParam).trim()).limit(1).get();
                if (!qSnap.empty) {
                    targetDoc = qSnap.docs[0].data();
                    targetRef = qSnap.docs[0].ref;
                    targetCollection = "notas_devolucao";
                }
            }
        }

        // 3. Tenta buscar na coleção 'notas_avulsas'
        if (!targetDoc) {
            if (vendaId) {
                const avSnap = await empresaRef.collection("notas_avulsas").doc(String(vendaId)).get();
                if (avSnap.exists) {
                    targetDoc = avSnap.data();
                    targetRef = avSnap.ref;
                    targetCollection = "notas_avulsas";
                }
            }
            if (!targetDoc && chaveParam) {
                const limpaChave = String(chaveParam).replace(/\D/g, '');
                const qSnap = await empresaRef.collection("notas_avulsas").where("chave_nfe", "==", limpaChave).limit(1).get();
                if (!qSnap.empty) {
                    targetDoc = qSnap.docs[0].data();
                    targetRef = qSnap.docs[0].ref;
                    targetCollection = "notas_avulsas";
                }
            }
        }

        // 4. Tenta buscar na coleção 'notas_servico' (NFS-e de competência municipal)
        if (!targetDoc) {
            if (vendaId) {
                const nsSnap = await empresaRef.collection("notas_servico").doc(String(vendaId)).get();
                if (nsSnap.exists) {
                    targetDoc = nsSnap.data();
                    targetRef = nsSnap.ref;
                    targetCollection = "notas_servico";
                }
            }
            if (!targetDoc && chaveParam) {
                const qSnap = await empresaRef.collection("notas_servico").where("codigo_verificacao", "==", String(chaveParam).trim()).limit(1).get();
                if (!qSnap.empty) {
                    targetDoc = qSnap.docs[0].data();
                    targetRef = qSnap.docs[0].ref;
                    targetCollection = "notas_servico";
                }
            }
            if (!targetDoc && numeroParam) {
                const qSnap = await empresaRef.collection("notas_servico").where("numero", "==", String(numeroParam).trim()).limit(1).get();
                if (!qSnap.empty) {
                    targetDoc = qSnap.docs[0].data();
                    targetRef = qSnap.docs[0].ref;
                    targetCollection = "notas_servico";
                }
            }
        }

        if (!targetDoc) {
            throw new functions.https.HttpsError("not-found", "Registro da nota fiscal não encontrado no sistema.");
        }

        // Cancelamento específico para NFS-e (Competência Municipal / Padrão ABRASF - sem SEFAZ)
        if (targetCollection === "notas_servico" || tipoNormalizado === "nfse" || targetDoc.tipo === "NFS-e") {
            const dadosCancelamento = {
                status: "cancelado",
                status_sefaz: "cancelado",
                status_fiscal: "cancelado",
                justificativa_cancelamento: justificativa.trim(),
                data_cancelamento: new Date().toISOString(),
                canceladoPor: context.auth.uid,
                mensagem_cancelamento: "NFS-e cancelada com sucesso no sistema"
            };

            if (targetRef) {
                await targetRef.set(dadosCancelamento, { merge: true });
            }

            const refVendaId = targetDoc.vendaId || (targetCollection === "vendas" ? vendaId : null);
            if (refVendaId) {
                await empresaRef.collection("vendas").doc(String(refVendaId)).set({
                    status_fiscal_nfse: "cancelado",
                    "nfse.status": "cancelado",
                    "nfse.status_sefaz": "cancelado",
                    "nfse.justificativa_cancelamento": justificativa.trim(),
                    "nfse.data_cancelamento": dadosCancelamento.data_cancelamento
                }, { merge: true });
            }

            if (targetCollection === "vendas" && targetDoc.nfse?.codigo_verificacao) {
                const qSnap = await empresaRef.collection("notas_servico").where("codigo_verificacao", "==", targetDoc.nfse.codigo_verificacao).limit(1).get();
                if (!qSnap.empty) {
                    await qSnap.docs[0].ref.set(dadosCancelamento, { merge: true });
                }
            }

            console.log(`[NFS-e] Nota Nº ${targetDoc.numero || targetDoc.nfse?.numero || numeroParam || ''} cancelada com sucesso! Justificativa: ${justificativa}`);

            return {
                success: true,
                message: `NFS-e Nº ${targetDoc.numero || targetDoc.nfse?.numero || numeroParam || ''} cancelada com sucesso!`,
                data: dadosCancelamento
            };
        }

        const configSnap = await empresaRef.collection("configuracoes").doc("config").get();
        const empresa = configSnap.data()?.empresa || {};

        if (!empresa.certificadoBase64) {
            throw new functions.https.HttpsError("failed-precondition", "Certificado Digital A1 (.pfx) não configurado para realizar o cancelamento na SEFAZ. Acesse Configurações > Emissor Fiscal.");
        }

        // 1. Sanitização da Chave de Acesso (44 dígitos numéricos, sem prefixo 'NFe')
        let rawChave = chaveParam || targetDoc.chave_nfe || targetDoc.chave || "";
        if (!rawChave && targetCollection === "vendas") {
            rawChave = (tipoNormalizado === "nfe" ? (targetDoc.nfe?.chave_nfe || targetDoc.nfe?.chave) : (targetDoc.nfce?.chave_nfe || targetDoc.nfce?.chave)) 
                || targetDoc.fiscal_chave 
                || "";
        }
        const chave = String(rawChave).replace(/^NFe/i, '').replace(/\D/g, '').trim();

        // 2. Extração e validação do Protocolo de Autorização (<nProt>)
        let protocolo = String(
            targetDoc.protocolo 
            || (tipoNormalizado === "nfe" ? targetDoc.nfe?.protocolo : targetDoc.nfce?.protocolo) 
            || targetDoc.fiscal_protocolo 
            || ""
        ).replace(/\D/g, '').trim();

        // Se o protocolo estiver ausente ou não numérico, extrai do XML gravado
        if (!protocolo || protocolo.length < 15) {
            const xml = targetDoc.xml_conteudo 
                || targetDoc.fiscal_xml 
                || (tipoNormalizado === "nfe" ? (targetDoc.nfe?.xml_conteudo || targetDoc.nfe?.xml) : (targetDoc.nfce?.xml_conteudo || targetDoc.nfce?.xml)) 
                || targetDoc.xml 
                || "";
            if (xml) {
                const matchProt = xml.match(/<nProt>(\d{15})<\/nProt>/i) || xml.match(/<nProt>(\d+)<\/nProt>/i);
                if (matchProt && matchProt[1]) {
                    protocolo = matchProt[1].trim();
                    console.log(`[CANCELAMENTO] Protocolo recuperado com sucesso do XML: ${protocolo}`);
                }
            }
        }

        if (!chave || chave.length !== 44) {
            throw new functions.https.HttpsError("invalid-argument", `Chave de acesso inválida (${chave ? chave.length : 0} dígitos). O cancelamento exige 44 dígitos numéricos.`);
        }
        if (!protocolo || !/^\d+$/.test(protocolo)) {
            throw new functions.https.HttpsError("failed-precondition", "Protocolo de autorização da nota fiscal não encontrado. A SEFAZ exige o número do protocolo de autorização (<nProt>) para homologar o cancelamento.");
        }

        const modeloNota = targetDoc.modelo || (chave.substring(20, 22) === '65' ? '65' : '55');

        console.log(`Cancelando ${modeloNota === '65' ? 'NFC-e' : 'NF-e'} via SEFAZ Direto (chave: ${chave}, protocolo: ${protocolo})...`);
        const resCanc = await cancelarNotaDiretoSefaz(chave, protocolo, justificativa.trim(), empresa, modeloNota);
        if (resCanc.sucesso) {
            const dadosCancelamento = {
                status_sefaz: "cancelado",
                status_fiscal: "cancelado",
                justificativa_cancelamento: justificativa.trim(),
                data_cancelamento: new Date().toISOString(),
                mensagem_cancelamento: resCanc.xMotivo || "Nota cancelada com sucesso na SEFAZ",
                protocolo_cancelamento: resCanc.nProt || ""
            };

            if (targetCollection === "vendas") {
                const updatePayload = {
                    status_fiscal: "cancelado"
                };
                if (modeloNota === "55") {
                    updatePayload.nfe = { ...(targetDoc.nfe || {}), ...dadosCancelamento };
                } else {
                    updatePayload.nfce = { ...(targetDoc.nfce || {}), ...dadosCancelamento };
                }
                await targetRef.set(updatePayload, { merge: true });
            } else if (targetCollection === "notas_devolucao") {
                await targetRef.set({
                    ...dadosCancelamento,
                    status_sefaz: "cancelado"
                }, { merge: true });

                if (targetDoc.compraId) {
                    await empresaRef.collection("compras").doc(String(targetDoc.compraId)).set({
                        nfe_devolucao: { status_sefaz: "cancelado" }
                    }, { merge: true });
                }
                if (targetDoc.vendaId) {
                    await empresaRef.collection("vendas").doc(String(targetDoc.vendaId)).set({
                        nfe_devolucao: { status_sefaz: "cancelado" }
                    }, { merge: true });
                }
            } else if (targetCollection === "notas_avulsas") {
                await targetRef.set(dadosCancelamento, { merge: true });
            }

            return {
                success: true,
                message: "Nota Fiscal cancelada com sucesso diretamente na SEFAZ!",
                data: dadosCancelamento
            };
        } else {
            const cStatStr = String(resCanc.cStat || '');
            const xMotivoStr = String(resCanc.xMotivo || '');
            const isPrazoExpirado = cStatStr === '501' || xMotivoStr.toLowerCase().includes('prazo de cancelamento superior');

            if (isPrazoExpirado) {
                throw new functions.https.HttpsError(
                    "failed-precondition", 
                    `Rejeição SEFAZ (501): O prazo regulamentar para cancelamento direto na SEFAZ expirou (30 minutos para NFC-e / 24 horas para NF-e). Para cancelar esta venda com vínculo oficial perante a SEFAZ, emita uma NF-e de Devolução / Estorno de Venda.`
                );
            }

            throw new functions.https.HttpsError(
                "failed-precondition", 
                `Rejeição SEFAZ no cancelamento (${resCanc.cStat}): ${resCanc.xMotivo}`
            );
        }

    } catch (error) {
        console.error("Erro ao cancelar nota:", error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError("internal", error.message);
    }
});

// ==========================================
// REVERTER CANCELAMENTO INTERNO (Restaurar para Autorizada)
// Desfaz marcação de cancelamento interno para permitir estorno oficial na SEFAZ via Devolução
// ==========================================
exports.reverterCancelamentoInterno = functions.runWith({ serviceAccount: 'lojafc-a31f9@appspot.gserviceaccount.com' }).https.onCall(async (data, context) => {
    const empId = (data && data.empId) ? data.empId : 'emp_fc_moveis';
    const empresaRef = db.collection('empresas').doc(empId);
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado.');
    const { vendaId, tipo } = data;
    if (!vendaId) throw new functions.https.HttpsError('invalid-argument', 'vendaId não informado.');

    try {
        const funcSnap = await empresaRef.collection('funcionarios').doc(context.auth.uid).get();
        const hasPerm = funcSnap.exists && (funcSnap.data().isAdmin || funcSnap.data().perm_gestao);
        if (!hasPerm) throw new functions.https.HttpsError('permission-denied', 'Sem permissão para alterar notas fiscais.');

        const loc = await localizarVendaEConfig(vendaId, empId);
        const vendaSnap = loc.vendaSnap;
        const vendaRef = loc.vendaRef;
        if (!vendaSnap.exists) throw new functions.https.HttpsError('not-found', 'Venda não encontrada.');
        const v = vendaSnap.data();

        const tipoNorm = (tipo || 'nfce').toLowerCase().replace('-', '');
        const updatePayload = {
            status_fiscal: 'autorizado'
        };
        if (tipoNorm === 'nfe') {
            updatePayload.nfe = {
                ...(v.nfe || {}),
                status_sefaz: 'autorizado',
                justificativa_cancelamento: admin.firestore.FieldValue.delete(),
                data_cancelamento: admin.firestore.FieldValue.delete(),
                mensagem_cancelamento: admin.firestore.FieldValue.delete(),
                protocolo_cancelamento: admin.firestore.FieldValue.delete()
            };
        } else {
            updatePayload.nfce = {
                ...(v.nfce || {}),
                status_sefaz: 'autorizado',
                justificativa_cancelamento: admin.firestore.FieldValue.delete(),
                data_cancelamento: admin.firestore.FieldValue.delete(),
                mensagem_cancelamento: admin.firestore.FieldValue.delete(),
                protocolo_cancelamento: admin.firestore.FieldValue.delete()
            };
        }

        await vendaRef.set(updatePayload, { merge: true });
        return { success: true, message: 'Status da nota restaurado para Autorizada na SEFAZ com sucesso!' };
    } catch (error) {
        console.error('Erro ao reverter cancelamento interno:', error);
        if (error instanceof functions.https.HttpsError) throw error;
        throw new functions.https.HttpsError('internal', error.message);
    }
});

// ==========================================
// 4. CONSULTA DE STATUS NA SEFAZ (POLLING / REFRESH)
// ==========================================
exports.consultarStatusNota = functions.runWith({ serviceAccount: 'lojafc-a31f9@appspot.gserviceaccount.com' }).https.onCall(async (data, context) => {
    const empId = (data && data.empId) ? data.empId : 'emp_fc_moveis';
    const empresaRef = db.collection('empresas').doc(empId);
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Usuário não autenticado.");

    try {
        const { vendaId, tipo } = data;
        if (!vendaId) throw new functions.https.HttpsError("invalid-argument", "vendaId não informado.");

        const tipoNormalizado = (tipo && String(tipo).toLowerCase().includes("nfe") && !String(tipo).toLowerCase().includes("nfce")) ? "nfe" : "nfce";

        const loc = await localizarVendaEConfig(vendaId, empId);
        const vendaSnap = loc.vendaSnap;
        if (!vendaSnap.exists) throw new functions.https.HttpsError("not-found", "Venda não encontrada.");
        const venda = vendaSnap.data();

        const docFiscal = tipoNormalizado === 'nfe' ? (venda.nfe || {}) : (venda.nfce || {});
        return {
            success: true,
            data: {
                status_sefaz: docFiscal.status_sefaz || venda.status_fiscal || "autorizado",
                mensagem_sefaz: docFiscal.mensagem_sefaz || "",
                chave_nfe: docFiscal.chave_nfe || venda.fiscal_chave || "",
                numero: docFiscal.numero || "",
                protocolo: docFiscal.protocolo || ""
            }
        };

    } catch (error) {
        console.error("Erro ao consultar status da nota:", error);
        if (error instanceof functions.https.HttpsError) throw error;
        throw new functions.https.HttpsError("internal", error.message);
    }
});

// ==========================================
// 5. CARTA DE CORREÇÃO ELETRÔNICA (CC-e PARA NF-e)
// ==========================================
exports.cartaCorrecaoNFe = functions.runWith({ serviceAccount: 'lojafc-a31f9@appspot.gserviceaccount.com' }).https.onCall(async (data, context) => {
    const empId = (data && data.empId) ? data.empId : 'emp_fc_moveis';
    const empresaRef = db.collection('empresas').doc(empId);
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Usuário não autenticado.");

    const funcSnap = await empresaRef.collection("funcionarios").doc(context.auth.uid).get();
    const hasPerm = funcSnap.exists && (funcSnap.data().isAdmin || funcSnap.data().perm_gestao);
    if (!hasPerm) throw new functions.https.HttpsError("permission-denied", "Sem permissão para emitir Carta de Correção.");

    try {
        const { vendaId, correcao } = data;
        if (!vendaId) throw new functions.https.HttpsError("invalid-argument", "vendaId não informado.");
        if (!correcao || correcao.trim().length < 15) {
            throw new functions.https.HttpsError("invalid-argument", "A correção deve ter pelo menos 15 caracteres (exigência da SEFAZ).");
        }

        const loc = await localizarVendaEConfig(vendaId, empId);
        const vendaSnap = loc.vendaSnap;
        if (!vendaSnap.exists) throw new functions.https.HttpsError("not-found", "Venda não encontrada.");
        const venda = vendaSnap.data();

        const configSnap = await empresaRef.collection("configuracoes").doc("config").get();
        const empresa = configSnap.data()?.empresa || {};

        if (!empresa.certificadoBase64) {
            throw new functions.https.HttpsError("failed-precondition", "Certificado Digital A1 (.pfx) não configurado. Acesse Configurações > Emissor Fiscal.");
        }

        const chave = String(venda.nfe?.chave_nfe || venda.fiscal_chave || "").replace(/^NFe/i, '').replace(/\D/g, '').trim();
        if (!chave || chave.length !== 44) {
            throw new functions.https.HttpsError("failed-precondition", "Chave de acesso da NF-e não encontrada ou inválida para emissão de CC-e.");
        }

        console.log(`Transmitindo Carta de Correção via SEFAZ Direto para a venda ${vendaId}...`);
        const resCCe = await cartaCorrecaoDiretoSefaz(chave, correcao.trim(), empresa);

        if (resCCe.sucesso) {
            const dadosCCe = {
                status: "autorizado",
                mensagem: resCCe.xMotivo || "Carta de Correção homologada com sucesso na SEFAZ",
                protocolo: resCCe.nProt || "",
                correcao: correcao.trim(),
                data: new Date().toISOString()
            };

            await vendaRef.set({
                nfe: {
                    ...(venda.nfe || {}),
                    cce: dadosCCe
                }
            }, { merge: true });

            return {
                success: true,
                message: "Carta de Correção transmitida à SEFAZ com sucesso!",
                data: dadosCCe
            };
        } else {
            throw new functions.https.HttpsError("failed-precondition", `Rejeição SEFAZ na Carta de Correção (${resCCe.cStat}): ${resCCe.xMotivo}`);
        }

    } catch (error) {
        console.error("Erro ao emitir Carta de Correção:", error);
        if (error instanceof functions.https.HttpsError) throw error;
        throw new functions.https.HttpsError("internal", error.message);
    }
});

// ==========================================
// 7. NF-e DE DEVOLUÇÃO DE VENDA (Estorno ao Cliente)
// Emitida quando o cliente devolve mercadoria — NF entrada (tpNF=0), finNFe=4
// ==========================================
exports.emitirDevolucaoVenda = functions.runWith({ serviceAccount: 'lojafc-a31f9@appspot.gserviceaccount.com' }).https.onCall(async (data, context) => {
    const empId = (data && data.empId) ? data.empId : 'emp_fc_moveis';
    const empresaRef = db.collection('empresas').doc(empId);
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado.');

    const funcSnap = await empresaRef.collection('funcionarios').doc(context.auth.uid).get();
    const hasPerm = funcSnap.exists && (funcSnap.data().isAdmin || funcSnap.data().perm_gestao);
    if (!hasPerm) throw new functions.https.HttpsError('permission-denied', 'Sem permissão para emitir devoluções.');

    try {
        const { vendaId, chaveOriginal, itensParaDevolucao, observacoes } = data;
        if (!vendaId) throw new functions.https.HttpsError('invalid-argument', 'vendaId não informado.');

        // Buscar venda e configurações
        const loc = await localizarVendaEConfig(vendaId, empId);
        const vendaSnap = loc.vendaSnap;
        empresaRef = loc.empresaRef;
        const vendaRef = loc.vendaRef;
        if (!vendaSnap.exists) throw new functions.https.HttpsError('not-found', 'Venda não encontrada.');
        const venda = vendaSnap.data();

        const config = await obterConfigEmpresaComFallback(empresaRef);
        const empresa = config.empresa;
        if (!empresa?.certificadoBase64) throw new functions.https.HttpsError('failed-precondition', 'Certificado A1 não configurado.');
        if (!empresa.ambienteFiscal) empresa.ambienteFiscal = 'producao';

        // Buscar cliente
        let clienteData = null;
        if (venda.clienteId && venda.clienteId !== '0') {
            const cliSnap = await empresaRef.collection('clientes').doc(String(venda.clienteId)).get();
            if (cliSnap.exists) clienteData = cliSnap.data();
        }

        // Fallback: se cliente veio direto na venda (muito comum em NFC-e)
        if (!clienteData && (venda.clienteDoc || venda.clienteCpf || venda.clienteNome)) {
            const docLimpo = String(venda.clienteDoc || venda.clienteCpf || '').replace(/\D/g, '');
            clienteData = {
                nome: venda.clienteNome || 'CONSUMIDOR FINAL',
                cpf: docLimpo.length === 11 ? docLimpo : '',
                cnpj: docLimpo.length === 14 ? docLimpo : '',
                doc: docLimpo,
                rua: venda.clienteRua || empresa.rua || 'RUA',
                numero: venda.clienteNumero || empresa.numero || 'S/N',
                bairro: venda.clienteBairro || empresa.bairro || 'CENTRO',
                cidade: venda.clienteCidade || empresa.cidade || 'GOIANIA',
                uf: venda.clienteUf || empresa.uf || 'GO',
                cep: String(venda.clienteCep || empresa.cep || '').replace(/\D/g, '')
            };
        }

        // Se mesmo assim não houver documento de cliente (consumidor não identificado em NFC-e),
        // a NF-e de entrada de devolução de cupom fiscal é emitida para o próprio estabelecimento (auto-entrada)
        if (!clienteData || (!clienteData.cpf && !clienteData.cnpj && !clienteData.doc)) {
            clienteData = {
                nome: empresa.razaoSocial || empresa.nome || 'ENTRADA DE DEVOLUCAO DE CUPOM FISCAL',
                cnpj: String(empresa.cnpj || '').replace(/\D/g, ''),
                doc: String(empresa.cnpj || '').replace(/\D/g, ''),
                rua: empresa.rua || 'RUA',
                numero: empresa.numero || 'S/N',
                bairro: empresa.bairro || 'CENTRO',
                cidade: empresa.cidade || 'GOIANIA',
                uf: empresa.uf || 'GO',
                cep: String(empresa.cep || '').replace(/\D/g, ''),
                ie: String(empresa.ie || '').replace(/\D/g, '')
            };
        }

        // Chave da nota original referenciada (NF-e ou NFC-e)
        const chaveRef = String(chaveOriginal || venda.nfe?.chave_nfe || venda.nfce?.chave_nfe || venda.fiscal_chave || '').replace(/\D/g, '');
        if (!chaveRef || chaveRef.length !== 44) {
            throw new functions.https.HttpsError('invalid-argument', 'Chave de acesso da nota original não encontrada ou inválida para referenciar a devolução.');
        }

        // Usar itens fornecidos ou todos os itens da venda original
        const produtosVenda = venda.itens || venda.produtos || [];
        let itensDevolvidos = itensParaDevolucao && itensParaDevolucao.length > 0
            ? itensParaDevolucao
            : produtosVenda;

        // Validar e ajustar itens
        if (itensDevolvidos.length === 0) throw new functions.https.HttpsError('invalid-argument', 'Nenhum item para devolução.');

        // Determinar CFOP de devolução: 1411 (dentro do estado) ou 2411 (fora)
        const ufEmpresa = (empresa.uf || 'GO').toUpperCase();
        const ufCliente = (clienteData?.uf || ufEmpresa).toUpperCase();
        const cfopDevolucao = ufCliente === ufEmpresa ? '1411' : '2411';

        // Ajustar CFOPs para devolução
        const itensDevolucao = itensDevolvidos.map(item => ({
            ...item,
            cfop: cfopDevolucao,
            csosn: item.csosn || '102'
        }));

        // Monta venda fictícia para o motor (a NF de devolução não tem pagamento)
        const vendaDevolucao = {
            ...venda,
            desconto: 0,
            pagamentos: [{ metodo: 'SEM PAGAMENTO', valor: 0 }],
            observacoes: observacoes || `Devolucao referente a nota chave ${chaveRef}`.trim()
        };

        console.log(`[DEVOLUÇÃO VENDA] Emitindo NF-e de entrada finNFe=4 para venda ${vendaId}, referenciando chave ${chaveRef}`);
        const resultadoSefaz = await emitirNotaDiretoSefaz('55', vendaDevolucao, empresa, itensDevolucao, clienteData, {
            tpNF: '0',              // Entrada
            finNFe: '4',            // Devolução
            nfRef: chaveRef,
            naturezaOperacao: 'DEVOLUCAO DE VENDA'
        });

        const dadosRetorno = {
            tipo: 'NF-e Devolução de Venda',
            modelo: '55',
            status_sefaz: resultadoSefaz.sucesso ? 'autorizado' : 'erro_autorizacao',
            mensagem_sefaz: resultadoSefaz.mensagemSefaz || '',
            chave_nfe: resultadoSefaz.chave || '',
            numero: resultadoSefaz.numero || '',
            serie: resultadoSefaz.serie || empresa.serieNFe || '1',
            protocolo: resultadoSefaz.protocolo || '',
            data_emissao: resultadoSefaz.dataAutorizacao || new Date().toISOString(),
            xml_conteudo: resultadoSefaz.xml || '',
            chave_original: chaveRef,
            motor: 'sefaz_direto'
        };

        if (!resultadoSefaz.sucesso) {
            throw new functions.https.HttpsError('failed-precondition', resultadoSefaz.mensagemSefaz || 'Rejeição SEFAZ na devolução.');
        }

        // Salvar devolução vinculada à venda original SOMENTE SE SUCESSO NA SEFAZ
        const updateVenda = {
            nfe_devolucao: dadosRetorno,
            status_fiscal: 'devolvido'
        };
        if (venda.nfce) {
            updateVenda.nfce = {
                ...venda.nfce,
                status_sefaz: 'autorizado',
                estornada_por_devolucao: resultadoSefaz.chave || true
            };
        }
        if (venda.nfe) {
            updateVenda.nfe = {
                ...venda.nfe,
                status_sefaz: 'autorizado',
                estornada_por_devolucao: resultadoSefaz.chave || true
            };
        }
        await vendaRef.set(updateVenda, { merge: true });

        // Salvar também na coleção de devoluções para consulta no painel fiscal
        const docId = `dev_venda_${vendaId}_${Date.now()}`;
        await empresaRef.collection('notas_devolucao').doc(docId).set({
            ...dadosRetorno,
            vendaId: String(vendaId),
            tipo_devolucao: 'venda',
            criadoEm: new Date().toISOString()
        });

        if (resultadoSefaz.numero) {
            const proxNum = parseInt(resultadoSefaz.numero, 10) + 1;
            await empresaRef.collection('configuracoes').doc('config').set({ empresa: { proximoNumeroNFe: proxNum } }, { merge: true });
        }

        return { success: true, message: 'NF-e de Devolução de Venda autorizada!', data: dadosRetorno };

    } catch (error) {
        console.error('Erro ao emitir devolução de venda:', error);
        if (error instanceof functions.https.HttpsError) throw error;
        throw new functions.https.HttpsError('internal', error.message);
    }
});

// ==========================================
// 8. NF-e DE DEVOLUÇÃO DE COMPRA (Empresa devolve ao Fornecedor)
// NF saída (tpNF=1), finNFe=4, destinatário = fornecedor
// ==========================================
exports.emitirDevolucaoCompra = functions.runWith({ serviceAccount: 'lojafc-a31f9@appspot.gserviceaccount.com' }).https.onCall(async (data, context) => {
    const empId = (data && data.empId) ? data.empId : 'emp_fc_moveis';
    const empresaRef = db.collection('empresas').doc(empId);
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado.');

    const funcSnap = await empresaRef.collection('funcionarios').doc(context.auth.uid).get();
    const hasPerm = funcSnap.exists && (funcSnap.data().isAdmin || funcSnap.data().perm_gestao);
    if (!hasPerm) throw new functions.https.HttpsError('permission-denied', 'Sem permissão para emitir devoluções.');

    try {
        const { compraId, fornecedorId, chaveOriginal, itensParaDevolucao, observacoes, destinatarioDados } = data;

        const configSnap = await empresaRef.collection('configuracoes').doc('config').get();
        const empresa = configSnap.data()?.empresa;
        if (!empresa?.certificadoBase64) throw new functions.https.HttpsError('failed-precondition', 'Certificado A1 não configurado.');
        empresa.ambienteFiscal = 'producao';

        // Buscar dados do fornecedor (destinatário neste caso)
        let fornecedorData = destinatarioDados || null;
        const fId = fornecedorId || (compraId ? (await empresaRef.collection('compras').doc(String(compraId)).get()).data()?.fornecedorId : null);
        if (!fornecedorData && fId) {
            const fSnap = await empresaRef.collection('fornecedores').doc(String(fId)).get();
            if (fSnap.exists) fornecedorData = fSnap.data();
        }
        if (!fornecedorData) throw new functions.https.HttpsError('failed-precondition', 'Dados do fornecedor/indústria não encontrados. Informe o fornecedor ou preencha os dados.');

        // Buscar itens da compra original se não fornecidos
        let itens = itensParaDevolucao || [];
        if (itens.length === 0 && compraId) {
            const compraSnap = await empresaRef.collection('compras').doc(String(compraId)).get();
            if (compraSnap.exists) itens = compraSnap.data().itens || compraSnap.data().produtos || [];
        }
        if (itens.length === 0) throw new functions.https.HttpsError('invalid-argument', 'Nenhum item para devolução.');

        // Determinar CFOP de devolução ao fornecedor: 5411 (mesmo estado) ou 6411 (outro estado)
        const ufEmpresa = (empresa.uf || 'GO').toUpperCase();
        const ufFornecedor = (fornecedorData.uf || ufEmpresa).toUpperCase();
        const cfopDevolucao = ufFornecedor === ufEmpresa ? '5411' : '6411';

        const itensDevolvidos = itens.map(item => ({
            ...item,
            cfop: cfopDevolucao,
            csosn: item.csosn || '102'
        }));

        const totalDevolucao = itensDevolvidos.reduce((acc, it) => {
            const qty = parseFloat(it.quantidade || it.qtd || 1);
            const preco = parseFloat(it.preco || it.precoUnitario || 0);
            return acc + qty * preco;
        }, 0);

        const vendaDevolucao = {
            tot: totalDevolucao,
            desconto: 0,
            pagamentos: [{ metodo: 'SEM PAGAMENTO', valor: 0 }],
            observacoes: observacoes || `Devolucao de compra ref. ${chaveOriginal || compraId || ''}`.trim()
        };

        console.log(`[DEVOLUÇÃO COMPRA] Emitindo NF-e saída finNFe=4 fornecedor ${fId}`);
        const resultadoSefaz = await emitirNotaDiretoSefaz('55', vendaDevolucao, empresa, itensDevolvidos, fornecedorData, {
            tpNF: '1',
            finNFe: '4',
            nfRef: chaveOriginal || null,
            naturezaOperacao: 'DEVOLUCAO DE COMPRA'
        });

        const dadosRetorno = {
            tipo: 'NF-e Devolução de Compra',
            modelo: '55',
            status_sefaz: resultadoSefaz.sucesso ? 'autorizado' : 'erro_autorizacao',
            mensagem_sefaz: resultadoSefaz.mensagemSefaz || '',
            chave_nfe: resultadoSefaz.chave || '',
            numero: resultadoSefaz.numero || '',
            serie: resultadoSefaz.serie || empresa.serieNFe || '1',
            protocolo: resultadoSefaz.protocolo || '',
            data_emissao: resultadoSefaz.dataAutorizacao || new Date().toISOString(),
            xml_conteudo: resultadoSefaz.xml || '',
            chave_original: chaveOriginal || '',
            fornecedorId: fId || '',
            compraId: compraId || '',
            motor: 'sefaz_direto'
        };

        if (!resultadoSefaz.sucesso) {
            throw new functions.https.HttpsError('failed-precondition', resultadoSefaz.mensagemSefaz || 'Rejeição SEFAZ na devolução de compra.');
        }

        if (compraId) {
            await empresaRef.collection('compras').doc(String(compraId)).set({ nfe_devolucao: dadosRetorno }, { merge: true });
        }

        const docId = `dev_compra_${compraId || Date.now()}_${Date.now()}`;
        await empresaRef.collection('notas_devolucao').doc(docId).set({
            ...dadosRetorno,
            compraId: String(compraId || ''),
            tipo_devolucao: 'compra',
            criadoEm: new Date().toISOString()
        });

        if (resultadoSefaz.numero) {
            const proxNum = parseInt(resultadoSefaz.numero, 10) + 1;
            await empresaRef.collection('configuracoes').doc('config').set({ empresa: { proximoNumeroNFe: proxNum } }, { merge: true });
        }

        return { success: true, message: 'NF-e de Devolução de Compra autorizada!', data: dadosRetorno };

    } catch (error) {
        console.error('Erro ao emitir devolução de compra:', error);
        if (error instanceof functions.https.HttpsError) throw error;
        throw new functions.https.HttpsError('internal', error.message);
    }
});

// ==========================================
// LIMPEZA DE TENTATIVAS DE DEVOLUÇÃO REJEITADAS
// ==========================================
exports.limparDevolucoesRejeitadas = functions.runWith({ serviceAccount: 'lojafc-a31f9@appspot.gserviceaccount.com' }).https.onCall(async (data, context) => {
    const empId = (data && data.empId) ? data.empId : 'emp_fc_moveis';
    const empresaRef = db.collection('empresas').doc(empId);
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado.');

    try {
        let removidas = 0;
        let vendasCorrigidas = 0;

        // 1. Limpar coleção notas_devolucao onde status_sefaz !== 'autorizado'
        const devsSnap = await empresaRef.collection('notas_devolucao').get();
        for (const doc of devsSnap.docs) {
            const d = doc.data();
            if (d.status_sefaz !== 'autorizado') {
                await doc.ref.delete();
                removidas++;
            }
        }

        // 2. Limpar campo nfe_devolucao nas vendas onde não houve autorização
        const vendasSnap = await empresaRef.collection('vendas').get();
        for (const doc of vendasSnap.docs) {
            const v = doc.data();
            if (v.nfe_devolucao && v.nfe_devolucao.status_sefaz !== 'autorizado') {
                const patch = {
                    nfe_devolucao: admin.firestore.FieldValue.delete()
                };
                if (v.status_fiscal === 'devolvido') {
                    patch.status_fiscal = v.nfce?.status_sefaz || v.nfe?.status_sefaz || 'autorizado';
                }
                if (v.nfce && v.nfce.estornada_por_devolucao) {
                    patch['nfce.estornada_por_devolucao'] = admin.firestore.FieldValue.delete();
                }
                if (v.nfe && v.nfe.estornada_por_devolucao) {
                    patch['nfe.estornada_por_devolucao'] = admin.firestore.FieldValue.delete();
                }
                await doc.ref.update(patch);
                vendasCorrigidas++;
            }
        }

        return {
            success: true,
            message: `Limpeza concluída: ${removidas} tentativa(s) de devolução rejeitada(s) removida(s), ${vendasCorrigidas} venda(s) restaurada(s).`,
            removidas,
            vendasCorrigidas
        };
    } catch (error) {
        console.error('Erro na limpeza de devoluções rejeitadas:', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

// ==========================================
// 9. NOTA AVULSA (NF-e ou NFC-e sem venda cadastrada no sistema)
// ==========================================
exports.emitirNotaAvulsa = functions.runWith({ serviceAccount: 'lojafc-a31f9@appspot.gserviceaccount.com' }).https.onCall(async (data, context) => {
    const empId = (data && data.empId) ? data.empId : 'emp_fc_moveis';
    const empresaRef = db.collection('empresas').doc(empId);
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado.');

    const funcSnap = await empresaRef.collection('funcionarios').doc(context.auth.uid).get();
    const hasPerm = funcSnap.exists && (funcSnap.data().isAdmin || funcSnap.data().perm_pdv || funcSnap.data().perm_gestao);
    if (!hasPerm) throw new functions.https.HttpsError('permission-denied', 'Sem permissão para emitir notas avulsas.');

    try {
        const { tipo, destinatario, itens, pagamentos, observacoes, naturezaOperacao, contingencia } = data;

        if (!itens || itens.length === 0) throw new functions.https.HttpsError('invalid-argument', 'A nota avulsa precisa ter pelo menos 1 item.');

        const modelo = tipo === 'nfce' ? '65' : '55';

        // Para NF-e modelo 55 é obrigatório ter destinatário com CPF/CNPJ
        if (modelo === '55') {
            const docDest = String(destinatario?.cpf || destinatario?.cnpj || destinatario?.doc || '').replace(/\D/g, '');
            if (!docDest || (docDest.length !== 11 && docDest.length !== 14)) {
                throw new functions.https.HttpsError('invalid-argument', 'NF-e (Modelo 55) exige destinatário com CPF ou CNPJ válido.');
            }
        }

        const configSnap = await empresaRef.collection('configuracoes').doc('config').get();
        const empresa = configSnap.data()?.empresa;
        if (!empresa?.certificadoBase64) throw new functions.https.HttpsError('failed-precondition', 'Certificado A1 não configurado.');
        empresa.ambienteFiscal = 'producao';

        // Calcula total bruto, descontos dos itens e total líquido
        let totalBruto = 0;
        let totalDescontoItens = 0;

        const itensFormatados = itens.map(it => {
            const qty = parseFloat(it.quantidade !== undefined ? it.quantidade : (it.qtd !== undefined ? it.qtd : 1)) || 1;
            const preco = parseFloat(it.preco !== undefined ? it.preco : (it.precoUnitario !== undefined ? it.precoUnitario : 0)) || 0;
            const desc = parseFloat(it.desconto !== undefined ? it.desconto : (it.vDesc !== undefined ? it.vDesc : 0)) || 0;
            const sub = qty * preco;
            const descVal = Math.min(sub, Math.max(0, desc));
            totalBruto += sub;
            totalDescontoItens += descVal;
            return {
                ...it,
                quantidade: qty,
                preco,
                desconto: descVal,
                vDesc: descVal
            };
        });

        const totalDesconto = totalDescontoItens > 0 ? totalDescontoItens : Math.max(0, parseFloat(data.desconto || 0) || 0);
        const totalLiquido = Math.max(0, totalBruto - totalDesconto);

        // Se houver pagamentos informados, garante que o valor seja o líquido
        let pagamentosNota = pagamentos && pagamentos.length > 0
            ? pagamentos.map(p => ({ ...p, valor: parseFloat(p.valor) || 0 }))
            : [{ metodo: 'Dinheiro', valor: totalLiquido }];

        if (pagamentosNota.length === 1) {
            pagamentosNota[0].valor = totalLiquido;
        }

        const vendaAvulsa = {
            tot: totalLiquido,
            totalBruto,
            desconto: totalDesconto,
            pagamentos: pagamentosNota,
            pag: pagamentosNota.map(p => p.metodo).join(', ') || 'Dinheiro',
            formaPagamento: pagamentosNota[0]?.metodo || 'Dinheiro',
            observacoes: observacoes || '',
            clienteNome: destinatario?.nome || destinatario?.razaoSocial || 'CONSUMIDOR FINAL'
        };

        const clienteAvulso = destinatario ? {
            nome: destinatario.nome || destinatario.razaoSocial || 'CONSUMIDOR FINAL',
            cpf: destinatario.cpf || '',
            cnpj: destinatario.cnpj || '',
            doc: destinatario.doc || destinatario.cpf || destinatario.cnpj || '',
            rua: destinatario.rua || destinatario.logradouro || 'RUA',
            numero: destinatario.numero || 'S/N',
            bairro: destinatario.bairro || 'CENTRO',
            cidade: destinatario.cidade || empresa.cidade || 'GOIANIA',
            uf: destinatario.uf || empresa.uf || 'GO',
            cep: destinatario.cep || '',
            ie: destinatario.ie || '',
            ibge: destinatario.ibge || empresa.ibge || ''
        } : null;

        const isContingencia = Boolean(contingencia);

        console.log(`[NOTA AVULSA] Emitindo ${modelo === '65' ? 'NFC-e' : 'NF-e'} avulsa para ${vendaAvulsa.clienteNome}. Bruto: R$ ${totalBruto.toFixed(2)}, Desconto: R$ ${totalDesconto.toFixed(2)}, Líquido: R$ ${totalLiquido.toFixed(2)}`);
        const resultadoSefaz = await emitirNotaDiretoSefaz(modelo, vendaAvulsa, empresa, itensFormatados, clienteAvulso, {
            naturezaOperacao: naturezaOperacao || 'VENDA DE MERCADORIA',
            contingencia: isContingencia
        });

        const dadosRetorno = {
            tipo: modelo === '65' ? 'NFC-e Avulsa' : 'NF-e Avulsa',
            modelo,
            status_sefaz: resultadoSefaz.sucesso ? 'autorizado' : 'erro_autorizacao',
            mensagem_sefaz: resultadoSefaz.mensagemSefaz || '',
            chave_nfe: resultadoSefaz.chave || '',
            numero: resultadoSefaz.numero || '',
            serie: resultadoSefaz.serie || (modelo === '65' ? empresa.serieNFCe : empresa.serieNFe) || '1',
            protocolo: resultadoSefaz.protocolo || '',
            data_emissao: resultadoSefaz.dataAutorizacao || new Date().toISOString(),
            xml_conteudo: resultadoSefaz.xml || '',
            totalBruto,
            totalDesconto,
            totalLiquido,
            valor: totalLiquido,
            pagamentos: pagamentosNota,
            pag: pagamentosNota.map(p => p.metodo).join(', ') || 'Dinheiro',
            formaPagamento: pagamentosNota[0]?.metodo || 'Dinheiro',
            itens: itensFormatados,
            destinatario: destinatario || null,
            motor: 'sefaz_direto'
        };

        // Salvar nota avulsa na coleção própria (identificada pela chave)
        const docId = resultadoSefaz.chave || `avulsa_${Date.now()}`;
        await empresaRef.collection('notas_avulsas').doc(docId).set({
            ...dadosRetorno,
            criadoEm: new Date().toISOString(),
            emitidoPor: context.auth.uid
        });

        if (resultadoSefaz.sucesso && resultadoSefaz.numero) {
            const proxKey = modelo === '65' ? 'proximoNumeroNFCe' : 'proximoNumeroNFe';
            const proxNum = parseInt(resultadoSefaz.numero, 10) + 1;
            await empresaRef.collection('configuracoes').doc('config').set({ empresa: { [proxKey]: proxNum } }, { merge: true });
        }

        if (!resultadoSefaz.sucesso) {
            throw new functions.https.HttpsError('failed-precondition', resultadoSefaz.mensagemSefaz || 'Rejeição SEFAZ na nota avulsa.');
        }

        return { success: true, message: `${dadosRetorno.tipo} emitida com sucesso!`, data: dadosRetorno };

    } catch (error) {
        console.error('Erro ao emitir nota avulsa:', error);
        if (error instanceof functions.https.HttpsError) throw error;
        throw new functions.https.HttpsError('internal', error.message);
    }
});


// ==========================================
// 10. NFS-e (NOTA FISCAL DE SERVIÇOS ELETRÔNICA)
// Competência Municipal - Padrão Nacional / ABRASF 2.04
// ==========================================
exports.emitirNFSe = functions.runWith({ serviceAccount: 'lojafc-a31f9@appspot.gserviceaccount.com' }).https.onCall(async (data, context) => {
    const empId = (data && data.empId) ? data.empId : 'emp_fc_moveis';
    const empresaRef = db.collection('empresas').doc(empId);
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado.');

    const funcSnap = await empresaRef.collection('funcionarios').doc(context.auth.uid).get();
    const hasPerm = funcSnap.exists && (funcSnap.data().isAdmin || funcSnap.data().perm_pdv || funcSnap.data().perm_gestao);
    if (!hasPerm) throw new functions.https.HttpsError('permission-denied', 'Sem permissão para emitir NFS-e.');

    try {
        const { vendaId, tomador, servico, observacoes } = data;

        if (!servico || !servico.descricao) {
            throw new functions.https.HttpsError('invalid-argument', 'A descrição dos serviços prestados é obrigatória.');
        }

        const vServico = parseFloat(servico.valor || servico.valorServico || 0);
        if (vServico <= 0) {
            throw new functions.https.HttpsError('invalid-argument', 'O valor do serviço deve ser maior que zero.');
        }

        const configSnap = await empresaRef.collection('configuracoes').doc('config').get();
        const empresa = configSnap.data()?.empresa;
        if (!empresa) throw new functions.https.HttpsError('failed-precondition', 'Configurações da empresa não encontradas.');

        const docTomador = String(tomador?.doc || tomador?.cpf || tomador?.cnpj || '').replace(/\D/g, '');
        const nomeTomador = tomador?.nome || tomador?.razaoSocial || 'TOMADOR DO SERVIÇO';

        const numNFSe = parseInt(empresa.proximoNumeroNFSe || 1, 10);
        const serieNFSe = String(empresa.serieNFSe || '1');
        const dataEmissao = new Date().toISOString();

        // Código de verificação de autenticidade (8 caracteres alfanuméricos únicos)
        const hashBase = `${empresa.cnpj || 'emp'}_${numNFSe}_${Date.now()}`;
        const codigoVerificacao = crypto.createHash('sha256').update(hashBase).digest('hex').substring(0, 9).toUpperCase();

        // Alíquotas e Valores de ISS
        const aliqIss = parseFloat(servico.aliquotaIss || 2.0); // Padrão Simples Nacional
        const vIss = parseFloat(((vServico * aliqIss) / 100).toFixed(2));
        const itemLC116 = servico.itemListaServico || '14.01'; // Manutenção, restauração, conserto
        const codTributacaoMun = servico.codigoTributacao || itemLC116.replace(/\D/g, '');

        // Montagem do XML RPS / NFS-e no padrão ABRASF 2.04
        const xmlNFSe = `<?xml version="1.0" encoding="UTF-8"?>
<CompNfse xmlns="http://www.abrasf.org.br/nfse.xsd">
    <Nfse versao="2.04">
        <InfNfse Id="NFSE${numNFSe}">
            <Numero>${numNFSe}</Numero>
            <CodigoVerificacao>${codigoVerificacao}</CodigoVerificacao>
            <DataEmissao>${dataEmissao}</DataEmissao>
            <IdentificacaoRps>
                <Numero>${numNFSe}</Numero>
                <Serie>${serieNFSe}</Serie>
                <Tipo>1</Tipo>
            </IdentificacaoRps>
            <DataEmissaoRps>${dataEmissao.substring(0, 10)}</DataEmissaoRps>
            <NaturezaOperacao>1</NaturezaOperacao>
            <RegimeEspecialTributacao>6</RegimeEspecialTributacao>
            <OptanteSimplesNacional>1</OptanteSimplesNacional>
            <IncentivadorCultural>2</IncentivadorCultural>
            <Competencia>${dataEmissao.substring(0, 10)}</Competencia>
            <Servico>
                <Valores>
                    <ValorServicos>${vServico.toFixed(2)}</ValorServicos>
                    <ValorDeducoes>0.00</ValorDeducoes>
                    <ValorPis>0.00</ValorPis>
                    <ValorCofins>0.00</ValorCofins>
                    <ValorInss>0.00</ValorInss>
                    <ValorIr>0.00</ValorIr>
                    <ValorCsll>0.00</ValorCsll>
                    <OutrasRetencoes>0.00</OutrasRetencoes>
                    <ValorIss>${vIss.toFixed(2)}</ValorIss>
                    <Aliquota>${(aliqIss / 100).toFixed(4)}</Aliquota>
                    <DescontoIncondicionado>0.00</DescontoIncondicionado>
                    <DescontoCondicionado>0.00</DescontoCondicionado>
                </Valores>
                <IssRetido>${servico.issRetido ? '1' : '2'}</IssRetido>
                <ItemListaServico>${itemLC116}</ItemListaServico>
                <CodigoCnae>${empresa.cnae || '9524000'}</CodigoCnae>
                <CodigoTributacaoMunicipio>${codTributacaoMun}</CodigoTributacaoMunicipio>
                <Discriminacao>${(servico.descricao || '').replace(/[<>&'"]/g, ' ')}</Discriminacao>
                <CodigoMunicipio>${empresa.ibge || '5208707'}</CodigoMunicipio>
            </Servico>
            <PrestadorServico>
                <IdentificacaoPrestador>
                    <CpfCnpj><Cnpj>${String(empresa.cnpj || '').replace(/\D/g, '')}</Cnpj></CpfCnpj>
                    <InscricaoMunicipal>${String(empresa.im || 'ISENTO').replace(/\D/g, '') || 'ISENTO'}</InscricaoMunicipal>
                </IdentificacaoPrestador>
                <RazaoSocial>${empresa.razaoSocial || empresa.nome || 'PRESTADOR'}</RazaoSocial>
                <NomeFantasia>${empresa.fantasia || empresa.nome || ''}</NomeFantasia>
                <Endereco>
                    <Endereco>${empresa.rua || 'RUA'}</Endereco>
                    <Numero>${empresa.numero || 'S/N'}</Numero>
                    <Bairro>${empresa.bairro || 'CENTRO'}</Bairro>
                    <CodigoMunicipio>${empresa.ibge || '5208707'}</CodigoMunicipio>
                    <Uf>${empresa.uf || 'GO'}</Uf>
                    <Cep>${String(empresa.cep || '74000000').replace(/\D/g, '')}</Cep>
                </Endereco>
            </PrestadorServico>
            <TomadorServico>
                <IdentificacaoTomador>
                    <CpfCnpj>
                        ${docTomador.length === 14 ? `<Cnpj>${docTomador}</Cnpj>` : (docTomador.length === 11 ? `<Cpf>${docTomador}</Cpf>` : '<Cpf>00000000000</Cpf>')}
                    </CpfCnpj>
                </IdentificacaoTomador>
                <RazaoSocial>${nomeTomador}</RazaoSocial>
                <Endereco>
                    <Endereco>${tomador?.rua || 'RUA'}</Endereco>
                    <Numero>${tomador?.numero || 'S/N'}</Numero>
                    <Bairro>${tomador?.bairro || 'CENTRO'}</Bairro>
                    <CodigoMunicipio>${tomador?.ibge || empresa.ibge || '5208707'}</CodigoMunicipio>
                    <Uf>${tomador?.uf || empresa.uf || 'GO'}</Uf>
                    <Cep>${String(tomador?.cep || '74000000').replace(/\D/g, '')}</Cep>
                </Endereco>
                <Contato>
                    <Email>${tomador?.email || ''}</Email>
                    <Telefone>${String(tomador?.telefone || '').replace(/\D/g, '')}</Telefone>
                </Contato>
            </TomadorServico>
            <OutrasInformacoes>${(observacoes || '').replace(/[<>&'"]/g, ' ')}</OutrasInformacoes>
        </InfNfse>
    </Nfse>
</CompNfse>`.trim();

        const dadosRetorno = {
            tipo: 'NFS-e',
            modelo: 'NFS-e',
            status: 'autorizado',
            numero: String(numNFSe),
            serie: serieNFSe,
            codigo_verificacao: codigoVerificacao,
            chave: codigoVerificacao,
            data_emissao: dataEmissao,
            valor: vServico,
            valor_iss: vIss,
            aliquota_iss: aliqIss,
            item_lista_servico: itemLC116,
            discriminacao: servico.descricao,
            tomador: {
                doc: docTomador,
                nome: nomeTomador,
                email: tomador?.email || '',
                telefone: tomador?.telefone || '',
                rua: tomador?.rua || '',
                numero: tomador?.numero || '',
                bairro: tomador?.bairro || '',
                cidade: tomador?.cidade || empresa.cidade || 'GOIANIA',
                uf: tomador?.uf || empresa.uf || 'GO'
            },
            prestador: {
                cnpj: String(empresa.cnpj || '').replace(/\D/g, ''),
                im: empresa.im || '',
                nome: empresa.razaoSocial || empresa.nome || ''
            },
            xml_conteudo: xmlNFSe,
            vendaId: vendaId ? String(vendaId) : null,
            criadoEm: dataEmissao,
            emitidoPor: context.auth.uid
        };

        // Salva na coleção dedicada de notas de serviço
        const docId = `nfse_${numNFSe}_${codigoVerificacao}`;
        await empresaRef.collection('notas_servico').doc(docId).set(dadosRetorno);

        // Se vinculado a uma venda/serviço, atualiza o documento da venda
        if (vendaId) {
            await empresaRef.collection('vendas').doc(String(vendaId)).set({
                nfse: dadosRetorno,
                status_fiscal_nfse: 'autorizado'
            }, { merge: true });
        }

        // Incrementa o número da próxima NFS-e
        await empresaRef.collection('configuracoes').doc('config').set({
            empresa: { proximoNumeroNFSe: numNFSe + 1 }
        }, { merge: true });

        console.log(`[NFS-e] Emitida com sucesso! Nº ${numNFSe}, Codigo: ${codigoVerificacao}, Valor: R$ ${vServico}`);

        return {
            success: true,
            message: `NFS-e Nº ${numNFSe} emitida com sucesso! Código de Verificação: ${codigoVerificacao}`,
            data: dadosRetorno
        };

    } catch (error) {
        console.error('Erro ao emitir NFS-e:', error);
        if (error instanceof functions.https.HttpsError) throw error;
        throw new functions.https.HttpsError('internal', error.message);
    }
});

exports.validarCertificadoA1 = functions.runWith({ serviceAccount: 'lojafc-a31f9@appspot.gserviceaccount.com' }).https.onCall(async (data, context) => {
    const empId = (data && data.empId) ? data.empId : 'emp_fc_moveis';
    const empresaRef = db.collection('empresas').doc(empId);
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Usuário não autenticado.");

    const { pfxBase64, senha } = data;
    if (!pfxBase64) throw new functions.https.HttpsError("invalid-argument", "Arquivo do certificado (.pfx) não informado.");

    try {
        const chaves = extrairChavesDoPfx(pfxBase64, senha || '');
        const certForge = forge.pki.certificateFromPem(chaves.certificatePem);
        const subjectAttrs = certForge.subject.attributes || [];
        const cn = subjectAttrs.find(a => a.name === 'commonName')?.value || 'Certificado A1';
        const validade = certForge.validity.notAfter;
        return {
            sucesso: true,
            titular: cn,
            validade: validade ? validade.toISOString() : null,
            mensagem: `Certificado Válido! Titular: ${cn}`
        };
    } catch (err) {
        throw new functions.https.HttpsError("invalid-argument", err.message);
    }
});


