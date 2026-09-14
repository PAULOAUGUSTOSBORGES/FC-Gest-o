// ==============================================================
// CLIENTE DE TRANSMISSÃO SOAP mTLS COM WEBSERVICES DA SEFAZ
// Protocolo SOAP 1.2 com Autenticação Mútua via Certificado A1
// ==============================================================

const https = require('https');
const axios = require('axios');

/**
 * Cria o agente HTTPS com autenticação mTLS usando o Certificado Digital A1
 * @param {string} pfxBase64 Arquivo .pfx codificado em Base64
 * @param {string} senha Senha do certificado
 */
function criarAgenteMtls(pfxBase64, senha = '') {
    const pfxBuffer = Buffer.from(pfxBase64, 'base64');
    return new https.Agent({
        pfx: pfxBuffer,
        passphrase: senha,
        rejectUnauthorized: false // Permite a comunicação com os certificados da SEFAZ
    });
}

/**
 * Envia o lote da NF-e / NFC-e de forma síncrona para a SEFAZ
 * @param {string} urlAutorizacao URL do Web Service de Autorização da SEFAZ
 * @param {string} xmlAssinado XML assinado da nota
 * @param {string} pfxBase64 Certificado em Base64
 * @param {string} senha Senha do certificado
 * @param {string|number} idLote Número identificador do lote (ex: 1)
 * @returns {Promise<string>} Resposta XML pura da SEFAZ
 */
async function transmitirLoteSefaz(urlAutorizacao, xmlAssinado, pfxBase64, senha, idLote = '1') {
    const agente = criarAgenteMtls(pfxBase64, senha);

    // Remove qualquer declaração <?xml ... ?> interna para que o XML do lote SOAP seja 100% válido
    const xmlNFeLimpo = String(xmlAssinado || '').replace(/<\?xml.*?\?>/gi, '').trim();

    // Envelope SOAP 1.2 oficial do MOC 4.00 com indSinc=1 (Processamento Síncrono Imediato)
    const envelopeSoap = `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
    <soap12:Body>
        <nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4">
            <enviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
                <idLote>${idLote}</idLote>
                <indSinc>1</indSinc>
                ${xmlNFeLimpo}
            </enviNFe>
        </nfeDadosMsg>
    </soap12:Body>
</soap12:Envelope>`.trim();

    try {
        const soapActionLote = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4/nfeAutorizacaoLote';
        const response = await axios.post(urlAutorizacao, envelopeSoap, {
            httpsAgent: agente,
            headers: {
                'Content-Type': `application/soap+xml; charset=utf-8; action="${soapActionLote}"`,
                'SOAPAction': soapActionLote
            },
            timeout: 30000 // 30 segundos
        });

        return response.data;
    } catch (err) {
        if (err.response && err.response.data) {
            return err.response.data;
        }
        throw new Error(`Erro na conexão com o servidor da SEFAZ (${urlAutorizacao}): ${err.message}`);
    }
}

/**
 * Envia um Evento (ex: Cancelamento ou CC-e) para a SEFAZ
 * @param {string} urlEvento URL do Web Service de Evento
 * @param {string} eventoAssinadoXml XML do evento assinado
 * @param {string} pfxBase64 Certificado em Base64
 * @param {string} senha Senha do certificado
 */
async function transmitirEvento(urlEvento, eventoAssinadoXml, pfxBase64, senha, idLote = '1') {
    const agente = criarAgenteMtls(pfxBase64, senha);

    const eventoLimpo = String(eventoAssinadoXml || '').replace(/<\?xml.*?\?>/gi, '').trim();

    const envelopeSoap = `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
    <soap12:Body>
        <nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4">
            <envEvento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00">
                <idLote>${idLote}</idLote>
                ${eventoLimpo}
            </envEvento>
        </nfeDadosMsg>
    </soap12:Body>
</soap12:Envelope>`.trim();

    try {
        const soapActionEvento = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4/nfeRecepcaoEvento';
        const response = await axios.post(urlEvento, envelopeSoap, {
            httpsAgent: agente,
            headers: {
                'Content-Type': `application/soap+xml; charset=utf-8; action="${soapActionEvento}"`,
                'SOAPAction': soapActionEvento
            },
            timeout: 30000
        });

        return response.data;
    } catch (err) {
        if (err.response && err.response.data) {
            return err.response.data;
        }
        throw new Error(`Erro no envio de evento para a SEFAZ: ${err.message}`);
    }
}

module.exports = {
    criarAgenteMtls,
    transmitirLoteSefaz,
    transmitirEvento
};
