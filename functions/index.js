const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");
const forge = require("node-forge");
const { emitirNotaDiretoSefaz, cancelarNotaDiretoSefaz } = require("./fiscal/sefaz_engine");
const { extrairChavesDoPfx } = require("./fiscal/sefaz_signer");

admin.initializeApp();
const db = admin.firestore();

// Token da Focus NFe Homologação (Testes)
// Em produção, recomenda-se configurar via Google Secret Manager ou functions.config()
// AVISO: Configure o token via: firebase functions:config:set focusnfe.token="SEU_TOKEN_REAL"
// Depois atualize este codigo para: functions.config().focusnfe.token
const FOCUS_NFE_TOKEN = process.env.FOCUS_NFE_TOKEN || functions.config().focusnfe?.token || "CONFIGURAR_TOKEN_NO_FIREBASE";
const FOCUS_NFE_API_URL = "https://api.focusnfe.com.br/v2/nfce";

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
 * Obtém credenciais e URL base da Focus NFe com base na configuração da empresa
 */
function getFocusConfig(empresa) {
    const ambiente = (empresa && empresa.ambienteFiscal) ? String(empresa.ambienteFiscal).toLowerCase() : 'homologacao';
    const isProducao = ambiente === 'producao';
    
    // URLs da Focus NFe v2
    const baseUrl = isProducao 
        ? "https://api.focusnfe.com.br/v2" 
        : "https://homologacao.focusnfe.com.br/v2";

    // Token: prioriza o configurado na empresa pelo painel, depois env/functions.config
    const token = (empresa && empresa.focusToken) 
        ? empresa.focusToken.trim() 
        : (process.env.FOCUS_NFE_TOKEN || functions.config().focusnfe?.token || "");

    if (!token) {
        throw new functions.https.HttpsError(
            "failed-precondition", 
            "Token da Focus NFe não configurado. Acesse Configurações no sistema e informe o Token da Focus NFe."
        );
    }

    const tokenBasic = Buffer.from(token + ":").toString("base64");
    
    return {
        baseUrl,
        isProducao,
        token,
        headers: {
            "Authorization": `Basic ${tokenBasic}`,
            "Content-Type": "application/json"
        }
    };
}

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

        const produtos = venda.itens || venda.produtos || [];
        if (produtos.length === 0) throw new functions.https.HttpsError("invalid-argument", "A venda não possui itens.");

        // VERIFICA SE DEVE EMITIR VIA SEFAZ DIRETO (GRÁTIS) OU VIA FOCUS NFE
        const motorFiscal = empresa.motorFiscal || (empresa.certificadoBase64 ? 'sefaz_direto' : 'focus');

        if (motorFiscal === 'sefaz_direto') {
            console.log(`Emitindo NFC-e via SEFAZ Direto para a venda ${vendaId}...`);
            let clienteData = null;
            if (venda.clienteId && venda.clienteId !== '0') {
                const cliSnap = await db.collection("clientes").doc(String(venda.clienteId)).get();
                if (cliSnap.exists) clienteData = cliSnap.data();
            }

            const resultadoSefaz = await emitirNotaDiretoSefaz('65', venda, empresa, produtos, clienteData);

            const dadosRetorno = {
                tipo: "NFC-e",
                modelo: "65",
                status_sefaz: resultadoSefaz.sucesso ? "autorizado" : "erro_autorizacao",
                mensagem_sefaz: resultadoSefaz.mensagemSefaz || "",
                chave_nfe: resultadoSefaz.chave || "",
                numero: resultadoSefaz.numero || "",
                serie: resultadoSefaz.serie || (empresa.serieNFCe || "1"),
                protocolo: resultadoSefaz.protocolo || "",
                ambiente: resultadoSefaz.ambiente || empresa.ambienteFiscal || "homologacao",
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
                fiscal_motor: "sefaz_direto"
            }, { merge: true });

            if (resultadoSefaz.sucesso && resultadoSefaz.numero) {
                const proxNum = parseInt(resultadoSefaz.numero, 10) + 1;
                await db.collection("fc_moveis").doc("config").set({
                    empresa: { proximoNumeroNFCe: proxNum }
                }, { merge: true });
            }

            return {
                success: resultadoSefaz.sucesso,
                message: resultadoSefaz.sucesso ? "NFC-e autorizada com sucesso via SEFAZ Direto!" : resultadoSefaz.mensagemSefaz,
                data: dadosRetorno
            };
        }

        // 2. Configurações da Focus NFe (Fallback)
        const focusConf = getFocusConfig(empresa);

        // 3. Montar Itens e Pagamentos
        const itensFocus = await montarItensFocus(produtos);
        const formas_pagamento = mapearFormasPagamento(venda);

        // 4. Estruturação do Payload NFC-e
        const refNota = `NFCe_${vendaId}`;
        const serie = empresa.serieNFCe ? String(empresa.serieNFCe).trim() : "1";
        const natOp = empresa.naturezaOperacao ? String(empresa.naturezaOperacao).trim() : "VENDA DE MERCADORIA";

        const payload = {
            natureza_operacao: natOp,
            data_emissao: new Date().toISOString(),
            tipo_documento: 1, // 1 = Saída
            finalidade_emissao: 1, // 1 = Normal
            serie: serie,
            cnpj_emitente: (empresa.cnpj || "").replace(/\D/g, ""),
            nome_emitente: empresa.nome || "",
            inscricao_estadual_emitente: empresa.ie || "",
            logradouro_emitente: empresa.rua || "",
            numero_emitente: empresa.numero || "",
            bairro_emitente: empresa.bairro || "",
            municipio_emitente: empresa.cidade || "",
            uf_emitente: empresa.uf || "GO",
            cep_emitente: (empresa.cep || "").replace(/\D/g, ""),
            itens: itensFocus,
            formas_pagamento: formas_pagamento
        };

        // Identificação opcional do cliente (CPF na nota)
        if (venda.clienteDoc && venda.clienteDoc !== 'Não informado') {
            const docClean = String(venda.clienteDoc).replace(/\D/g, "");
            if (docClean.length === 11) payload.cpf_destinatario = docClean;
            else if (docClean.length === 14) payload.cnpj_destinatario = docClean;
            if (venda.clienteNome && venda.clienteNome !== 'Não informado') payload.nome_destinatario = venda.clienteNome;
        } else if (venda.clienteId && venda.clienteId !== '0') {
            const cliSnap = await db.collection("clientes").doc(String(venda.clienteId)).get();
            if (cliSnap.exists) {
                const cli = cliSnap.data();
                if (cli.doc) {
                    const docClean = String(cli.doc).replace(/\D/g, "");
                    if (docClean.length === 11) payload.cpf_destinatario = docClean;
                    else if (docClean.length === 14) payload.cnpj_destinatario = docClean;
                    if (cli.nome) payload.nome_destinatario = cli.nome;
                }
            }
        }

        console.log(`Enviando NFC-e (${focusConf.isProducao ? 'PROD' : 'HOMOLOG'}) ref=${refNota}:`, JSON.stringify(payload));

        // 5. Enviar para Focus NFe
        const response = await axios.post(
            `${focusConf.baseUrl}/nfce?ref=${refNota}`,
            payload,
            { headers: focusConf.headers }
        );

        console.log("Resposta Focus NFe (NFC-e):", response.data);

        // 6. Atualizar Firestore
        const baseDanfeUrl = focusConf.isProducao ? "https://api.focusnfe.com.br" : "https://homologacao.focusnfe.com.br";
        const caminhoDanfe = response.data.caminho_danfe || "";
        const caminhoXml = response.data.caminho_xml_nota_fiscal || "";

        const dadosRetorno = {
            tipo: "NFC-e",
            modelo: "65",
            status_sefaz: response.data.status_sefaz || response.data.status || "processando",
            mensagem_sefaz: response.data.mensagem_sefaz || "",
            caminho_xml_nota_fiscal: caminhoXml,
            caminho_danfe: caminhoDanfe,
            danfe_url_completa: caminhoDanfe ? `${baseDanfeUrl}${caminhoDanfe}` : "",
            xml_url_completa: caminhoXml ? `${baseDanfeUrl}${caminhoXml}` : "",
            chave_nfe: response.data.chave_nfe || "",
            numero: response.data.numero || "",
            serie: response.data.serie || serie,
            protocolo: response.data.protocolo || "",
            referencia_uuid: response.data.referencia || refNota,
            ambiente: focusConf.isProducao ? "producao" : "homologacao",
            data_emissao: new Date().toISOString()
        };

        await db.collection("vendas").doc(String(vendaId)).set({
            nfce: dadosRetorno,
            status_fiscal: dadosRetorno.status_sefaz,
            tipo_fiscal: "NFC-e",
            danfe_url: dadosRetorno.danfe_url_completa,
            xml_url: dadosRetorno.xml_url_completa
        }, { merge: true });

        return {
            success: true,
            message: "NFC-e processada com sucesso!",
            data: dadosRetorno
        };

    } catch (error) {
        console.error("Erro ao emitir NFC-e:", error);
        let errorMsg = error.message;
        if (error.response && error.response.data) {
            errorMsg = JSON.stringify(error.response.data);
            console.error("Erro retornado pela Focus NFe:", errorMsg);
        }
        throw new functions.https.HttpsError("internal", errorMsg);
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

        // 2. Configurações da Focus NFe
        const focusConf = getFocusConfig(empresa);

        // 3. Buscar Dados Completos do Cliente (Destinatário Obrigatório na NF-e)
        let clienteData = null;
        if (venda.clienteId && venda.clienteId !== '0') {
            const cliSnap = await db.collection("clientes").doc(String(venda.clienteId)).get();
            if (cliSnap.exists) clienteData = cliSnap.data();
        }

        const cliDoc = (clienteData && clienteData.doc) || venda.clienteDoc || '';
        const docClean = String(cliDoc).replace(/\D/g, '');
        if (!docClean || (docClean.length !== 11 && docClean.length !== 14)) {
            throw new functions.https.HttpsError("failed-precondition", "Para emitir NF-e (Modelo 55), o cliente precisa ter CPF ou CNPJ válido cadastrado.");
        }

        const cliNome = (clienteData && clienteData.nome) || venda.clienteNome || 'Cliente';
        const cliLogradouro = (clienteData && clienteData.rua) || (venda.clienteEnd ? venda.clienteEnd.split(',')[0] : 'Rua Principal');
        const cliNumero = (clienteData && clienteData.numero) || 'SN';
        const cliBairro = (clienteData && clienteData.bairro) || 'Centro';
        const cliCep = (clienteData && clienteData.cep ? String(clienteData.cep).replace(/\D/g, '') : '') || (empresa.cep ? String(empresa.cep).replace(/\D/g, '') : '74000000');
        
        let cliCidade = empresa.cidade || 'Goiânia';
        let cliUf = empresa.uf || 'GO';
        let cliIbge = (clienteData && clienteData.ibge) || empresa.ibge || '';

        if (clienteData && clienteData.cidade) {
            const parts = clienteData.cidade.split('-');
            cliCidade = parts[0].trim();
            if (parts[1]) cliUf = parts[1].trim();
        }

        // Indicador de Inscrição Estadual (1 = Contribuinte ICMS, 2 = Isento, 9 = Não Contribuinte)
        let indicadorIe = "9";
        let ieDestinatario = undefined;
        if (clienteData && (clienteData.ie || clienteData.rg)) {
            const ieClean = String(clienteData.ie || clienteData.rg).replace(/\D/g, '');
            if (ieClean.length >= 6 && docClean.length === 14) {
                indicadorIe = "1";
                ieDestinatario = ieClean;
            }
        }

        // 4. Montar Itens e Pagamentos
        const produtos = venda.itens || venda.produtos || [];
        if (produtos.length === 0) throw new functions.https.HttpsError("invalid-argument", "A venda não possui itens.");

        // VERIFICA SE DEVE EMITIR VIA SEFAZ DIRETO (GRÁTIS) OU VIA FOCUS NFE
        const motorFiscal = empresa.motorFiscal || (empresa.certificadoBase64 ? 'sefaz_direto' : 'focus');

        if (motorFiscal === 'sefaz_direto') {
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
                ambiente: resultadoSefaz.ambiente || empresa.ambienteFiscal || "homologacao",
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

            return {
                success: resultadoSefaz.sucesso,
                message: resultadoSefaz.sucesso ? "NF-e autorizada com sucesso via SEFAZ Direto!" : resultadoSefaz.mensagemSefaz,
                data: dadosRetorno
            };
        }

        const itensFocus = await montarItensFocus(produtos);
        const formas_pagamento = mapearFormasPagamento(venda);

        // 5. Estruturação do Payload NF-e (Modelo 55)
        const refNota = `NFe_${vendaId}`;
        const serie = empresa.serieNFe ? String(empresa.serieNFe).trim() : "1";
        const natOp = empresa.naturezaOperacao ? String(empresa.naturezaOperacao).trim() : "VENDA DE MERCADORIA";

        // Modalidade do frete: 0 = CIF (por conta do emitente), 1 = FOB (destinatário), 9 = sem frete
        const valorFrete = Number(venda.frete || 0);
        const modalidadeFrete = valorFrete > 0 ? 0 : 9;

        const payload = {
            natureza_operacao: natOp,
            data_emissao: new Date().toISOString(),
            tipo_documento: 1, // 1 = Saída
            finalidade_emissao: 1, // 1 = Normal
            serie: serie,
            
            // Dados do Emitente
            cnpj_emitente: (empresa.cnpj || "").replace(/\D/g, ""),
            nome_emitente: empresa.nome || "",
            inscricao_estadual_emitente: empresa.ie || "",
            logradouro_emitente: empresa.rua || "",
            numero_emitente: empresa.numero || "",
            bairro_emitente: empresa.bairro || "",
            municipio_emitente: empresa.cidade || "",
            uf_emitente: empresa.uf || "GO",
            cep_emitente: (empresa.cep || "").replace(/\D/g, ""),
            
            // Dados do Destinatário
            nome_destinatario: cliNome,
            indicador_inscricao_estadual_destinatario: indicadorIe,
            logradouro_destinatario: cliLogradouro,
            numero_destinatario: cliNumero,
            bairro_destinatario: cliBairro,
            municipio_destinatario: cliCidade,
            uf_destinatario: cliUf,
            cep_destinatario: cliCep,

            // Frete e Transporte
            modalidade_frete: modalidadeFrete,
            valor_frete: valorFrete > 0 ? valorFrete : undefined,

            // Itens e Pagamentos
            itens: itensFocus,
            formas_pagamento: formas_pagamento
        };

        if (docClean.length === 11) payload.cpf_destinatario = docClean;
        else if (docClean.length === 14) payload.cnpj_destinatario = docClean;

        if (ieDestinatario) payload.inscricao_estadual_destinatario = ieDestinatario;
        if (cliIbge) payload.codigo_municipio_destinatario = String(cliIbge).replace(/\D/g, "");

        console.log(`Enviando NF-e (${focusConf.isProducao ? 'PROD' : 'HOMOLOG'}) ref=${refNota}:`, JSON.stringify(payload));

        // 6. Enviar para a Focus NFe
        const response = await axios.post(
            `${focusConf.baseUrl}/nfe?ref=${refNota}`,
            payload,
            { headers: focusConf.headers }
        );

        console.log("Resposta Focus NFe (NF-e):", response.data);

        // 7. Atualizar Firestore
        const baseDanfeUrl = focusConf.isProducao ? "https://api.focusnfe.com.br" : "https://homologacao.focusnfe.com.br";
        const caminhoDanfe = response.data.caminho_danfe || "";
        const caminhoXml = response.data.caminho_xml_nota_fiscal || "";

        const dadosRetorno = {
            tipo: "NF-e",
            modelo: "55",
            status_sefaz: response.data.status_sefaz || response.data.status || "processando",
            mensagem_sefaz: response.data.mensagem_sefaz || "",
            caminho_xml_nota_fiscal: caminhoXml,
            caminho_danfe: caminhoDanfe,
            danfe_url_completa: caminhoDanfe ? `${baseDanfeUrl}${caminhoDanfe}` : "",
            xml_url_completa: caminhoXml ? `${baseDanfeUrl}${caminhoXml}` : "",
            chave_nfe: response.data.chave_nfe || "",
            numero: response.data.numero || "",
            serie: response.data.serie || serie,
            protocolo: response.data.protocolo || "",
            referencia_uuid: response.data.referencia || refNota,
            ambiente: focusConf.isProducao ? "producao" : "homologacao",
            data_emissao: new Date().toISOString()
        };

        await db.collection("vendas").doc(String(vendaId)).set({
            nfe: dadosRetorno,
            status_fiscal: dadosRetorno.status_sefaz,
            tipo_fiscal: "NF-e",
            danfe_url: dadosRetorno.danfe_url_completa,
            xml_url: dadosRetorno.xml_url_completa
        }, { merge: true });

        return {
            success: true,
            message: "NF-e enviada com sucesso!",
            data: dadosRetorno
        };

    } catch (error) {
        console.error("Erro ao emitir NF-e:", error);
        let errorMsg = error.message;
        if (error.response && error.response.data) {
            errorMsg = JSON.stringify(error.response.data);
            console.error("Erro retornado pela Focus NFe:", errorMsg);
        }
        throw new functions.https.HttpsError("internal", errorMsg);
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
        const { vendaId, tipo, justificativa } = data;
        if (!vendaId) throw new functions.https.HttpsError("invalid-argument", "vendaId não informado.");
        if (!justificativa || justificativa.trim().length < 15) {
            throw new functions.https.HttpsError("invalid-argument", "A justificativa de cancelamento deve ter pelo menos 15 caracteres (exigência da SEFAZ).");
        }

        const tipoNormalizado = (tipo && String(tipo).toLowerCase().includes("nfe") && !String(tipo).toLowerCase().includes("nfce")) ? "nfe" : "nfce";

        const vendaSnap = await db.collection("vendas").doc(String(vendaId)).get();
        if (!vendaSnap.exists) throw new functions.https.HttpsError("not-found", "Venda não encontrada.");
        const venda = vendaSnap.data();

        const configSnap = await db.collection("fc_moveis").doc("config").get();
        const empresa = configSnap.data()?.empresa || {};

        // VERIFICA SE DEVE CANCELAR VIA SEFAZ DIRETO OU VIA FOCUS NFE
        const motorFiscal = empresa.motorFiscal || (empresa.certificadoBase64 ? 'sefaz_direto' : 'focus');
        const chave = (tipoNormalizado === "nfe" ? venda.nfe?.chave_nfe : venda.nfce?.chave_nfe) || venda.fiscal_chave;
        const protocolo = (tipoNormalizado === "nfe" ? venda.nfe?.protocolo : venda.nfce?.protocolo) || "";

        if (motorFiscal === 'sefaz_direto' && chave) {
            console.log(`Cancelando ${tipoNormalizado.toUpperCase()} via SEFAZ Direto (chave: ${chave})...`);
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
                    updatePayload["nfe.status_sefaz"] = "cancelado";
                    updatePayload["nfe.cancelamento"] = dadosCancelamento;
                } else {
                    updatePayload["nfce.status_sefaz"] = "cancelado";
                    updatePayload["nfce.cancelamento"] = dadosCancelamento;
                }

                await db.collection("vendas").doc(String(vendaId)).update(updatePayload);
                return {
                    success: true,
                    message: "Nota Fiscal cancelada com sucesso diretamente na SEFAZ!",
                    data: dadosCancelamento
                };
            } else {
                throw new functions.https.HttpsError("failed-precondition", `Rejeição SEFAZ no cancelamento (${resCanc.cStat}): ${resCanc.xMotivo}`);
            }
        }

        const focusConf = getFocusConfig(empresa);

        const refNota = (tipoNormalizado === "nfe" && venda.nfe?.referencia_uuid) 
            ? venda.nfe.referencia_uuid 
            : (venda.nfce?.referencia_uuid || `${tipoNormalizado === 'nfe' ? 'NFe' : 'NFCe'}_${vendaId}`);

        console.log(`Cancelando ${tipoNormalizado.toUpperCase()} ref=${refNota}...`);

        const response = await axios.delete(
            `${focusConf.baseUrl}/${tipoNormalizado}/${refNota}`,
            {
                headers: focusConf.headers,
                data: { justificativa: justificativa.trim() }
            }
        );

        console.log("Resposta cancelamento Focus NFe:", response.data);

        const dadosCancelamento = {
            status_sefaz: "cancelado",
            justificativa_cancelamento: justificativa.trim(),
            data_cancelamento: new Date().toISOString(),
            mensagem_cancelamento: response.data.mensagem_sefaz || "Nota cancelada com sucesso"
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
            message: "Nota fiscal cancelada com sucesso na SEFAZ!",
            data: dadosCancelamento
        };

    } catch (error) {
        console.error("Erro ao cancelar nota:", error);
        let errorMsg = error.message;
        if (error.response && error.response.data) {
            errorMsg = JSON.stringify(error.response.data);
        }
        throw new functions.https.HttpsError("internal", errorMsg);
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

        const configSnap = await db.collection("fc_moveis").doc("config").get();
        const empresa = configSnap.data()?.empresa || {};
        const focusConf = getFocusConfig(empresa);

        const refNota = (tipoNormalizado === "nfe" && venda.nfe?.referencia_uuid) 
            ? venda.nfe.referencia_uuid 
            : (venda.nfce?.referencia_uuid || `${tipoNormalizado === 'nfe' ? 'NFe' : 'NFCe'}_${vendaId}`);

        const response = await axios.get(
            `${focusConf.baseUrl}/${tipoNormalizado}/${refNota}?completa=1`,
            { headers: focusConf.headers }
        );

        const resData = response.data;
        const baseDanfeUrl = focusConf.isProducao ? "https://api.focusnfe.com.br" : "https://homologacao.focusnfe.com.br";
        const caminhoDanfe = resData.caminho_danfe || "";
        const caminhoXml = resData.caminho_xml_nota_fiscal || "";

        const statusSefaz = resData.status_sefaz || resData.status || "processando";

        const updateObj = {
            status_sefaz: statusSefaz,
            mensagem_sefaz: resData.mensagem_sefaz || "",
            caminho_danfe: caminhoDanfe,
            caminho_xml_nota_fiscal: caminhoXml,
            danfe_url_completa: caminhoDanfe ? `${baseDanfeUrl}${caminhoDanfe}` : "",
            xml_url_completa: caminhoXml ? `${baseDanfeUrl}${caminhoXml}` : "",
            chave_nfe: resData.chave_nfe || "",
            numero: resData.numero || "",
            protocolo: resData.protocolo || ""
        };

        const updatePayload = { status_fiscal: statusSefaz };
        if (tipoNormalizado === "nfe") {
            updatePayload.nfe = { ...(venda.nfe || {}), ...updateObj };
            if (updateObj.danfe_url_completa) updatePayload.danfe_url = updateObj.danfe_url_completa;
            if (updateObj.xml_url_completa) updatePayload.xml_url = updateObj.xml_url_completa;
        } else {
            updatePayload.nfce = { ...(venda.nfce || {}), ...updateObj };
            if (updateObj.danfe_url_completa) updatePayload.danfe_url = updateObj.danfe_url_completa;
            if (updateObj.xml_url_completa) updatePayload.xml_url = updateObj.xml_url_completa;
        }

        await db.collection("vendas").doc(String(vendaId)).set(updatePayload, { merge: true });

        return {
            success: true,
            data: updateObj
        };

    } catch (error) {
        console.error("Erro ao consultar status da nota:", error);
        let errorMsg = error.message;
        if (error.response && error.response.data) {
            errorMsg = JSON.stringify(error.response.data);
        }
        throw new functions.https.HttpsError("internal", errorMsg);
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
            throw new functions.https.HttpsError("invalid-argument", "A correção deve ter pelo menos 15 caracteres.");
        }

        const vendaSnap = await db.collection("vendas").doc(String(vendaId)).get();
        if (!vendaSnap.exists) throw new functions.https.HttpsError("not-found", "Venda não encontrada.");
        const venda = vendaSnap.data();

        const configSnap = await db.collection("fc_moveis").doc("config").get();
        const empresa = configSnap.data()?.empresa || {};
        const focusConf = getFocusConfig(empresa);

        const refNota = venda.nfe?.referencia_uuid || `NFe_${vendaId}`;

        const response = await axios.post(
            `${focusConf.baseUrl}/nfe/${refNota}/carta_correcao`,
            { correcao: correcao.trim() },
            { headers: focusConf.headers }
        );

        console.log("Resposta Carta de Correção:", response.data);

        await db.collection("vendas").doc(String(vendaId)).set({
            nfe: {
                ...(venda.nfe || {}),
                cce: {
                    status: response.data.status_sefaz || "autorizado",
                    mensagem: response.data.mensagem_sefaz || "",
                    correcao: correcao.trim(),
                    data: new Date().toISOString()
                }
            }
        }, { merge: true });

        return {
            success: true,
            message: "Carta de Correção transmitida à SEFAZ com sucesso!",
            data: response.data
        };

    } catch (error) {
        console.error("Erro ao emitir Carta de Correção:", error);
        let errorMsg = error.message;
        if (error.response && error.response.data) {
            errorMsg = JSON.stringify(error.response.data);
        }
        throw new functions.https.HttpsError("internal", errorMsg);
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


