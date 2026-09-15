const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");
const forge = require("node-forge");
const { emitirNotaDiretoSefaz, cancelarNotaDiretoSefaz, cartaCorrecaoDiretoSefaz, transmitirNotaContingenciaSefaz } = require("./fiscal/sefaz_engine");
const { extrairChavesDoPfx } = require("./fiscal/sefaz_signer");

admin.initializeApp();
const db = admin.firestore();

/**
 * Função para Emitir NFC-e (Cupom Fiscal)
 * Chamada pelo Frontend passando { vendaId: '...' }
 */
exports.chamarGemini = functions.runWith({ serviceAccount: 'lojafc-a31f9@appspot.gserviceaccount.com' }).https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Usuário não autenticado.");
    
    // Validar se tem permissão (Admin, Gestão ou Marketing)
    const funcSnap = await db.collection("funcionarios").doc(context.auth.uid).get();
    const isPermitido = funcSnap.exists && (funcSnap.data().isAdmin || funcSnap.data().perm_gestao);
    if (!isPermitido) throw new functions.https.HttpsError("permission-denied", "Sem permissão para usar IA.");

    const configSnap = await db.collection("fc_moveis").doc("config").get();
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
                    const pSnap = await db.collection("produtos").doc(String(item.id)).get();
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
// 1. EMISSÃO DE NFC-e (CUPOM FISCAL / MOD 65)
// ==========================================
exports.emitirNFCe = functions.runWith({ serviceAccount: 'lojafc-a31f9@appspot.gserviceaccount.com' }).https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Usuário não autenticado.");

    // Validação de permissão
    const funcSnap = await db.collection("funcionarios").doc(context.auth.uid).get();
    const hasPerm = funcSnap.exists && (funcSnap.data().isAdmin || funcSnap.data().perm_pdv || funcSnap.data().perm_gestao);
    if (!hasPerm) throw new functions.https.HttpsError("permission-denied", "Sem permissão para emitir NFC-e.");

    try {
        const vendaId = data.vendaId;
        if (!vendaId) throw new functions.https.HttpsError("invalid-argument", "vendaId não informado.");

        // 1. Buscar Venda e Configurações da Empresa
        const vendaSnap = await db.collection("vendas").doc(String(vendaId)).get();
        if (!vendaSnap.exists) throw new functions.https.HttpsError("not-found", "Venda não encontrada.");
        const venda = vendaSnap.data();

        const configSnap = await db.collection("fc_moveis").doc("config").get();
        const config = configSnap.data();
        if (!config || !config.empresa) throw new functions.https.HttpsError("failed-precondition", "Configurações da empresa incompletas.");
        const empresa = config.empresa;

        if (!empresa.ambienteFiscal || empresa.ambienteFiscal !== 'producao') {
            empresa.ambienteFiscal = 'producao';
            db.collection("fc_moveis").doc("config").set({ empresa: { ambienteFiscal: 'producao' } }, { merge: true }).catch(console.error);
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
            const cliSnap = await db.collection("clientes").doc(String(venda.clienteId)).get();
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

        await db.collection("vendas").doc(String(vendaId)).set({
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
            await db.collection("fc_moveis").doc("config").set({
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
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Usuário não autenticado.");

    const funcSnap = await db.collection("funcionarios").doc(context.auth.uid).get();
    const hasPerm = funcSnap.exists && (funcSnap.data().isAdmin || funcSnap.data().perm_pdv || funcSnap.data().perm_gestao);
    if (!hasPerm) throw new functions.https.HttpsError("permission-denied", "Sem permissão para transmitir nota.");

    try {
        const vendaId = data.vendaId;
        if (!vendaId) throw new functions.https.HttpsError("invalid-argument", "vendaId não informado.");

        const vendaSnap = await db.collection("vendas").doc(String(vendaId)).get();
        if (!vendaSnap.exists) throw new functions.https.HttpsError("not-found", "Venda não encontrada.");
        const venda = vendaSnap.data();

        const configSnap = await db.collection("fc_moveis").doc("config").get();
        const config = configSnap.data();
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

            await db.collection("vendas").doc(String(vendaId)).set({
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
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Usuário não autenticado.");

    // Validação de permissão
    const funcSnap = await db.collection("funcionarios").doc(context.auth.uid).get();
    const hasPerm = funcSnap.exists && (funcSnap.data().isAdmin || funcSnap.data().perm_pdv || funcSnap.data().perm_gestao);
    if (!hasPerm) throw new functions.https.HttpsError("permission-denied", "Sem permissão para emitir NF-e.");

    try {
        const vendaId = data.vendaId;
        if (!vendaId) throw new functions.https.HttpsError("invalid-argument", "vendaId não informado.");

        // 1. Buscar Venda e Configurações da Empresa
        const vendaSnap = await db.collection("vendas").doc(String(vendaId)).get();
        if (!vendaSnap.exists) throw new functions.https.HttpsError("not-found", "Venda não encontrada.");
        const venda = vendaSnap.data();

        const configSnap = await db.collection("fc_moveis").doc("config").get();
        const config = configSnap.data();
        if (!config || !config.empresa) throw new functions.https.HttpsError("failed-precondition", "Configurações da empresa incompletas.");
        const empresa = config.empresa;

        if (!empresa.ambienteFiscal || empresa.ambienteFiscal !== 'producao') {
            empresa.ambienteFiscal = 'producao';
            db.collection("fc_moveis").doc("config").set({ empresa: { ambienteFiscal: 'producao' } }, { merge: true }).catch(console.error);
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
            const cliSnap = await db.collection("clientes").doc(String(venda.clienteId)).get();
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

        await db.collection("vendas").doc(String(vendaId)).set({
            nfe: dadosRetorno,
            status_fiscal: dadosRetorno.status_sefaz,
            tipo_fiscal: "NF-e",
            fiscal_chave: dadosRetorno.chave_nfe,
            fiscal_xml: dadosRetorno.xml_conteudo,
            fiscal_motor: "sefaz_direto"
        }, { merge: true });

        if (resultadoSefaz.sucesso && resultadoSefaz.numero) {
            const proxNum = parseInt(resultadoSefaz.numero, 10) + 1;
            await db.collection("fc_moveis").doc("config").set({
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
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Usuário não autenticado.");

    const funcSnap = await db.collection("funcionarios").doc(context.auth.uid).get();
    const hasPerm = funcSnap.exists && (funcSnap.data().isAdmin || funcSnap.data().perm_gestao);
    if (!hasPerm) throw new functions.https.HttpsError("permission-denied", "Sem permissão para cancelar notas fiscais.");

    try {
        const { vendaId, tipo, justificativa, forcarInterno, permitirCancelamentoInternoSeExpirado } = data;
        if (!vendaId) throw new functions.https.HttpsError("invalid-argument", "vendaId não informado.");
        if (!justificativa || justificativa.trim().length < 15) {
            throw new functions.https.HttpsError("invalid-argument", "A justificativa deve ter pelo menos 15 caracteres (exigência da SEFAZ).");
        }

        const tipoNormalizado = (tipo || "nfce").toLowerCase().replace('-', '');

        const vendaSnap = await db.collection("vendas").doc(String(vendaId)).get();
        if (!vendaSnap.exists) throw new functions.https.HttpsError("not-found", "Venda não encontrada.");
        const venda = vendaSnap.data();

        // CANCELAMENTO ADMINISTRATIVO INTERNO (Quando solicitado ou prazo da SEFAZ expirado)
        if (forcarInterno) {
            console.log(`[CANCELAMENTO] Realizando cancelamento administrativo interno para venda ${vendaId}...`);
            const dadosCancelamentoInterno = {
                status_sefaz: "cancelado_interno",
                justificativa_cancelamento: justificativa.trim(),
                data_cancelamento: new Date().toISOString(),
                mensagem_cancelamento: "Cancelado administrativamente no sistema (Prazo legal da SEFAZ expirado)",
                protocolo_cancelamento: "CANCELADO_INTERNO"
            };

            const updatePayload = {
                status_fiscal: "cancelado_interno"
            };
            if (tipoNormalizado === "nfe") {
                updatePayload.nfe = { ...(venda.nfe || {}), ...dadosCancelamentoInterno };
            } else {
                updatePayload.nfce = { ...(venda.nfce || {}), ...dadosCancelamentoInterno };
            }

            await db.collection("vendas").doc(String(vendaId)).set(updatePayload, { merge: true });
            return {
                success: true,
                canceladoInterno: true,
                message: "Nota cancelada administrativamente no sistema com sucesso!",
                data: dadosCancelamentoInterno
            };
        }

        const configSnap = await db.collection("fc_moveis").doc("config").get();
        const empresa = configSnap.data()?.empresa || {};

        // VERIFICA SE DEVE CANCELAR VIA SEFAZ DIRETO OU VIA FOCUS NFE
        const motorFiscal = empresa.motorFiscal || (empresa.certificadoBase64 ? 'sefaz_direto' : 'focus');
        
        // 1. Sanitização da Chave de Acesso (44 dígitos numéricos, sem prefixo 'NFe')
        const rawChave = (tipoNormalizado === "nfe" ? (venda.nfe?.chave_nfe || venda.nfe?.chave) : (venda.nfce?.chave_nfe || venda.nfce?.chave)) 
            || venda.fiscal_chave 
            || venda.chave_nfe 
            || "";
        const chave = String(rawChave).replace(/^NFe/i, '').replace(/\D/g, '').trim();

        // 2. Extração e validação do Protocolo de Autorização (<nProt>)
        let protocolo = String((tipoNormalizado === "nfe" ? venda.nfe?.protocolo : venda.nfce?.protocolo) 
            || venda.fiscal_protocolo 
            || venda.protocolo 
            || "").replace(/\D/g, '').trim();

        // Se o protocolo estiver ausente ou não numérico, extrai do XML gravado na venda
        if (!protocolo || protocolo.length < 15) {
            const xml = venda.fiscal_xml 
                || (tipoNormalizado === "nfe" ? (venda.nfe?.xml_conteudo || venda.nfe?.xml) : (venda.nfce?.xml_conteudo || venda.nfce?.xml)) 
                || venda.xml 
                || "";
            if (xml) {
                const matchProt = xml.match(/<nProt>(\d{15})<\/nProt>/i) || xml.match(/<nProt>(\d+)<\/nProt>/i);
                if (matchProt && matchProt[1]) {
                    protocolo = matchProt[1].trim();
                    console.log(`[CANCELAMENTO] Protocolo recuperado com sucesso do XML da venda: ${protocolo}`);
                }
            }
        }

        if (!empresa.certificadoBase64) {
            throw new functions.https.HttpsError("failed-precondition", "Certificado Digital A1 (.pfx) não configurado para realizar o cancelamento na SEFAZ. Acesse Configurações > Emissor Fiscal.");
        }

        if (!chave || chave.length !== 44) {
            throw new functions.https.HttpsError("invalid-argument", `Chave de acesso inválida (${chave ? chave.length : 0} dígitos). O cancelamento exige 44 dígitos numéricos.`);
        }
        if (!protocolo || !/^\d+$/.test(protocolo)) {
            throw new functions.https.HttpsError("failed-precondition", "Protocolo de autorização da nota fiscal não encontrado. A SEFAZ exige o número do protocolo de autorização (<nProt>) para homologar o cancelamento.");
        }

        console.log(`Cancelando ${tipoNormalizado.toUpperCase()} via SEFAZ Direto (chave: ${chave}, protocolo: ${protocolo})...`);
        const resCanc = await cancelarNotaDiretoSefaz(chave, protocolo, justificativa.trim(), empresa, tipoNormalizado === "nfe" ? "55" : "65");
        if (resCanc.sucesso) {
            const dadosCancelamento = {
                status_sefaz: "cancelado",
                justificativa_cancelamento: justificativa.trim(),
                data_cancelamento: new Date().toISOString(),
                mensagem_cancelamento: resCanc.xMotivo || "Nota cancelada com sucesso na SEFAZ",
                protocolo_cancelamento: resCanc.nProt || ""
            };

            const updatePayload = {
                status_fiscal: "cancelado"
            };
            if (tipoNormalizado === "nfe") {
                updatePayload.nfe = { ...(venda.nfe || {}), ...dadosCancelamento };
            } else {
                updatePayload.nfce = { ...(venda.nfce || {}), ...dadosCancelamento };
            }

            await db.collection("vendas").doc(String(vendaId)).set(updatePayload, { merge: true });
            return {
                success: true,
                message: "Nota Fiscal cancelada com sucesso diretamente na SEFAZ!",
                data: dadosCancelamento
            };
        } else {
            const cStatStr = String(resCanc.cStat || '');
            const xMotivoStr = String(resCanc.xMotivo || '');
            const isPrazoExpirado = cStatStr === '501' || xMotivoStr.toLowerCase().includes('prazo de cancelamento superior');

            // Se for prazo expirado e o cliente autorizou estorno interno
            if (isPrazoExpirado && permitirCancelamentoInternoSeExpirado) {
                console.log(`[CANCELAMENTO] SEFAZ rejeitou por prazo expirado (501). Efetuando cancelamento interno conforme autorizado...`);
                const dadosCancelamentoInterno = {
                    status_sefaz: "cancelado_interno",
                    justificativa_cancelamento: justificativa.trim(),
                    data_cancelamento: new Date().toISOString(),
                    mensagem_cancelamento: `Rejeição SEFAZ (501): ${xMotivoStr} - Cancelado administrativamente no sistema`,
                    protocolo_cancelamento: resCanc.nProt || "CANCELADO_INTERNO"
                };

                const updatePayload = {
                    status_fiscal: "cancelado_interno"
                };
                if (tipoNormalizado === "nfe") {
                    updatePayload.nfe = { ...(venda.nfe || {}), ...dadosCancelamentoInterno };
                } else {
                    updatePayload.nfce = { ...(venda.nfce || {}), ...dadosCancelamentoInterno };
                }

                await db.collection("vendas").doc(String(vendaId)).set(updatePayload, { merge: true });
                return {
                    success: true,
                    canceladoInterno: true,
                    cStat: '501',
                    message: "Prazo da SEFAZ expirado. A nota foi cancelada administrativamente no sistema!",
                    data: dadosCancelamentoInterno
                };
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
// 4. CONSULTA DE STATUS NA SEFAZ (POLLING / REFRESH)
// ==========================================
exports.consultarStatusNota = functions.runWith({ serviceAccount: 'lojafc-a31f9@appspot.gserviceaccount.com' }).https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Usuário não autenticado.");

    try {
        const { vendaId, tipo } = data;
        if (!vendaId) throw new functions.https.HttpsError("invalid-argument", "vendaId não informado.");

        const tipoNormalizado = (tipo && String(tipo).toLowerCase().includes("nfe") && !String(tipo).toLowerCase().includes("nfce")) ? "nfe" : "nfce";

        const vendaSnap = await db.collection("vendas").doc(String(vendaId)).get();
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
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Usuário não autenticado.");

    const funcSnap = await db.collection("funcionarios").doc(context.auth.uid).get();
    const hasPerm = funcSnap.exists && (funcSnap.data().isAdmin || funcSnap.data().perm_gestao);
    if (!hasPerm) throw new functions.https.HttpsError("permission-denied", "Sem permissão para emitir Carta de Correção.");

    try {
        const { vendaId, correcao } = data;
        if (!vendaId) throw new functions.https.HttpsError("invalid-argument", "vendaId não informado.");
        if (!correcao || correcao.trim().length < 15) {
            throw new functions.https.HttpsError("invalid-argument", "A correção deve ter pelo menos 15 caracteres (exigência da SEFAZ).");
        }

        const vendaSnap = await db.collection("vendas").doc(String(vendaId)).get();
        if (!vendaSnap.exists) throw new functions.https.HttpsError("not-found", "Venda não encontrada.");
        const venda = vendaSnap.data();

        const configSnap = await db.collection("fc_moveis").doc("config").get();
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

            await db.collection("vendas").doc(String(vendaId)).set({
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
// 6. VALIDAÇÃO DO CERTIFICADO A1 E SENHA
// ==========================================
exports.validarCertificadoA1 = functions.runWith({ serviceAccount: 'lojafc-a31f9@appspot.gserviceaccount.com' }).https.onCall(async (data, context) => {
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


