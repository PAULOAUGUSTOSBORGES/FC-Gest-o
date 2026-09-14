// ==============================================================
// ASSINADOR DIGITAL ICP-BRASIL PARA NF-e / NFC-e (XML-DSig)
// Padrão W3C Enveloped Signature com Certificado Digital A1 (.pfx)
// ==============================================================

const crypto = require('crypto');
const forge = require('node-forge');

/**
 * Extrai a chave privada RSA e o certificado X.509 em formato PEM a partir do PFX (Base64)
 * @param {string} pfxBase64 Arquivo .pfx codificado em Base64
 * @param {string} senha Senha do certificado
 */
function extrairChavesDoPfx(pfxBase64, senha = '') {
    try {
        const p12Der = forge.util.decode64(pfxBase64);
        const p12Asn1 = forge.asn1.fromDer(p12Der);
        const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, senha || '');

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

        // Certificado limpo sem headers para a tag <X509Certificate>
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
        throw new Error(`Falha ao ler o Certificado A1: ${err.message}`);
    }
}

/**
 * Aplica canonicalização C14N simples no trecho XML (remoção de espaços supérfluos entre tags)
 */
function canonicalizarXml(xml) {
    return xml
        .replace(/>\s+</g, '><')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .trim();
}

/**
 * Assina digitalmente o XML da NF-e ou NFC-e conforme a especificação do MOC SEFAZ
 * @param {string} xmlString XML gerado da NF-e / NFC-e
 * @param {string} pfxBase64 Arquivo .pfx em Base64
 * @param {string} senha Senha do certificado
 * @param {string} chaveAcesso Chave de 44 dígitos da nota
 * @returns {string} XML completo assinado com a tag <Signature>
 */
function assinarXmlNota(xmlString, pfxBase64, senha, chaveAcesso) {
    const { privateKeyPem, certLimpo } = extrairChavesDoPfx(pfxBase64, senha);

    // 1. Localiza a tag <infNFe ...>...</infNFe>
    const matchInfNFe = xmlString.match(/<infNFe[\s\S]*?<\/infNFe>/);
    if (!matchInfNFe) {
        throw new Error('Elemento <infNFe> não encontrado no XML da nota fiscal.');
    }
    const infNFeConteudo = matchInfNFe[0];

    // 2. Canonicalização C14N da tag <infNFe>
    const infNFeC14N = canonicalizarXml(infNFeConteudo);

    // 3. Cálculo do DigestValue (SHA-1)
    const digestValue = crypto.createHash('sha1').update(infNFeC14N, 'utf8').digest('base64');

    // 4. Construção da tag <SignedInfo> (conforme W3C XML-DSig)
    const signedInfo = `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#"><CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"></CanonicalizationMethod><SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"></SignatureMethod><Reference URI="#NFe${chaveAcesso}"><Transforms><Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"></Transform><Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"></Transform></Transforms><DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"></DigestMethod><DigestValue>${digestValue}</DigestValue></Reference></SignedInfo>`;

    // 5. Assinatura do <SignedInfo> usando RSA-SHA1 com a chave privada do certificado A1
    const signer = crypto.createSign('RSA-SHA1');
    signer.update(signedInfo, 'utf8');
    const signatureValue = signer.sign(privateKeyPem, 'base64');

    // 6. Montagem do bloco <Signature>
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

    // 7. Inserção da <Signature> antes do fechamento de </NFe>
    const xmlAssinado = xmlString.replace('</NFe>', `${signatureXml}\n</NFe>`);

    return xmlAssinado;
}

module.exports = {
    extrairChavesDoPfx,
    assinarXmlNota
};
