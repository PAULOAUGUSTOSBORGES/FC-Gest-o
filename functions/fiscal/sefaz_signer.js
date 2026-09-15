// ==============================================================
// ASSINADOR DIGITAL ICP-BRASIL PARA NF-e / NFC-e (XML-DSig)
// Padrão W3C Enveloped Signature com Certificado Digital A1 (.pfx)
// Canonicalização W3C C14N (REC-xml-c14n-20010315) e RSA-SHA1
// ==============================================================

const forge = require('node-forge');
const { SignedXml } = require('xml-crypto');

/**
 * Extrai a chave privada RSA e o certificado X.509 em formato PEM a partir do PFX (Base64)
 * @param {string} pfxBase64 Arquivo .pfx codificado em Base64
 * @param {string} senha Senha do certificado
 */
function extrairChavesDoPfx(pfxBase64, senha = '') {
    try {
        const cleanB64 = String(pfxBase64 || '').replace(/[\r\n\s]+/g, '');
        const p12Der = Buffer.from(cleanB64, 'base64').toString('binary');
        const p12Asn1 = forge.asn1.fromDer(p12Der);
        const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, String(senha || ''));

        let privateKeyPem = null;
        let certificatePem = null;

        // Extrai Chave Privada
        const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] ||
                        p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] || [];

        if (keyBags.length > 0 && keyBags[0].key) {
            privateKeyPem = forge.pki.privateKeyToPem(keyBags[0].key);
        }

        // Extrai Certificado
        const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || [];
        if (certBags.length > 0 && certBags[0].cert) {
            certificatePem = forge.pki.certificateToPem(certBags[0].cert);
        }

        if (!privateKeyPem) {
            throw new Error('Chave privada RSA não encontrada no arquivo .pfx. Verifique a senha informada.');
        }

        if (!certificatePem) {
            throw new Error('Certificado X.509 não encontrado no arquivo .pfx.');
        }

        // Certificado limpo sem cabeçalhos para inclusão ou conferência
        const certLimpo = certificatePem
            .replace(/-----BEGIN CERTIFICATE-----/g, '')
            .replace(/-----END CERTIFICATE-----/g, '')
            .replace(/\r?\n|\r/g, '')
            .trim();

        return {
            privateKeyPem,
            certificatePem,
            certLimpo
        };
    } catch (err) {
        if (err.message && err.message.includes('MAC could not be verified')) {
            throw new Error('Senha do Certificado Digital A1 incorreta. Verifique a senha de instalação/exportação do arquivo .pfx.');
        }
        throw new Error(`Falha ao ler o Certificado A1: ${err.message}`);
    }
}

/**
 * Assina digitalmente o XML da NF-e ou NFC-e conforme a especificação do MOC SEFAZ (W3C XML-DSig C14N)
 * @param {string} xmlString XML gerado da NF-e / NFC-e
 * @param {string} pfxBase64 Arquivo .pfx em Base64
 * @param {string} senha Senha do certificado
 * @param {string} chaveAcesso Chave de 44 dígitos da nota (opcional, Id extraído automaticamente)
 * @returns {string} XML completo assinado com a tag <Signature>
 */
function assinarXmlNota(xmlString, pfxBase64, senha, chaveAcesso = null) {
    const { privateKeyPem, certificatePem } = extrairChavesDoPfx(pfxBase64, senha);

    // Minifica o XML removendo espaços e quebras supérfluos entre tags estruturais
    const xmlLimpo = String(xmlString || '').replace(/>\s+</g, '><').trim();

    const sig = new SignedXml({
        privateKey: privateKeyPem,
        publicCert: certificatePem,
        signatureAlgorithm: "http://www.w3.org/2000/09/xmldsig#rsa-sha1",
        canonicalizationAlgorithm: "http://www.w3.org/TR/2001/REC-xml-c14n-20010315"
    });

    sig.addReference({
        xpath: "//*[local-name(.)='infNFe']",
        transforms: [
            "http://www.w3.org/2000/09/xmldsig#enveloped-signature",
            "http://www.w3.org/TR/2001/REC-xml-c14n-20010315"
        ],
        digestAlgorithm: "http://www.w3.org/2000/09/xmldsig#sha1"
    });

    // No schema da SEFAZ (leiauteNFe_v4.00.xsd), a tag <Signature> deve vir após <infNFeSupl> (NFC-e)
    // ou após <infNFe> (NF-e). Colocar <Signature> antes de <infNFeSupl> gera Rejeição 225 (Falha no Schema XML).
    const hasSupl = xmlLimpo.includes('infNFeSupl');
    sig.computeSignature(xmlLimpo, {
        location: {
            reference: hasSupl ? "//*[local-name(.)='infNFeSupl']" : "//*[local-name(.)='infNFe']",
            action: "after"
        }
    });

    return sig.getSignedXml();
}

/**
 * Assina digitalmente o XML de um Evento (ex: Cancelamento 110111 ou Carta de Correção)
 * @param {string} xmlEventoString XML do evento
 * @param {string} pfxBase64 Arquivo .pfx em Base64
 * @param {string} senha Senha do certificado
 * @param {string} idEvento Identificador do evento (ex: ID110111...)
 * @returns {string} XML do evento assinado com a tag <Signature>
 */
function assinarXmlEvento(xmlEventoString, pfxBase64, senha, idEvento = null) {
    const { privateKeyPem, certificatePem } = extrairChavesDoPfx(pfxBase64, senha);

    const xmlLimpo = String(xmlEventoString || '').replace(/>\s+</g, '><').trim();

    const sig = new SignedXml({
        privateKey: privateKeyPem,
        publicCert: certificatePem,
        signatureAlgorithm: "http://www.w3.org/2000/09/xmldsig#rsa-sha1",
        canonicalizationAlgorithm: "http://www.w3.org/TR/2001/REC-xml-c14n-20010315"
    });

    sig.addReference({
        xpath: "//*[local-name(.)='infEvento']",
        transforms: [
            "http://www.w3.org/2000/09/xmldsig#enveloped-signature",
            "http://www.w3.org/TR/2001/REC-xml-c14n-20010315"
        ],
        digestAlgorithm: "http://www.w3.org/2000/09/xmldsig#sha1"
    });

    sig.computeSignature(xmlLimpo, {
        location: {
            reference: "//*[local-name(.)='infEvento']",
            action: "after"
        }
    });

    return sig.getSignedXml();
}

module.exports = {
    extrairChavesDoPfx,
    assinarXmlNota,
    assinarXmlEvento
};
