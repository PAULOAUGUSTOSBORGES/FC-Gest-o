// ==============================================================
// MOTOR FISCAL AUTÔNOMO SEFAZ DIRETO (GRATUITO)
// Orquestrador de Emissão, Assinatura e Cancelamento Direto na SEFAZ
// ==============================================================

const crypto = require('crypto');
const { obterEndpointsSefaz } = require('./sefaz_urls');
const { construirXmlNota, formatarDataHoraSefaz, limparTexto, apenasDigitos } = require('./sefaz_xml_builder');
const { assinarXmlNota, extrairChavesDoPfx } = require('./sefaz_signer');
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
async function emitirNotaDiretoSefaz(modelo, venda, empresa, itens, cliente = null) {
    if (!empresa.certificadoBase64) {
        throw new Error('Certificado Digital A1 (.pfx) não configurado. Acesse Configurações > Emissor Fiscal para fazer o upload do seu certificado.');
    }

    const ambiente = empresa.ambienteFiscal === 'producao' ? 'producao' : 'homologacao';
    const endpoints = obterEndpointsSefaz(modelo, empresa.uf, ambiente);

    // 1. Constrói o XML padrão MOC 4.00
    const xmlGerado = construirXmlNota({
        empresa,
        venda,
        itens,
        cliente,
        modelo,
        ambiente,
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

    // 3. Transmite para a SEFAZ via mTLS
    const respostaSoap = await transmitirLoteSefaz(
        endpoints.autorizacaoUrl,
        xmlAssinado,
        empresa.certificadoBase64,
        empresa.certificadoSenha || '',
        '1'
    );

    console.log(`[SEFAZ DIRETO] Resposta bruta SEFAZ (${endpoints.autorizacaoUrl}):`, typeof respostaSoap === 'string' ? respostaSoap.substring(0, 800) : JSON.stringify(respostaSoap));

    // 4. Processa o retorno da SEFAZ
    const resultado = processarRespostaSefaz(respostaSoap, xmlAssinado);

    if (resultado.sucesso) {
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

    if (!justificativa || justificativa.trim().length < 15) {
        throw new Error('A justificativa de cancelamento deve conter no mínimo 15 caracteres.');
    }

    const ambiente = empresa.ambienteFiscal === 'producao' ? 'producao' : 'homologacao';
    const endpoints = obterEndpointsSefaz(modelo, empresa.uf, ambiente);
    const tpAmb = ambiente === 'producao' ? '1' : '2';
    const cUF = endpoints.cUF;
    const cnpj = apenasDigitos(empresa.cnpj);
    const dhEvento = formatarDataHoraSefaz(new Date());
    const xJust = limparTexto(justificativa);
    const idEvento = `ID110111${chave}01`;

    // Monta XML do Evento de Cancelamento (110111)
    const xmlEvento = `<?xml version="1.0" encoding="UTF-8"?>
<evento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00">
    <infEvento Id="${idEvento}">
        <cOrgao>${cUF}</cOrgao>
        <tpAmb>${tpAmb}</tpAmb>
        <CNPJ>${cnpj}</CNPJ>
        <chNFe>${chave}</chNFe>
        <dhEvento>${dhEvento}</dhEvento>
        <tpEvento>110111</tpEvento>
        <nSeqEvento>1</nSeqEvento>
        <verEvento>1.00</verEvento>
        <detEvento versao="1.00">
            <descEvento>Cancelamento</descEvento>
            <nProt>${protocolo}</nProt>
            <xJust>${xJust}</xJust>
        </detEvento>
    </infEvento>
</evento>`.trim();

    // Assina o evento
    const { privateKeyPem, certLimpo } = extrairChavesDoPfx(empresa.certificadoBase64, empresa.certificadoSenha || '');
    
    // Canonicalização C14N da tag <infEvento>
    const matchInfEvento = xmlEvento.match(/<infEvento[\s\S]*?<\/infEvento>/);
    const infEventoC14N = matchInfEvento[0].replace(/>\s+</g, '><').trim();
    const digestValue = crypto.createHash('sha1').update(infEventoC14N, 'utf8').digest('base64');

    const signedInfo = `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#"><CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"></CanonicalizationMethod><SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"></SignatureMethod><Reference URI="#${idEvento}"><Transforms><Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"></Transform><Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"></Transform></Transforms><DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"></DigestMethod><DigestValue>${digestValue}</DigestValue></Reference></SignedInfo>`;

    const signer = crypto.createSign('RSA-SHA1');
    signer.update(signedInfo, 'utf8');
    const signatureValue = signer.sign(privateKeyPem, 'base64');

    const signatureXml = `
<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
    ${signedInfo}
    <SignatureValue>${signatureValue}</SignatureValue>
    <KeyInfo>
        <X509Data>
            <X509Certificate>${certLimpo}</X509Certificate>
        </X509Data>
    </KeyInfo>
</Signature>`;

    const eventoAssinadoXml = xmlEvento.replace('</evento>', `${signatureXml}\n</evento>`);

    // Transmite para o Web Service de Evento
    const respostaSoap = await transmitirEvento(
        endpoints.eventoUrl,
        eventoAssinadoXml,
        empresa.certificadoBase64,
        empresa.certificadoSenha || ''
    );

    const resultado = processarRespostaEvento(respostaSoap);
    return resultado;
}

module.exports = {
    emitirNotaDiretoSefaz,
    cancelarNotaDiretoSefaz
};
