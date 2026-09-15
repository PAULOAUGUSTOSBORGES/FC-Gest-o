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
        // 1. Extrai blocos oficiais se existirem
        const matchProtNFe = respostaSoapXml.match(/<protNFe[\s\S]*?<\/protNFe>/i);
        const matchRetEnviNFe = respostaSoapXml.match(/<retEnviNFe[\s\S]*?<\/retEnviNFe>/i);

        let cStat = '';
        let xMotivo = '';
        let nProt = '';
        let dhRecbto = '';

        if (matchProtNFe) {
            const matchCStat = matchProtNFe[0].match(/<cStat>(\d+)<\/cStat>/i);
            const matchXMot = matchProtNFe[0].match(/<xMotivo>([\s\S]*?)<\/xMotivo>/i);
            const matchProt = matchProtNFe[0].match(/<nProt>(\d+)<\/nProt>/i);
            const matchDh = matchProtNFe[0].match(/<dhRecbto>([\s\S]*?)<\/dhRecbto>/i);
            cStat = matchCStat ? matchCStat[1] : '';
            xMotivo = matchXMot ? matchXMot[1].trim() : '';
            nProt = matchProt ? matchProt[1] : '';
            dhRecbto = matchDh ? matchDh[1].trim() : '';
        } else if (matchRetEnviNFe) {
            const matchCStat = matchRetEnviNFe[0].match(/<cStat>(\d+)<\/cStat>/i);
            const matchXMot = matchRetEnviNFe[0].match(/<xMotivo>([\s\S]*?)<\/xMotivo>/i);
            cStat = matchCStat ? matchCStat[1] : '';
            xMotivo = matchXMot ? matchXMot[1].trim() : '';
        }

        // 2. Se não achou cStat ainda, faz busca no documento inteiro
        if (!cStat) {
            const matchCStat = respostaSoapXml.match(/<cStat>(\d+)<\/cStat>/i);
            const matchXMot = respostaSoapXml.match(/<xMotivo>([\s\S]*?)<\/xMotivo>/i);
            if (matchCStat) {
                cStat = matchCStat[1];
                xMotivo = matchXMot ? matchXMot[1].trim() : '';
            }
        }

        // 3. Se ainda assim não achou cStat, verifica se é SOAP Fault ou resposta de erro
        if (!cStat) {
            const matchFaultReason = respostaSoapXml.match(/<(?:\w+:)?Text[^>]*>([\s\S]*?)<\/(?:\w+:)?Text>/i);
            const matchFaultString = respostaSoapXml.match(/<faultstring>([\s\S]*?)<\/faultstring>/i);
            const matchDetail = respostaSoapXml.match(/<(?:\w+:)?detail>([\s\S]*?)<\/(?:\w+:)?detail>/i);

            if (matchFaultReason || matchFaultString) {
                cStat = 'SOAP_FAULT';
                xMotivo = (matchFaultReason ? matchFaultReason[1] : matchFaultString[1]).trim();
                if (matchDetail) {
                    const cleanDetail = matchDetail[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
                    if (cleanDetail) xMotivo += ` (${cleanDetail})`;
                }
            } else if (respostaSoapXml.includes('<html') || respostaSoapXml.includes('<!DOCTYPE html>')) {
                const matchTitle = respostaSoapXml.match(/<title>([\s\S]*?)<\/title>/i);
                cStat = 'HTTP_HTML';
                xMotivo = `Servidor SEFAZ retornou bloqueio ou erro HTTP: ${matchTitle ? matchTitle[1].trim() : 'Acesso Negado'}`;
            } else {
                cStat = '999';
                const textoLimpo = respostaSoapXml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
                xMotivo = textoLimpo ? `SEFAZ: ${textoLimpo.slice(0, 180)}` : 'Resposta não reconhecida pela SEFAZ.';
            }
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
    if (!respostaSoapXml || typeof respostaSoapXml !== 'string') {
        return { sucesso: false, cStat: '999', xMotivo: 'Sem resposta da SEFAZ.' };
    }

    try {
        let cStat = '';
        let xMotivo = '';
        let nProt = '';

        // 1. Tenta extrair primeiro do bloco <retEvento> / <infEvento> (resultado específico do evento)
        const matchRetEvento = respostaSoapXml.match(/<(?:[a-zA-Z0-9]+:)?retEvento[\s\S]*?<\/(?:[a-zA-Z0-9]+:)?retEvento>/i);
        if (matchRetEvento) {
            const xmlRet = matchRetEvento[0];
            const matchCStat = xmlRet.match(/<(?:[a-zA-Z0-9]+:)?cStat>(\d+)<\/(?:[a-zA-Z0-9]+:)?cStat>/i);
            const matchXMotivo = xmlRet.match(/<(?:[a-zA-Z0-9]+:)?xMotivo>([\s\S]*?)<\/(?:[a-zA-Z0-9]+:)?xMotivo>/i);
            const matchNProt = xmlRet.match(/<(?:[a-zA-Z0-9]+:)?nProt>(\d+)<\/(?:[a-zA-Z0-9]+:)?nProt>/i);

            if (matchCStat) cStat = matchCStat[1];
            if (matchXMotivo) xMotivo = matchXMotivo[1].trim();
            if (matchNProt) nProt = matchNProt[1].trim();
        }

        // 2. Se não achou em retEvento, verifica o lote em <retEnvEvento>
        if (!cStat) {
            const matchRetEnv = respostaSoapXml.match(/<(?:[a-zA-Z0-9]+:)?retEnvEvento[\s\S]*?<\/(?:[a-zA-Z0-9]+:)?retEnvEvento>/i);
            if (matchRetEnv) {
                const xmlEnv = matchRetEnv[0];
                const matchCStat = xmlEnv.match(/<(?:[a-zA-Z0-9]+:)?cStat>(\d+)<\/(?:[a-zA-Z0-9]+:)?cStat>/i);
                const matchXMotivo = xmlEnv.match(/<(?:[a-zA-Z0-9]+:)?xMotivo>([\s\S]*?)<\/(?:[a-zA-Z0-9]+:)?xMotivo>/i);
                if (matchCStat) cStat = matchCStat[1];
                if (matchXMotivo) xMotivo = matchXMotivo[1].trim();
            }
        }

        // 3. Fallback genérico no documento inteiro
        if (!cStat) {
            const matchCStat = respostaSoapXml.match(/<(?:[a-zA-Z0-9]+:)?cStat>(\d+)<\/(?:[a-zA-Z0-9]+:)?cStat>/i);
            const matchXMotivo = respostaSoapXml.match(/<(?:[a-zA-Z0-9]+:)?xMotivo>([\s\S]*?)<\/(?:[a-zA-Z0-9]+:)?xMotivo>/i);
            if (matchCStat) cStat = matchCStat[1];
            if (matchXMotivo) xMotivo = matchXMotivo[1].trim();
        }

        // 4. Verificação de SOAP Fault ou erro HTTP
        if (!cStat) {
            const matchFaultReason = respostaSoapXml.match(/<(?:\w+:)?Text[^>]*>([\s\S]*?)<\/(?:\w+:)?Text>/i);
            const matchFaultString = respostaSoapXml.match(/<faultstring>([\s\S]*?)<\/faultstring>/i);
            const matchDetail = respostaSoapXml.match(/<(?:\w+:)?detail>([\s\S]*?)<\/(?:\w+:)?detail>/i);

            if (matchFaultReason || matchFaultString) {
                cStat = 'SOAP_FAULT';
                xMotivo = (matchFaultReason ? matchFaultReason[1] : matchFaultString[1]).trim();
                if (matchDetail) {
                    const cleanDetail = matchDetail[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
                    if (cleanDetail) xMotivo += ` (${cleanDetail})`;
                }
            } else if (respostaSoapXml.includes('<html') || respostaSoapXml.includes('<!DOCTYPE html>')) {
                const matchTitle = respostaSoapXml.match(/<title>([\s\S]*?)<\/title>/i);
                cStat = 'HTTP_HTML';
                xMotivo = `Servidor SEFAZ retornou bloqueio ou erro HTTP: ${matchTitle ? matchTitle[1].trim() : 'Acesso Negado'}`;
            } else {
                cStat = '999';
                const textoLimpo = respostaSoapXml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
                xMotivo = textoLimpo ? `SEFAZ: ${textoLimpo.slice(0, 180)}` : 'Resposta não reconhecida pela SEFAZ.';
            }
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
            xMotivo: `Erro ao processar retorno do evento: ${err.message}`,
            respostaOriginal: respostaSoapXml
        };
    }
}

module.exports = {
    processarRespostaSefaz,
    gerarUrlQrCodeNFCe,
    processarRespostaEvento
};
