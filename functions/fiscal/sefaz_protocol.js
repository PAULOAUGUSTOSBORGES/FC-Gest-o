// ==============================================================
// PROCESSADOR DE PROTOCOLOS SEFAZ & GERADOR DE QR-CODE NFC-E
// Montagem do <nfeProc> oficial de distribuição e validação de retorno
// ==============================================================

const crypto = require('crypto');
const { XMLParser } = require('fast-xml-parser');

const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_'
});

/**
 * Processa o XML retornado pelo Web Service da SEFAZ
 * @param {string} respostaSoapXml Resposta bruta do servidor
 * @param {string} xmlAssinado XML assinado original enviado
 * @returns {Object} Dados tratados: autorizado, cStat, xMotivo, nProt, dhRecbto, xmlProc
 */
function processarRespostaSefaz(respostaSoapXml, xmlAssinado) {
    if (!respostaSoapXml || typeof respostaSoapXml !== 'string') {
        return {
            sucesso: false,
            cStat: '999',
            xMotivo: 'Resposta vazia ou inválida recebida da SEFAZ.'
        };
    }

    try {
        // Extrai o bloco <protNFe>...</protNFe>
        const matchProtNFe = respostaSoapXml.match(/<protNFe[\s\S]*?<\/protNFe>/);
        const matchRetEnviNFe = respostaSoapXml.match(/<retEnviNFe[\s\S]*?<\/retEnviNFe>/);

        let cStat = '';
        let xMotivo = '';
        let nProt = '';
        let dhRecbto = '';

        if (matchProtNFe) {
            const parsedProt = parser.parse(matchProtNFe[0]);
            const infProt = parsedProt?.protNFe?.infProt || {};
            cStat = String(infProt.cStat || '');
            xMotivo = String(infProt.xMotivo || '');
            nProt = String(infProt.nProt || '');
            dhRecbto = String(infProt.dhRecbto || '');
        } else if (matchRetEnviNFe) {
            const parsedRet = parser.parse(matchRetEnviNFe[0]);
            const ret = parsedRet?.retEnviNFe || {};
            cStat = String(ret.cStat || '');
            xMotivo = String(ret.xMotivo || '');
        } else {
            // Busca genérica por cStat e xMotivo
            const matchCStat = respostaSoapXml.match(/<cStat>(\d+)<\/cStat>/);
            const matchXMotivo = respostaSoapXml.match(/<xMotivo>(.*?)<\/xMotivo>/);
            cStat = matchCStat ? matchCStat[1] : '999';
            xMotivo = matchXMotivo ? matchXMotivo[1] : 'Resposta não reconhecida pela SEFAZ.';
        }

        // cStat 100 = Autorizado o uso da NF-e / NFC-e
        // cStat 150 = Autorizado fora do prazo
        const autorizado = (cStat === '100' || cStat === '150');

        let xmlProc = null;
        if (autorizado && matchProtNFe) {
            // Monta o XML Oficial de Distribuição: <nfeProc> contendo <NFe> + <protNFe>
            xmlProc = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
    ${xmlAssinado.replace(/<\?xml.*?\?>/g, '').trim()}
    ${matchProtNFe[0].trim()}
</nfeProc>`.trim();
        }

        return {
            sucesso: autorizado,
            cStat,
            xMotivo,
            nProt,
            dhRecbto,
            xmlProc: xmlProc || xmlAssinado,
            respostaOriginal: respostaSoapXml
        };
    } catch (err) {
        return {
            sucesso: false,
            cStat: '998',
            xMotivo: `Erro ao interpretar retorno da SEFAZ: ${err.message}`,
            respostaOriginal: respostaSoapXml
        };
    }
}

/**
 * Gera a URL oficial do QR-Code da NFC-e (Layout MOC 2.00)
 * @param {Object} params Parâmetros para o cálculo do QR-Code
 * @returns {string} URL completa pronta para gerar a imagem do QR-Code
 */
function gerarUrlQrCodeNFCe(params) {
    const chaveAcesso = params.chaveAcesso || params.chave || '';
    const tpAmb = params.tpAmb || (params.ambiente === 'producao' ? '1' : '2');
    const cscId = params.cscId || '000001';
    const cscToken = params.cscToken || '';
    const qrCodeBaseUrl = params.qrCodeBaseUrl || 'https://www.sefaz.rs.gov.br/NFCE/NFCE-COM.aspx';

    // Remove zeros à esquerda do cscId para a composição
    const idToken = String(parseInt(cscId, 10) || 1).padStart(6, '0');
    const tokenCscLimpo = String(cscToken || '').trim();

    // Composição para o Hash SHA-1: chNFe + | + 2 + | + tpAmb + | + cIdToken + cscToken
    const textoParaHash = `${chaveAcesso}|2|${tpAmb}|${parseInt(idToken, 10)}${tokenCscLimpo}`;
    const hashHex = crypto.createHash('sha1').update(textoParaHash, 'utf8').digest('hex').toLowerCase();

    // Parâmetro 'p': chNFe|2|tpAmb|cIdToken|hash
    const paramP = `${chaveAcesso}|2|${tpAmb}|${parseInt(idToken, 10)}|${hashHex}`;

    const separador = qrCodeBaseUrl.includes('?') ? '&' : '?';
    return `${qrCodeBaseUrl}${separador}p=${paramP}`;
}

/**
 * Processa a resposta do cancelamento ou CC-e
 */
function processarRespostaEvento(respostaSoapXml) {
    if (!respostaSoapXml) {
        return { sucesso: false, cStat: '999', xMotivo: 'Sem resposta da SEFAZ.' };
    }

    try {
        const matchRetEvento = respostaSoapXml.match(/<retEvento[\s\S]*?<\/retEvento>/);
        let cStat = '';
        let xMotivo = '';
        let nProt = '';

        if (matchRetEvento) {
            const parsed = parser.parse(matchRetEvento[0]);
            const infEvento = parsed?.retEvento?.infEvento || {};
            cStat = String(infEvento.cStat || '');
            xMotivo = String(infEvento.xMotivo || '');
            nProt = String(infEvento.nProt || '');
        } else {
            const matchCStat = respostaSoapXml.match(/<cStat>(\d+)<\/cStat>/);
            const matchXMotivo = respostaSoapXml.match(/<xMotivo>(.*?)<\/xMotivo>/);
            cStat = matchCStat ? matchCStat[1] : '999';
            xMotivo = matchXMotivo ? matchXMotivo[1] : 'Resposta não reconhecida.';
        }

        // cStat 135 = Evento registrado e vinculado a NF-e
        // cStat 136 = Evento registrado, mas nao vinculado
        const sucesso = (cStat === '135' || cStat === '136');

        return {
            sucesso,
            cStat,
            xMotivo,
            nProt,
            respostaOriginal: respostaSoapXml
        };
    } catch (err) {
        return {
            sucesso: false,
            cStat: '998',
            xMotivo: `Erro ao processar retorno do evento: ${err.message}`
        };
    }
}

module.exports = {
    processarRespostaSefaz,
    gerarUrlQrCodeNFCe,
    processarRespostaEvento
};
