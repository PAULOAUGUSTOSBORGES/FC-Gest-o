// ==============================================================
// MOTOR FISCAL AUTÔNOMO DE NFS-e - PREFEITURA DE GOIÂNIA (ISSNET / ABRASF 2.04)
// Comunicação Direta SOAP mTLS com a Secretaria Municipal de Finanças (SEFIN)
// Sem intermediários ou plataformas pagas de terceiros
// ==============================================================

const axios = require('axios');
const { XMLParser } = require('fast-xml-parser');
const { SignedXml } = require('xml-crypto');
const { extrairChavesDoPfx } = require('./sefaz_signer');
const { criarAgenteMtls } = require('./sefaz_client');

// Endpoints oficiais do Web Service da Prefeitura de Goiânia (provedor ISSNet / SGISS)
const ENDPOINTS_GOIANIA = {
    producao: 'https://nfse.issnetonline.com.br/abrasf204/goiania/nfse.asmx',
    homologacao: 'https://www.issnetonline.com.br/homologaabrasf/webservicenfse204/nfse.asmx'
};

/**
 * Remove caracteres especiais e acentos para conformidade com schema ABRASF
 */
function sanitizarTexto(str = '') {
    return String(str || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[<>&'"]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Mantém apenas números
 */
function apenasNumeros(str = '') {
    return String(str || '').replace(/\D/g, '');
}

/**
 * Constrói o XML do RPS (Recibo Provisório de Serviços) no padrão ABRASF 2.04 de Goiânia
 */
function construirXmlRps(dados) {
    const { empresa, tomador, servico, observacoes, numRps, serieRps } = dados;

    const dataHoraIso = new Date().toISOString();
    const dataEmissaoRps = dataHoraIso.substring(0, 19);
    const competencia = dataHoraIso.substring(0, 10);

    const vServico = parseFloat(servico.valor || 0);
    const aliqIss = parseFloat(servico.aliquotaIss || 2.0);
    const aliqFormatada = (aliqIss / 100).toFixed(4); // Ex: 0.0200
    const vIss = parseFloat(((vServico * aliqIss) / 100).toFixed(2));

    const cnpjPrestador = apenasNumeros(empresa.cnpj);
    const imPrestador = apenasNumeros(empresa.im || '107996359');
    const docTomador = apenasNumeros(tomador.doc || tomador.cpf || tomador.cnpj);
    const isCnpjTomador = docTomador.length === 14;

    const tagDocTomador = isCnpjTomador
        ? `<Cnpj>${docTomador}</Cnpj>`
        : `<Cpf>${docTomador.length === 11 ? docTomador : '00000000000'}</Cpf>`;

    const itemLc116 = String(servico.itemListaServico || '14.01').replace(/[^0-9.]/g, '');
    const cnaePrestador = apenasNumeros(empresa.cnae || '9524000');
    const codTribMun = String(servico.codigoTributacao || itemLc116.replace(/\D/g, ''));

    const ibgePrestador = apenasNumeros(empresa.ibge || '5208707'); // Goiânia
    const ibgeTomador = apenasNumeros(tomador.ibge || ibgePrestador);

    const discrLimpa = sanitizarTexto(servico.descricao || 'PRESTACAO DE SERVICOS');
    const obsLimpa = sanitizarTexto(observacoes || '');
    const discriminacaoFinal = obsLimpa ? `${discrLimpa} - Obs: ${obsLimpa}` : discrLimpa;

    const idDeclaracao = `RPS${numRps}`;

    const xml = `<Rps xmlns="http://www.abrasf.org.br/nfse.xsd">` +
        `<InfDeclaracaoPrestacaoServico Id="${idDeclaracao}">` +
            `<Rps>` +
                `<IdentificacaoRps>` +
                    `<Numero>${numRps}</Numero>` +
                    `<Serie>${serieRps}</Serie>` +
                    `<Tipo>1</Tipo>` +
                `</IdentificacaoRps>` +
                `<DataEmissao>${dataEmissaoRps}</DataEmissao>` +
                `<Status>1</Status>` +
            `</Rps>` +
            `<Competencia>${competencia}</Competencia>` +
            `<Servico>` +
                `<Valores>` +
                    `<ValorServicos>${vServico.toFixed(2)}</ValorServicos>` +
                    `<ValorDeducoes>0.00</ValorDeducoes>` +
                    `<ValorPis>0.00</ValorPis>` +
                    `<ValorCofins>0.00</ValorCofins>` +
                    `<ValorInss>0.00</ValorInss>` +
                    `<ValorIr>0.00</ValorIr>` +
                    `<ValorCsll>0.00</ValorCsll>` +
                    `<OutrasRetencoes>0.00</OutrasRetencoes>` +
                    `<ValorIss>${vIss.toFixed(2)}</ValorIss>` +
                    `<Aliquota>${aliqFormatada}</Aliquota>` +
                    `<DescontoIncondicionado>0.00</DescontoIncondicionado>` +
                    `<DescontoCondicionado>0.00</DescontoCondicionado>` +
                `</Valores>` +
                `<IssRetido>${servico.issRetido ? '1' : '2'}</IssRetido>` +
                `<ItemListaServico>${itemLc116}</ItemListaServico>` +
                `<CodigoCnae>${cnaePrestador}</CodigoCnae>` +
                `<CodigoTributacaoMunicipio>${codTribMun}</CodigoTributacaoMunicipio>` +
                `<Discriminacao>${discriminacaoFinal}</Discriminacao>` +
                `<CodigoMunicipio>${ibgePrestador}</CodigoMunicipio>` +
            `</Servico>` +
            `<Prestador>` +
                `<CpfCnpj>` +
                    `<Cnpj>${cnpjPrestador}</Cnpj>` +
                `</CpfCnpj>` +
                `<InscricaoMunicipal>${imPrestador}</InscricaoMunicipal>` +
            `</Prestador>` +
            `<Tomador>` +
                `<IdentificacaoTomador>` +
                    `<CpfCnpj>` +
                        tagDocTomador +
                    `</CpfCnpj>` +
                `</IdentificacaoTomador>` +
                `<RazaoSocial>${sanitizarTexto(tomador.nome || 'TOMADOR DO SERVICO')}</RazaoSocial>` +
                `<Endereco>` +
                    `<Endereco>${sanitizarTexto(tomador.rua || 'RUA')}</Endereco>` +
                    `<Numero>${sanitizarTexto(tomador.numero || 'SN')}</Numero>` +
                    `<Bairro>${sanitizarTexto(tomador.bairro || 'CENTRO')}</Bairro>` +
                    `<CodigoMunicipio>${ibgeTomador}</CodigoMunicipio>` +
                    `<Uf>${sanitizarTexto(tomador.uf || empresa.uf || 'GO').toUpperCase()}</Uf>` +
                    `<Cep>${apenasNumeros(tomador.cep || '74000000')}</Cep>` +
                `</Endereco>` +
                `<Contato>` +
                    `<Telefone>${apenasNumeros(tomador.telefone || '')}</Telefone>` +
                    `<Email>${sanitizarTexto(tomador.email || '')}</Email>` +
                `</Contato>` +
            `</Tomador>` +
            `<OptanteSimplesNacional>1</OptanteSimplesNacional>` +
            `<IncentivoFiscal>2</IncentivoFiscal>` +
        `</InfDeclaracaoPrestacaoServico>` +
    `</Rps>`;

    return { xml, idDeclaracao };
}

/**
 * Assina digitalmente o RPS com o Certificado Digital A1 via XMLDSig (W3C Enveloped)
 */
function assinarXmlRps(xmlRps, idDeclaracao, pfxBase64, senha) {
    const { privateKeyPem, certificatePem } = extrairChavesDoPfx(pfxBase64, senha);

    const xmlLimpo = String(xmlRps || '').replace(/>\s+</g, '><').trim();

    const sig = new SignedXml({
        privateKey: privateKeyPem,
        publicCert: certificatePem,
        signatureAlgorithm: 'http://www.w3.org/2000/09/xmldsig#rsa-sha1',
        canonicalizationAlgorithm: 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'
    });

    sig.addReference({
        xpath: "//*[local-name(.)='InfDeclaracaoPrestacaoServico']",
        transforms: [
            'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
            'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'
        ],
        digestAlgorithm: 'http://www.w3.org/2000/09/xmldsig#sha1'
    });

    sig.computeSignature(xmlLimpo, {
        location: {
            reference: "//*[local-name(.)='InfDeclaracaoPrestacaoServico']",
            action: 'after'
        }
    });

    return sig.getSignedXml();
}

/**
 * Envia o RPS assinado diretamente para o Web Service da Prefeitura de Goiânia via SOAP mTLS
 */
async function transmitirNfseGoiania({ empresa, tomador, servico, observacoes, vendaId, ambiente = 'producao' }) {
    if (!empresa.certificadoBase64) {
        throw new Error('Certificado Digital A1 (.pfx) não configurado nas Configurações da Empresa.');
    }

    const endpointUrl = ambiente === 'homologacao' ? ENDPOINTS_GOIANIA.homologacao : ENDPOINTS_GOIANIA.producao;
    const numRps = parseInt(empresa.proximoNumeroNFSe || 1, 10);
    const serieRps = String(empresa.serieNFSe || '1');

    // 1. Constrói o XML do RPS
    const { xml, idDeclaracao } = construirXmlRps({
        empresa,
        tomador,
        servico,
        observacoes,
        numRps,
        serieRps
    });

    // 2. Assina o RPS com o Certificado Digital A1
    const xmlAssinado = assinarXmlRps(xml, idDeclaracao, empresa.certificadoBase64, empresa.certificadoSenha || '');

    // 3. Monta o pacote de envio no padrão GerarNfseEnvio ABRASF 2.04
    const gerarNfseXml = `<GerarNfseEnvio xmlns="http://www.abrasf.org.br/nfse.xsd">${xmlAssinado}</GerarNfseEnvio>`;

    // 4. Monta o Envelope SOAP oficial para o ISSNet Goiânia
    const cabecalhoXml = `<cabecalho versao="2.04" xmlns="http://www.abrasf.org.br/nfse.xsd"><versaoDados>2.04</versaoDados></cabecalho>`;
    const envelopeSoap = `<?xml version="1.0" encoding="utf-8"?>` +
        `<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">` +
            `<soap:Body>` +
                `<GerarNfse xmlns="http://nfse.abrasf.org.br">` +
                    `<nfseCabecMsg><![CDATA[${cabecalhoXml}]]></nfseCabecMsg>` +
                    `<nfseDadosMsg><![CDATA[${gerarNfseXml}]]></nfseDadosMsg>` +
                `</GerarNfse>` +
            `</soap:Body>` +
        `</soap:Envelope>`;

    // 5. Configura agente mTLS com o Certificado Digital A1 da empresa
    const agente = criarAgenteMtls(empresa.certificadoBase64, empresa.certificadoSenha || '');

    console.log(`[NFS-e Goiânia] Transmitindo RPS Nº ${numRps} para: ${endpointUrl}`);

    let respostaXml = '';
    try {
        const response = await axios.post(endpointUrl, envelopeSoap, {
            httpsAgent: agente,
            headers: {
                'Content-Type': 'text/xml; charset=utf-8',
                'SOAPAction': 'http://nfse.abrasf.org.br/GerarNfse'
            },
            timeout: 45000 // 45 segundos
        });
        respostaXml = response.data;
    } catch (httpErr) {
        if (httpErr.response && httpErr.response.data) {
            respostaXml = httpErr.response.data;
        } else {
            console.error('[NFS-e Goiânia] Falha na conexão com o Web Service municipal:', httpErr.message);
            throw new Error(`Falha de conexão com a Prefeitura de Goiânia (${endpointUrl}): ${httpErr.message}`);
        }
    }

    // 6. Interpreta o retorno XML da Prefeitura
    const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true });
    const parsed = parser.parse(respostaXml);

    console.log('[NFS-e Goiânia] Resposta recebida da Prefeitura');

    // Navega na resposta SOAP
    const body = parsed?.Envelope?.Body || parsed?.Body || parsed;
    const gerarNfseResult = body?.GerarNfseResponse?.GerarNfseResult || body?.GerarNfseResult || body;

    // Se o resultado estiver encapsulado em string XML dentro do resultado
    let dadosMsg = gerarNfseResult;
    if (typeof gerarNfseResult === 'string') {
        try { dadosMsg = parser.parse(gerarNfseResult); } catch(e) {}
    }

    const gerarNfseResposta = dadosMsg?.GerarNfseResposta || dadosMsg;

    // A) Verifica se a Prefeitura retornou Lista de Mensagens de Erro / Rejeição
    const listaErros = gerarNfseResposta?.ListaMensagemRetorno?.MensagemRetorno;
    if (listaErros) {
        const errosArr = Array.isArray(listaErros) ? listaErros : [listaErros];
        const motivos = errosArr.map(e => `[${e.Codigo || 'ERRO'}] ${e.Mensagem || ''} ${e.Correcao ? '(Correção: ' + e.Correcao + ')' : ''}`).join(' | ');
        console.warn('[NFS-e Goiânia] Rejeição pela Prefeitura:', motivos);
        throw new Error(`Prefeitura de Goiânia recusou a NFS-e: ${motivos}`);
    }

    // B) Verifica se a Prefeitura autorizou a NFS-e
    const compNfse = gerarNfseResposta?.CompNfse || gerarNfseResposta?.ListaNfse?.CompNfse;
    const nfseInfo = compNfse?.Nfse?.InfNfse || compNfse?.InfNfse;

    if (!nfseInfo || !nfseInfo.Numero) {
        console.warn('[NFS-e Goiânia] Resposta não reconhecida da Prefeitura:', respostaXml);
        throw new Error('A Prefeitura não retornou o número da NFS-e. Verifique se sua Inscrição Municipal está autorizada a emitir Web Service junto à SEFIN Goiânia.');
    }

    const numeroNotaPrefeitura = String(nfseInfo.Numero);
    const codigoVerificacaoPrefeitura = String(nfseInfo.CodigoVerificacao || '');
    const dataEmissaoPrefeitura = nfseInfo.DataEmissao || new Date().toISOString();

    return {
        sucesso: true,
        oficial: true,
        orgao: 'PREFEITURA MUNICIPAL DE GOIANIA (SEFIN / ISSNET)',
        numero: numeroNotaPrefeitura,
        serie: serieRps,
        codigo_verificacao: codigoVerificacaoPrefeitura,
        chave: codigoVerificacaoPrefeitura,
        data_emissao: dataEmissaoPrefeitura,
        valor: parseFloat(servico.valor || 0),
        xml_conteudo: respostaXml,
        rps_numero: numRps,
        link_consulta: `https://www.issnetonline.com.br/goiania/online/login/login.aspx`
    };
}

module.exports = {
    transmitirNfseGoiania,
    construirXmlRps,
    assinarXmlRps,
    ENDPOINTS_GOIANIA
};
