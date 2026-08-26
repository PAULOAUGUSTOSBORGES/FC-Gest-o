const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");

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
exports.emitirNFCe = functions.https.onCall(async (data, context) => {
    // Validação de autenticação
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Usuário não autenticado.");
    }

    try {
        const vendaId = data.vendaId;
        if (!vendaId) {
            throw new functions.https.HttpsError("invalid-argument", "vendaId não informado.");
        }

        // 1. Buscar a Venda no Firestore
        const vendaSnap = await db.collection("vendas").doc(vendaId).get();
        if (!vendaSnap.exists) {
            throw new functions.https.HttpsError("not-found", "Venda não encontrada.");
        }
        const venda = vendaSnap.data();

        // 2. Buscar Configurações da Empresa
        const configSnap = await db.collection("fc_moveis").doc("config").get();
        const config = configSnap.data();
        if (!config || !config.empresa) {
            throw new functions.https.HttpsError("failed-precondition", "Configurações da empresa incompletas.");
        }
        const empresa = config.empresa;

        // 3. Montar os itens (produtos da venda)
        const produtos = venda.itens || venda.produtos || []; // 'itens' e o campo correto do PDV
        const itensFocus = produtos.map((item, index) => {
            const qtd = Number(item.qtd) || 1;
            const preco = Number(item.preco) || 0;
            return {
                numero_item: index + 1,
                codigo_produto: String(item.id || `PROD-${index + 1}`),
                descricao: item.nome || `Produto ${index + 1}`,
                cfop: item.cfop || "5102",
                codigo_ncm: item.ncm ? String(item.ncm).replace(/\D/g, "") : "00000000",
                quantidade_comercial: qtd,
                quantidade_tributavel: qtd,
                valor_unitario_comercial: preco,
                valor_unitario_tributavel: preco,
                valor_bruto: (qtd * preco),
                unidade_comercial: item.unidade || "UN",
                unidade_tributavel: item.unidade || "UN",
                icms_origem: item.origem || "0",
                icms_situacao_tributaria: item.csosn || "102"
            };
        });

        // 4. Montar as formas de pagamento (Focus NFe)
        let formaPagamento = "01"; // Dinheiro default
        const pagUpper = String(venda.pag || "").toUpperCase();
        if (pagUpper.includes("PIX")) formaPagamento = "17";
        else if (pagUpper.includes("CRÉDITO") || pagUpper.includes("CREDITO")) formaPagamento = "03";
        else if (pagUpper.includes("DÉBITO") || pagUpper.includes("DEBITO")) formaPagamento = "04";
        else if (pagUpper.includes("BOLETO")) formaPagamento = "15";

        const formas_pagamento = [{
            forma_pagamento: formaPagamento,
            valor_pagamento: Number(venda.tot || venda.valorLiquido || 0)
        }];

        // 5. Estruturação do Payload para a API da Focus
        const refNota = `NFCe_${vendaId}`;
        
        const payload = {
            natureza_operacao: "VENDA DE MERCADORIA",
            data_emissao: new Date().toISOString(),
            tipo_documento: 1, // 1 = Saída
            finalidade_emissao: 1, // 1 = Normal
            cnpj_emitente: (empresa.cnpj || "").replace(/\D/g, ""),
            nome_emitente: empresa.nome || "",
            inscricao_estadual_emitente: empresa.ie || "",
            logradouro_emitente: empresa.rua || "",
            numero_emitente: empresa.numero || "",
            bairro_emitente: empresa.bairro || "",
            municipio_emitente: empresa.cidade || "",
            uf_emitente: empresa.uf || "SP",
            cep_emitente: (empresa.cep || "").replace(/\D/g, ""),
            
            // Itens e Pagamento
            itens: itensFocus,
            formas_pagamento: formas_pagamento
        };

        // Se a venda tem cliente vinculado com CPF/CNPJ
        if (venda.clienteId) {
            const cliSnap = await db.collection("clientes").doc(String(venda.clienteId)).get();
            if (cliSnap.exists) {
                const cliente = cliSnap.data();
                if (cliente.doc) {
                    const docClean = String(cliente.doc).replace(/\D/g, "");
                    if (docClean.length === 11) payload.cpf_destinatario = docClean;
                    else if (docClean.length === 14) payload.cnpj_destinatario = docClean;
                    
                    if (cliente.nome) payload.nome_destinatario = cliente.nome;
                }
            }
        }

        console.log("Enviando NFC-e para Focus NFe:", JSON.stringify(payload));

        // 6. Enviar para a Focus NFe
        const tokenBasic = Buffer.from(FOCUS_NFE_TOKEN + ":").toString("base64");
        
        const response = await axios.post(
            `${FOCUS_NFE_API_URL}?ref=${refNota}`, 
            payload, 
            {
                headers: {
                    "Authorization": `Basic ${tokenBasic}`,
                    "Content-Type": "application/json"
                }
            }
        );

        console.log("Resposta Focus NFe:", response.data);

        // 7. Atualizar o Firestore com os dados do retorno
        const dadosRetorno = {
            status_sefaz: response.data.status_sefaz || "processando",
            mensagem_sefaz: response.data.mensagem_sefaz || "",
            caminho_xml_nota_fiscal: response.data.caminho_xml_nota_fiscal || "",
            caminho_danfe: response.data.caminho_danfe || "",
            referencia_uuid: response.data.referencia || refNota
        };

        await db.collection("vendas").doc(vendaId).set({
            nfce: dadosRetorno
        }, { merge: true });

        return { 
            success: true, 
            message: "NFC-e enviada com sucesso!", 
            data: dadosRetorno 
        };

    } catch (error) {
        console.error("Erro ao emitir NFC-e:", error);
        
        let errorMsg = error.message;
        if (error.response && error.response.data) {
            errorMsg = JSON.stringify(error.response.data);
            console.error("Erro da API Focus NFe:", errorMsg);
        }

        throw new functions.https.HttpsError("internal", errorMsg);
    }
});


