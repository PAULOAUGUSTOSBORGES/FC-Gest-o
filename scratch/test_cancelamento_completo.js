const path = require('path');
const assert = require('assert');

const functionsPath = 'g:/VERSOES DO SISTEMA/site sistema/FC-Gest-o/functions';
const { formatarDataHoraSefaz, limparTexto, apenasDigitos } = require(path.join(functionsPath, 'fiscal/sefaz_xml_builder'));
const { assinarXmlEvento } = require(path.join(functionsPath, 'fiscal/sefaz_signer'));
const { obterEndpointsSefaz } = require(path.join(functionsPath, 'fiscal/sefaz_urls'));
const { processarRespostaEvento } = require(path.join(functionsPath, 'fiscal/sefaz_protocol'));
const forge = require(path.join(functionsPath, 'node_modules/node-forge'));

console.log('=== INICIANDO TESTES DO CANCELAMENTO SEFAZ DIRETO ===\n');

// 1. Gera par de chaves e certificado PKCS#12 (.pfx) simulado para o teste de assinatura
const pki = forge.pki;
const keys = pki.rsa.generateKeyPair(1024);
const cert = pki.createCertificate();
cert.publicKey = keys.publicKey;
cert.serialNumber = '01';
cert.validity.notBefore = new Date();
cert.validity.notAfter = new Date();
cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);
const attrs = [{ name: 'commonName', value: 'EMPRESA TESTE LTDA' }];
cert.setSubject(attrs);
cert.setIssuer(attrs);
cert.sign(keys.privateKey);

const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], '123456');
const p12Der = forge.asn1.toDer(p12Asn1).getBytes();
const pfxBase64 = Buffer.from(p12Der, 'binary').toString('base64');
const senhaPfx = '123456';

// 2. Simulação dos dados da NFC-e Nº 797 (Venda ID: RywLwoKrMeSYWyss3tSr)
const vendaMock = {
    id: 'RywLwoKrMeSYWyss3tSr',
    numeroNotaFiscal: 797,
    status_fiscal: 'autorizado',
    fiscal_chave: 'NFe52240900000000000000650010000007971000007970',
    nfce: {
        chave_nfe: 'NFe52240900000000000000650010000007971000007970',
        protocolo: '', // Simulando caso onde o campo protocolo está vazio
        status_sefaz: 'autorizado'
    },
    fiscal_xml: `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
    <NFe><infNFe Id="NFe52240900000000000000650010000007971000007970"><ide><nNF>797</nNF></ide></infNFe></NFe>
    <protNFe versao="4.00"><infProt><tpAmb>2</tpAmb><verAplic>GO4.0</verAplic><chNFe>52240900000000000000650010000007971000007970</chNFe><dhRecbto>2026-09-15T10:00:00-03:00</dhRecbto><nProt>152240012345678</nProt><digVal>xyz=</digVal><cStat>100</cStat><xMotivo>Autorizado o uso da NF-e</xMotivo></infProt></protNFe>
</nfeProc>`
};

const empresaMock = {
    cnpj: '00.000.000/0001-91',
    uf: 'GO',
    ambienteFiscal: 'homologacao',
    certificadoBase64: pfxBase64,
    certificadoSenha: senhaPfx
};

// ==========================================
// TESTE 1: Limpeza da chave e extração do protocolo do XML
// ==========================================
console.log('[TESTE 1] Limpeza de chave e recuperação de protocolo...');
const rawChave = vendaMock.nfce.chave_nfe || vendaMock.fiscal_chave;
const chaveLimpa = String(rawChave).replace(/^NFe/i, '').replace(/\D/g, '').trim();

assert.strictEqual(chaveLimpa.length, 44, 'Chave deve ter exatamente 44 dígitos numéricos');
assert.strictEqual(chaveLimpa, '52240900000000000000650010000007971000007970', 'Chave deve ser limpa sem prefixo NFe');
console.log('✓ Chave limpa com sucesso:', chaveLimpa);

let protocolo = String(vendaMock.nfce.protocolo || '').replace(/\D/g, '').trim();
if (!protocolo || protocolo.length < 15) {
    const xml = vendaMock.fiscal_xml || '';
    const matchProt = xml.match(/<nProt>(\d{15})<\/nProt>/i) || xml.match(/<nProt>(\d+)<\/nProt>/i);
    if (matchProt && matchProt[1]) {
        protocolo = matchProt[1].trim();
    }
}

assert.strictEqual(protocolo, '152240012345678', 'Protocolo deve ter sido extraído do XML');
assert.strictEqual(protocolo.length, 15, 'Protocolo deve conter 15 dígitos');
console.log('✓ Protocolo recuperado do XML com sucesso:', protocolo);

// ==========================================
// TESTE 2: Validação da Justificativa
// ==========================================
console.log('\n[TESTE 2] Validação da Justificativa...');
const justificativaInvalida = 'Curta';
assert.ok(justificativaInvalida.trim().length < 15, 'Justificativa curta deve ser menor que 15');

const justificativaValida = 'Cancelamento solicitado pelo cliente devido a erro nos itens da compra';
const xJust = limparTexto(justificativaValida).trim();
assert.ok(xJust.length >= 15, 'Justificativa válida tem >= 15 caracteres');
console.log('✓ Justificativa validada:', xJust);

// ==========================================
// TESTE 3: Construção do XML do Evento e idEvento (54 dígitos)
// ==========================================
console.log('\n[TESTE 3] Construção do XML do Evento de Cancelamento...');
const endpoints = obterEndpointsSefaz('65', empresaMock.uf, empresaMock.ambienteFiscal);
const cUF = endpoints.cUF; // 52 para Goiás
const tpAmb = '2';
const cnpj = apenasDigitos(empresaMock.cnpj);
const dhEvento = formatarDataHoraSefaz(new Date());
const idEvento = `ID110111${chaveLimpa}01`;

assert.strictEqual(idEvento.length, 54, 'ID do evento deve ter exatamente 54 caracteres');
assert.ok(idEvento.startsWith('ID110111'), 'ID do evento deve começar com ID110111');
assert.ok(idEvento.endsWith('01'), 'ID do evento deve terminar com nSeqEvento 01');
assert.strictEqual(cUF, '52', 'cOrgao para GO deve ser 52');
assert.ok(dhEvento.endsWith('-03:00'), 'Data/hora deve ter timezone de Brasília -03:00');

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
            <nProt>${protocolo}</nProt>
            <xJust>${xJust}</xJust>
        </detEvento>
    </infEvento>
</evento>`.trim();

console.log('✓ XML montado com tags oficiais MOC 4.00.');

// ==========================================
// TESTE 4: Assinatura Digital do Evento (XML-DSig C14N)
// ==========================================
console.log('\n[TESTE 4] Assinatura Digital do Evento...');
const eventoAssinadoXml = assinarXmlEvento(xmlEvento, pfxBase64, senhaPfx, idEvento);

assert.ok(eventoAssinadoXml.includes('<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">'), 'XML deve conter tag Signature');
assert.ok(eventoAssinadoXml.includes(`URI="#${idEvento}"`), 'Signature Reference URI deve apontar para #' + idEvento);
assert.ok(eventoAssinadoXml.includes('<X509Certificate>'), 'Signature deve conter X509Certificate');
assert.ok(eventoAssinadoXml.indexOf('</infEvento>') < eventoAssinadoXml.indexOf('<Signature'), 'Signature deve vir após infEvento');
console.log('✓ Evento assinado digitalmente com sucesso!');

// ==========================================
// TESTE 5: Envelope SOAP 1.2 e Headers
// ==========================================
console.log('\n[TESTE 5] Envelope SOAP 1.2 e Headers...');
const idLote = '1';
const eventoLimpo = String(eventoAssinadoXml || '').replace(/<\?xml.*?\?>/gi, '').trim();
const envelopeSoap = `<?xml version="1.0" encoding="utf-8"?><soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body><nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4"><envEvento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00"><idLote>${idLote}</idLote>${eventoLimpo}</envEvento></nfeDadosMsg></soap12:Body></soap12:Envelope>`;

assert.ok(envelopeSoap.includes('xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"'), 'SOAP 1.2 namespace correto');
assert.ok(envelopeSoap.includes('xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4"'), 'nfeDadosMsg namespace correto');
assert.ok(envelopeSoap.includes('xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00"'), 'envEvento namespace correto');
assert.ok(!envelopeSoap.includes('<?xml version="1.0" encoding="UTF-8"?><evento'), 'XML declaration interna deve ter sido removida');

const soapActionEvento = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4/nfeRecepcaoEvento';
const headersSoap12 = {
    'Content-Type': `application/soap+xml; charset=utf-8; action="${soapActionEvento}"`,
    'SOAPAction': soapActionEvento
};

assert.strictEqual(headersSoap12['SOAPAction'], soapActionEvento, 'SOAPAction correto');
assert.ok(headersSoap12['Content-Type'].includes('action="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4/nfeRecepcaoEvento"'), 'Content-Type com action correto');
console.log('✓ Envelope SOAP 1.2 e cabeçalhos validados com sucesso.');

// ==========================================
// TESTE 6: Processamento de Resposta da SEFAZ
// ==========================================
console.log('\n[TESTE 6] Processamento de Retornos da SEFAZ...');

// 6.1 Resposta com cStat 135 (Sucesso)
const respSefaz135 = `
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">
  <soap:Body>
    <nfeResultMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4">
      <retEnvEvento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00">
        <idLote>1</idLote>
        <tpAmb>2</tpAmb>
        <cOrgao>52</cOrgao>
        <cStat>128</cStat>
        <xMotivo>Lote de Evento Processado</xMotivo>
        <retEvento versao="1.00">
          <infEvento>
            <tpAmb>2</tpAmb>
            <cOrgao>52</cOrgao>
            <cStat>135</cStat>
            <xMotivo>Evento registrado e vinculado a NF-e</xMotivo>
            <chNFe>${chaveLimpa}</chNFe>
            <tpEvento>110111</tpEvento>
            <nSeqEvento>1</nSeqEvento>
            <dhRegEvento>2026-09-15T11:20:00-03:00</dhRegEvento>
            <nProt>152240099999999</nProt>
          </infEvento>
        </retEvento>
      </retEnvEvento>
    </nfeResultMsg>
  </soap:Body>
</soap:Envelope>
`;

const res135 = processarRespostaEvento(respSefaz135);
assert.strictEqual(res135.sucesso, true, 'cStat 135 deve ser sucesso');
assert.strictEqual(res135.cStat, '135', 'cStat deve ser 135');
assert.strictEqual(res135.nProt, '152240099999999', 'Protocolo do cancelamento deve ser extraído');
assert.strictEqual(res135.xMotivo, 'Evento registrado e vinculado a NF-e', 'xMotivo deve ser capturado');
console.log('✓ Retorno 135 processado com sucesso:', res135);

// 6.2 Resposta com cStat 136 (Sucesso fora de prazo/vinculação diferida)
const respSefaz136 = `<retEvento versao="1.00"><infEvento><cStat>136</cStat><xMotivo>Evento registrado, mas nao vinculado a NF-e</xMotivo><nProt>152240088888888</nProt></infEvento></retEvento>`;
const res136 = processarRespostaEvento(respSefaz136);
assert.strictEqual(res136.sucesso, true, 'cStat 136 deve ser sucesso');
assert.strictEqual(res136.cStat, '136', 'cStat deve ser 136');
console.log('✓ Retorno 136 processado com sucesso');

// 6.3 Resposta com rejeição no lote <retEnvEvento> (ex: cStat 215)
const respSefaz215 = `<retEnvEvento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00"><cStat>215</cStat><xMotivo>Rejeicao: Falha no schema XML</xMotivo></retEnvEvento>`;
const res215 = processarRespostaEvento(respSefaz215);
assert.strictEqual(res215.sucesso, false, 'cStat 215 deve ser insucesso');
assert.strictEqual(res215.cStat, '215', 'cStat deve ser 215');
assert.strictEqual(res215.xMotivo, 'Rejeicao: Falha no schema XML');
console.log('✓ Rejeição no lote (215) capturada corretamente');

// 6.4 Resposta com Rejeição 999 (Erro não catalogado)
const respSefaz999 = `<retEnvEvento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00"><cStat>999</cStat><xMotivo>Rejeicao: Erro nao catalogado</xMotivo></retEnvEvento>`;
const res999 = processarRespostaEvento(respSefaz999);
assert.strictEqual(res999.sucesso, false, 'cStat 999 deve ser insucesso');
assert.strictEqual(res999.cStat, '999', 'cStat deve ser 999');
assert.strictEqual(res999.xMotivo, 'Rejeicao: Erro nao catalogado');
console.log('✓ Rejeição 999 tratada adequadamente');

// 6.5 Resposta SOAP Fault
const respSoapFault = `<soap:Envelope><soap:Body><soap:Fault><soap:Reason><soap:Text>Acesso negado</soap:Text></soap:Reason></soap:Fault></soap:Body></soap:Envelope>`;
const resFault = processarRespostaEvento(respSoapFault);
assert.strictEqual(resFault.sucesso, false);
assert.strictEqual(resFault.cStat, 'SOAP_FAULT');
console.log('✓ SOAP Fault capturado adequadamente');

console.log('\n=== TODOS OS TESTES PASSARAM COM SUCESSO! ===');
