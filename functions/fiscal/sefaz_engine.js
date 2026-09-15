// ==============================================================
// MOTOR FISCAL AUTÔNOMO SEFAZ DIRETO
// Orquestrador de Emissão, Assinatura e Cancelamento Direto na SEFAZ
// ==============================================================

const crypto = require('crypto');
const { obterEndpointsSefaz } = require('./sefaz_urls');
const { construirXmlNota, formatarDataHoraSefaz, limparTexto, apenasDigitos } = require('./sefaz_xml_builder');
const { assinarXmlNota, assinarXmlEvento, extrairChavesDoPfx } = require('./sefaz_signer');
const { transmitirLoteSefaz, transmitirEvento } = require('./sefaz_client');
const { processarRespostaSefaz, gerarUrlQrCodeNFCe, processarRespostaEvento } = require('./sefaz_protocol');

/**
 * Emite NFC-e (Mod 65) ou NF-e (Mod 55) diretamente com a SEFAZ
 * @param {'65'|'55'} modelo Modelo da nota
 * @param {Object} venda Dados da venda
 * @param {Object} empresa Dados da empresa configurada
 * @param {Array} itens Lista de itens
 * @param {Object} cliente Dados do cliente (opcional para NFC-e)
 */
async function emitirNotaDiretoSefaz(modelo, venda, empresa, itens, cliente = null, opcoes = {}) {
    if (!empresa.certificadoBase64) {
        throw new Error('Certificado Digital A1 (.pfx) não configurado. Acesse Configurações > Emissor Fiscal para fazer o upload do seu certificado.');
    }

    const ambiente = empresa.ambienteFiscal === 'producao' ? 'producao' : 'homologacao';
    const endpoints = obterEndpointsSefaz(modelo, empresa.uf, ambiente);
    const isContingencia = Boolean(opcoes.contingencia || venda.contingencia || opcoes.tpEmis === '9');

    // 1. Constrói o XML padrão MOC 4.00
    const xmlGerado = construirXmlNota({
        empresa,
        venda,
        itens,
        cliente,
        modelo,
        ambiente,
        endpoints,
        contingencia: isContingencia,
        justificativaContingencia: opcoes.justificativaContingencia || venda.justificativaContingencia || 'Instabilidade momentanea na comunicacao com a SEFAZ',
        numeroNota: venda.numeroNotaFiscal || (modelo === '65' ? (parseInt(empresa.proximoNumeroNFCe) || 1) : (parseInt(empresa.proximoNumeroNFe) || 1)),
        serie: modelo === '65' ? (parseInt(empresa.serieNFCe) || 1) : (parseInt(empresa.serieNFe) || 1)
    });

    // 2. Assina digitalmente o XML com o Certificado Digital A1
    const xmlAssinado = assinarXmlNota(
        xmlGerado.xml,
        empresa.certificadoBase64,
        empresa.certificadoSenha || '',
        xmlGerado.chave
    );

    let qrCodeUrl = null;
    if (modelo === '65') {
        qrCodeUrl = gerarUrlQrCodeNFCe({
            chaveAcesso: xmlGerado.chave,
            tpAmb: xmlGerado.tpAmb,
            cscId: empresa.cscId || '000001',
            cscToken: empresa.cscToken || '',
            qrCodeBaseUrl: endpoints.qrCodeUrl
        });
    }

    // Se for emissão diretamente em contingência off-line
    if (isContingencia) {
        console.log(`[SEFAZ DIRETO] NFC-e emitida em CONTINGÊNCIA off-line: Nota ${xmlGerado.nNF} série ${xmlGerado.serie}, Chave ${xmlGerado.chave}`);
        return {
            sucesso: true,
            contingencia: true,
            status: 'contingencia',
            tipo: modelo === '65' ? 'NFC-e' : 'NF-e',
            modelo,
            chave: xmlGerado.chave,
            numero: xmlGerado.nNF,
            serie: xmlGerado.serie,
            protocolo: 'EMITIDA EM CONTINGÊNCIA',
            dataAutorizacao: xmlGerado.dhEmi,
            cStat: '9',
            mensagemSefaz: 'NFC-e emitida em contingência off-line com sucesso. Pendente de transmissão à SEFAZ.',
            xml: xmlAssinado,
            qrCodeUrl,
            motor: 'sefaz_direto',
            ambiente
        };
    }

    console.log(`[SEFAZ DIRETO] Transmitindo nota ${xmlGerado.nNF} serie ${xmlGerado.serie}. Pagamento:`, xmlGerado.xml.match(/<pag>[\s\S]*?<\/pag>/)?.[0]);

    // 3. Transmite para a SEFAZ via mTLS
    let respostaSoap = null;
    try {
        respostaSoap = await transmitirLoteSefaz(
            endpoints.autorizacaoUrl,
            xmlAssinado,
            empresa.certificadoBase64,
            empresa.certificadoSenha || '',
            '1'
        );
    } catch (errCom) {
        console.warn(`[SEFAZ DIRETO] Falha na comunicação com a SEFAZ (${errCom.message}). Verificando fallback de contingência...`);
        if (modelo === '65' && (opcoes.fallbackContingencia || venda.fallbackContingencia)) {
            return await emitirNotaDiretoSefaz(modelo, venda, empresa, itens, cliente, { ...opcoes, contingencia: true });
        }
        throw errCom;
    }

    console.log(`[SEFAZ DIRETO] Resposta bruta SEFAZ (${endpoints.autorizacaoUrl}):`, typeof respostaSoap === 'string' ? respostaSoap.substring(0, 800) : JSON.stringify(respostaSoap));

    // 4. Processa o retorno da SEFAZ
    const resultado = processarRespostaSefaz(respostaSoap, xmlAssinado);

    if (resultado.sucesso) {
        return {
            sucesso: true,
            status: 'autorizado',
            tipo: modelo === '65' ? 'NFC-e' : 'NF-e',
            modelo,
            chave: xmlGerado.chave,
            numero: xmlGerado.nNF,
            serie: xmlGerado.serie,
            protocolo: resultado.nProt,
            dataAutorizacao: resultado.dhRecbto || new Date().toISOString(),
            cStat: resultado.cStat,
            mensagemSefaz: resultado.xMotivo,
            xml: resultado.xmlProc,
            qrCodeUrl,
            motor: 'sefaz_direto',
            ambiente
        };
    } else {
        return {
            sucesso: false,
            status: 'erro_autorizacao',
            tipo: modelo === '65' ? 'NFC-e' : 'NF-e',
            modelo,
            chave: xmlGerado.chave,
            numero: xmlGerado.nNF,
            serie: xmlGerado.serie,
            cStat: resultado.cStat,
            mensagemSefaz: `Rejeição SEFAZ (${resultado.cStat}): ${resultado.xMotivo}`,
            xml: xmlAssinado,
            motor: 'sefaz_direto',
            ambiente
        };
    }
}

/**
 * Cancela uma nota fiscal autorizada diretamente na SEFAZ
 * @param {string} chave Chave de acesso de 44 dígitos
 * @param {string} protocolo Protocolo de autorização original
 * @param {string} justificativa Motivo do cancelamento (mínimo 15 caracteres)
 * @param {Object} empresa Dados da empresa configurada
 * @param {'65'|'55'} modelo Modelo da nota
 */
async function cancelarNotaDiretoSefaz(chave, protocolo, justificativa, empresa, modelo = '65') {
    if (!empresa.certificadoBase64) {
        throw new Error('Certificado Digital A1 (.pfx) não configurado.');
    }

    const chaveLimpa = String(chave || '').replace(/^NFe/i, '').replace(/\D/g, '').trim();
    if (!chaveLimpa || chaveLimpa.length !== 44) {
        throw new Error(`Chave de acesso inválida (${chaveLimpa ? chaveLimpa.length : 0} dígitos). Deve conter exatamente 44 dígitos numéricos.`);
    }

    const protLimpo = String(protocolo || '').replace(/\D/g, '').trim();
    if (!protLimpo) {
        throw new Error('Protocolo de autorização (<nProt>) não informado ou inválido para o cancelamento.');
    }

    const xJust = limparTexto(justificativa).trim();
    if (!xJust || xJust.length < 15) {
        throw new Error('A justificativa de cancelamento deve conter no mínimo 15 caracteres.');
    }

    const ambiente = empresa.ambienteFiscal === 'producao' ? 'producao' : 'homologacao';
    const endpoints = obterEndpointsSefaz(modelo, empresa.uf, ambiente);
    const tpAmb = ambiente === 'producao' ? '1' : '2';
    const cUF = endpoints.cUF;
    const cnpj = apenasDigitos(empresa.cnpj);
    const dhEvento = formatarDataHoraSefaz(new Date());
    const idEvento = `ID110111${chaveLimpa}01`;

    // Monta XML do Evento de Cancelamento (110111)
    const xmlEvento = `<?xml version="1.0" encoding="UTF-8"?>
<evento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00">
    <infEvento Id="${idEvento}">
        <cOrgao>${cUF}</cOrgao>
        <tpAmb>${tpAmb}</tpAmb>
        <CNPJ>${cnpj}</CNPJ>
        <chNFe>${chaveLimpa}</chNFe>
        <dhEvento>${dhEvento}</dhEvento>
        <tpEvento>110111</tpEvento>
        <nSeqEvento>1</nSeqEvento>
        <verEvento>1.00</verEvento>
        <detEvento versao="1.00">
            <descEvento>Cancelamento</descEvento>
            <nProt>${protLimpo}</nProt>
            <xJust>${xJust}</xJust>
        </detEvento>
    </infEvento>
</evento>`.trim();

    // Assina o evento conforme o padrão W3C XML-DSig C14N
    const eventoAssinadoXml = assinarXmlEvento(
        xmlEvento,
        empresa.certificadoBase64,
        empresa.certificadoSenha || '',
        idEvento
    );

    console.log(`[SEFAZ EVENTO] Transmitindo cancelamento chave ${chaveLimpa} para ${endpoints.eventoUrl}...`);

    // Transmite para o Web Service de Evento
    const respostaSoap = await transmitirEvento(
        endpoints.eventoUrl,
        eventoAssinadoXml,
        empresa.certificadoBase64,
        empresa.certificadoSenha || ''
    );

    console.log(`[SEFAZ EVENTO] Resposta bruta SEFAZ:`, typeof respostaSoap === 'string' ? respostaSoap.substring(0, 600) : JSON.stringify(respostaSoap));

    const resultado = processarRespostaEvento(respostaSoap);
    return resultado;
}

/**
 * Emite Carta de Correção Eletrônica (CC-e) diretamente na SEFAZ (Evento 110110)
 * @param {string} chave Chave de acesso de 44 dígitos
 * @param {string} correcao Texto da correção (mínimo 15 caracteres)
 * @param {Object} empresa Dados da empresa configurada
 * @param {number} nSeqEvento Número sequencial do evento (padrão: 1)
 */
async function cartaCorrecaoDiretoSefaz(chave, correcao, empresa, nSeqEvento = 1) {
    if (!empresa.certificadoBase64) {
        throw new Error('Certificado Digital A1 (.pfx) não configurado.');
    }

    const chaveLimpa = String(chave || '').replace(/^NFe/i, '').replace(/\D/g, '').trim();
    if (!chaveLimpa || chaveLimpa.length !== 44) {
        throw new Error(`Chave de acesso inválida (${chaveLimpa ? chaveLimpa.length : 0} dígitos). Deve conter exatamente 44 dígitos.`);
    }

    const xCorrecao = limparTexto(correcao).trim();
    if (!xCorrecao || xCorrecao.length < 15) {
        throw new Error('A correção deve conter no mínimo 15 caracteres.');
    }

    const ambiente = empresa.ambienteFiscal === 'producao' ? 'producao' : 'homologacao';
    const endpoints = obterEndpointsSefaz('55', empresa.uf, ambiente);
    const tpAmb = ambiente === 'producao' ? '1' : '2';
    const cUF = endpoints.cUF;
    const cnpj = apenasDigitos(empresa.cnpj);
    const dhEvento = formatarDataHoraSefaz(new Date());
    const seqStr = String(nSeqEvento).padStart(2, '0');
    const idEvento = `ID110110${chaveLimpa}${seqStr}`;

    const xCondUso = 'A Carta de Correcao e disciplinada pelo paragrafo 1o-A do art. 7o do Convenio S/N, de 15 de dezembro de 1970 e pode ser utilizada para regularizacao de erro ocorrido na emissao de documento fiscal, desde que o erro nao esteja relacionado com: I - as variaveis que determinam o valor do imposto tais como: base de calculo, aliquota, diferenca de preco, quantidade, valor da operacao ou da prestacao; II - a correcao de dados cadastrais que implique mudanca do remetente ou do destinatario; III - a data de emissao ou de saida.';

    const xmlEvento = `<?xml version="1.0" encoding="UTF-8"?>
<evento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00">
    <infEvento Id="${idEvento}">
        <cOrgao>${cUF}</cOrgao>
        <tpAmb>${tpAmb}</tpAmb>
        <CNPJ>${cnpj}</CNPJ>
        <chNFe>${chaveLimpa}</chNFe>
        <dhEvento>${dhEvento}</dhEvento>
        <tpEvento>110110</tpEvento>
        <nSeqEvento>${nSeqEvento}</nSeqEvento>
        <verEvento>1.00</verEvento>
        <detEvento versao="1.00">
            <descEvento>Carta de Correcao</descEvento>
            <xCorrecao>${xCorrecao}</xCorrecao>
            <xCondUso>${xCondUso}</xCondUso>
        </detEvento>
    </infEvento>
</evento>`.trim();

    const eventoAssinadoXml = assinarXmlEvento(
        xmlEvento,
        empresa.certificadoBase64,
        empresa.certificadoSenha || '',
        idEvento
    );

    console.log(`[SEFAZ EVENTO] Transmitindo CC-e chave ${chaveLimpa} seq ${nSeqEvento} para ${endpoints.eventoUrl}...`);

    const respostaSoap = await transmitirEvento(
        endpoints.eventoUrl,
        eventoAssinadoXml,
        empresa.certificadoBase64,
        empresa.certificadoSenha || ''
    );

    const resultado = processarRespostaEvento(respostaSoap);
    return resultado;
}

/**
 * Transmite à SEFAZ uma NFC-e previamente emitida e assinada em contingência off-line
 * @param {string} xmlAssinado XML assinado da nota emitida em contingência
 * @param {string} chave Chave de acesso de 44 dígitos
 * @param {Object} empresa Configuração da empresa
 * @param {'65'|'55'} modelo Modelo da nota
 */
async function transmitirNotaContingenciaSefaz(xmlAssinado, chave, empresa, modelo = '65') {
    if (!empresa.certificadoBase64) {
        throw new Error('Certificado Digital A1 (.pfx) não configurado.');
    }
    const ambiente = empresa.ambienteFiscal === 'producao' ? 'producao' : 'homologacao';
    const endpoints = obterEndpointsSefaz(modelo, empresa.uf, ambiente);

    console.log(`[SEFAZ CONTINGÊNCIA] Transmitindo nota pendente chave ${chave} para ${endpoints.autorizacaoUrl}...`);

    const respostaSoap = await transmitirLoteSefaz(
        endpoints.autorizacaoUrl,
        xmlAssinado,
        empresa.certificadoBase64,
        empresa.certificadoSenha || '',
        '1'
    );

    const resultado = processarRespostaSefaz(respostaSoap, xmlAssinado);
    return {
        ...resultado,
        ambiente
    };
}

module.exports = {
    emitirNotaDiretoSefaz,
    cancelarNotaDiretoSefaz,
    cartaCorrecaoDiretoSefaz,
    transmitirNotaContingenciaSefaz
};
