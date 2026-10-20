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
    const dataEmissaoRps = dataHoraIso.substring(0, 10); // ABRASF 2.04 DataEmissao é xsd:date (YYYY-MM-DD)
    const competencia = dataHoraIso.substring(0, 10);    // ABRASF 2.04 Competencia é xsd:date (YYYY-MM-DD)

    const vServico = parseFloat(servico.valor || 0);
    const aliqIss = parseFloat(servico.aliquotaIss || 2.0);
    const aliqFormatada = aliqIss.toFixed(2); // tsAliquota no XSD 2.04: decimal com no máximo 2 casas decimais (ex: 2.00)
    const vIss = parseFloat(((vServico * aliqIss) / 100).toFixed(2));

    const cnpjPrestador = apenasNumeros(empresa.cnpj);
    const imPrestador = apenasNumeros(empresa.im || '5118565');
    const docTomador = apenasNumeros(tomador.doc || tomador.cpf || tomador.cnpj);
    const isCnpjTomador = docTomador.length === 14;

    const tagDocTomador = isCnpjTomador
        ? `<Cnpj>${docTomador}</Cnpj>`
        : `<Cpf>${docTomador.length === 11 ? docTomador : '00000000000'}</Cpf>`;

    const mapItemParaCodTrib = {
        '14.05': '1405',
        '07.02': '702',
        '7.02': '702',
        '14.13': '1413',
        '07.05': '705',
        '7.05': '705',
        '14.12': '1412'
    };

    const itemLc116 = String(servico.itemListaServico || '14.05').replace(/[^0-9.]/g, '');
    const cnaeBruto = servico.cnae !== undefined ? servico.cnae : (empresa.cnae || '9529105');
    const cnaePrestador = (cnaeBruto === 'nenhum' || cnaeBruto === 'vazio' || !cnaeBruto) ? '' : apenasNumeros(cnaeBruto);

    const codTribBruto = servico.codigoTributacao !== undefined 
        ? servico.codigoTributacao 
        : (mapItemParaCodTrib[itemLc116] || itemLc116.replace(/\D/g, ''));
    const codTribMun = (codTribBruto === 'nenhum' || codTribBruto === 'vazio' || !codTribBruto) ? '' : String(codTribBruto).trim();

    const ibgePrestador = apenasNumeros(empresa.ibge || '5208707'); // Goiânia
    const ibgeTomador = apenasNumeros(tomador.ibge || ibgePrestador);

    const discrLimpa = sanitizarTexto(servico.descricao || 'PRESTACAO DE SERVICOS');
    const obsLimpa = sanitizarTexto(observacoes || '');
    const discriminacaoFinal = obsLimpa ? `${discrLimpa} - Obs: ${obsLimpa}` : discrLimpa;

    const idDeclaracao = `RPS${numRps}`;

    // Construção rigorosamente ordenada conforme o XSD nfse.xsd (ABRASF 2.04)
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
                    `<ValorIss>${vIss.toFixed(2)}</ValorIss>` +
                    `<Aliquota>${aliqFormatada}</Aliquota>` +
                `</Valores>` +
                `<IssRetido>${servico.issRetido ? '1' : '2'}</IssRetido>` +
                `<ItemListaServico>${itemLc116}</ItemListaServico>` +
                (cnaePrestador ? `<CodigoCnae>${cnaePrestador}</CodigoCnae>` : '') +
                (codTribMun ? `<CodigoTributacaoMunicipio>${codTribMun}</CodigoTributacaoMunicipio>` : '') +
                `<Discriminacao>${discriminacaoFinal}</Discriminacao>` +
                `<CodigoMunicipio>${ibgePrestador}</CodigoMunicipio>` +
                `<ExigibilidadeISS>1</ExigibilidadeISS>` +
                `<MunicipioIncidencia>${ibgePrestador}</MunicipioIncidencia>` +
            `</Servico>` +
            `<Prestador>` +
                `<CpfCnpj>` +
                    (cnpjPrestador.length === 14 ? `<Cnpj>${cnpjPrestador}</Cnpj>` : `<Cpf>${cnpjPrestador}</Cpf>`) +
                `</CpfCnpj>` +
                (imPrestador ? `<InscricaoMunicipal>${imPrestador}</InscricaoMunicipal>` : '') +
            `</Prestador>` +
            `<TomadorServico>` +
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
                (tomador.telefone || tomador.email ? 
                    `<Contato>` +
                        (tomador.telefone ? `<Telefone>${apenasNumeros(tomador.telefone)}</Telefone>` : '') +
                        (tomador.email ? `<Email>${sanitizarTexto(tomador.email)}</Email>` : '') +
                    `</Contato>` : '') +
            `</TomadorServico>` +
            `<OptanteSimplesNacional>${empresa.crt === '1' || !empresa.crt ? '1' : '2'}</OptanteSimplesNacional>` +
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
async function transmitirNfseGoiania({ empresa, tomador, servico, observacoes, vendaId, ambiente = 'producao', numRps: numRpsParam, serieRps: serieRpsParam }) {
    if (!empresa.certificadoBase64) {
        throw new Error('Certificado Digital A1 (.pfx) não configurado nas Configurações da Empresa.');
    }

    const endpointUrl = ambiente === 'homologacao' ? ENDPOINTS_GOIANIA.homologacao : ENDPOINTS_GOIANIA.producao;
    const numRps = parseInt(numRpsParam || empresa.proximoNumeroNFSe || 1, 10);
    const serieRps = String(serieRpsParam || empresa.serieNFSe || '1');

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

    // 4. Monta o Envelope SOAP oficial para o ISSNet Goiânia (sem CDATA em nfseCabecMsg conforme especificação ABRASF 2.04)
    const cabecalhoXml = `<cabecalho versao="2.04" xmlns="http://www.abrasf.org.br/nfse.xsd"><versaoDados>2.04</versaoDados></cabecalho>`;
    const envelopeSoap = `<?xml version="1.0" encoding="utf-8"?>` +
        `<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">` +
            `<soap:Body>` +
                `<GerarNfse xmlns="http://nfse.abrasf.org.br">` +
                    `<nfseCabecMsg>${cabecalhoXml}</nfseCabecMsg>` +
                    `<nfseDadosMsg>${gerarNfseXml}</nfseDadosMsg>` +
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

    console.log('[NFS-e Goiânia] Resposta recebida da Prefeitura:', respostaXml);

    // Navega na resposta SOAP
    const body = parsed?.Envelope?.Body || parsed?.Body || parsed;
    const respContainer = body?.GerarNfseResponse || body;
    let gerarNfseResposta = respContainer?.GerarNfseResposta || respContainer?.GerarNfseResult || respContainer;

    // Se o resultado estiver encapsulado em string XML dentro do resultado
    if (typeof gerarNfseResposta === 'string') {
        try { 
            const innerParsed = parser.parse(gerarNfseResposta);
            gerarNfseResposta = innerParsed?.GerarNfseResposta || innerParsed;
        } catch(e) {}
    }

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

/**
 * Constrói e assina o Pedido de Cancelamento da NFS-e conforme o padrão ABRASF 2.04 de Goiânia
 */
function construirEAssinarPedidoCancelamento({ empresa, numeroNfse, codigoCancelamento = '2' }) {
    const cnpjPrestador = apenasNumeros(empresa.cnpj);
    const imPrestador = apenasNumeros(empresa.im || '5118565');
    const ibgePrestador = apenasNumeros(empresa.ibge || '5208707');
    const numLimpo = String(numeroNfse).replace(/\D/g, '');
    const idPedido = `Cancelamento_${numLimpo}`;

    const xmlPedido = `<Pedido xmlns="http://www.abrasf.org.br/nfse.xsd">` +
        `<InfPedidoCancelamento Id="${idPedido}">` +
            `<IdentificacaoNfse>` +
                `<Numero>${numLimpo}</Numero>` +
                `<CpfCnpj>` +
                    (cnpjPrestador.length === 14 ? `<Cnpj>${cnpjPrestador}</Cnpj>` : `<Cpf>${cnpjPrestador}</Cpf>`) +
                `</CpfCnpj>` +
                `<InscricaoMunicipal>${imPrestador}</InscricaoMunicipal>` +
                `<CodigoMunicipio>${ibgePrestador}</CodigoMunicipio>` +
            `</IdentificacaoNfse>` +
            `<CodigoCancelamento>${codigoCancelamento || '2'}</CodigoCancelamento>` +
        `</InfPedidoCancelamento>` +
    `</Pedido>`;

    const { privateKeyPem, certificatePem } = extrairChavesDoPfx(empresa.certificadoBase64, empresa.certificadoSenha || '');
    const xmlLimpo = xmlPedido.replace(/>\s+</g, '><').trim();

    const sig = new SignedXml({
        privateKey: privateKeyPem,
        publicCert: certificatePem,
        signatureAlgorithm: 'http://www.w3.org/2000/09/xmldsig#rsa-sha1',
        canonicalizationAlgorithm: 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'
    });

    sig.addReference({
        xpath: "//*[local-name(.)='InfPedidoCancelamento']",
        transforms: [
            'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
            'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'
        ],
        digestAlgorithm: 'http://www.w3.org/2000/09/xmldsig#sha1'
    });

    sig.computeSignature(xmlLimpo, {
        location: {
            reference: "//*[local-name(.)='InfPedidoCancelamento']",
            action: 'after'
        }
    });

    const pedidoAssinado = sig.getSignedXml();
    return `<CancelarNfseEnvio xmlns="http://www.abrasf.org.br/nfse.xsd">${pedidoAssinado}</CancelarNfseEnvio>`;
}

/**
 * Transmite o Cancelamento de NFS-e diretamente à SEFIN Goiânia via Web Service SOAP mTLS
 */
async function cancelarNfseGoiania({ empresa, numeroNfse, motivoCancelamento, codigoCancelamento = '2', ambiente = 'producao' }) {
    if (!empresa.certificadoBase64) {
        throw new Error('Certificado Digital A1 (.pfx) não configurado para realizar o cancelamento.');
    }

    const endpointUrl = ambiente === 'homologacao' ? ENDPOINTS_GOIANIA.homologacao : ENDPOINTS_GOIANIA.producao;
    const cancelarNfseXml = construirEAssinarPedidoCancelamento({ empresa, numeroNfse, codigoCancelamento });

    const cabecalhoXml = `<cabecalho versao="2.04" xmlns="http://www.abrasf.org.br/nfse.xsd"><versaoDados>2.04</versaoDados></cabecalho>`;
    const envelopeSoap = `<?xml version="1.0" encoding="utf-8"?>` +
        `<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">` +
            `<soap:Body>` +
                `<CancelarNfse xmlns="http://nfse.abrasf.org.br">` +
                    `<nfseCabecMsg>${cabecalhoXml}</nfseCabecMsg>` +
                    `<nfseDadosMsg>${cancelarNfseXml}</nfseDadosMsg>` +
                `</CancelarNfse>` +
            `</soap:Body>` +
        `</soap:Envelope>`;

    const agente = criarAgenteMtls(empresa.certificadoBase64, empresa.certificadoSenha || '');

    console.log(`[NFS-e Goiânia Cancelamento] Transmitindo cancelamento da NFS-e Nº ${numeroNfse} para SEFIN...`);

    let respostaXml = '';
    try {
        const response = await axios.post(endpointUrl, envelopeSoap, {
            httpsAgent: agente,
            headers: {
                'Content-Type': 'text/xml; charset=utf-8',
                'SOAPAction': 'http://nfse.abrasf.org.br/CancelarNfse'
            },
            timeout: 35000,
            responseType: 'text'
        });
        respostaXml = response.data;
    } catch (httpErr) {
        if (httpErr.response && httpErr.response.data) {
            respostaXml = httpErr.response.data;
        } else {
            console.error('[NFS-e Goiânia Cancelamento] Falha de comunicação com o Web Service:', httpErr.message);
            throw new Error(`Falha de comunicação com a Prefeitura de Goiânia: ${httpErr.message}`);
        }
    }

    console.log('[NFS-e Goiânia Cancelamento] Resposta recebida da Prefeitura:', respostaXml);

    const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true });
    const parsed = parser.parse(respostaXml);

    const body = parsed?.Envelope?.Body || parsed?.Body || parsed;

    // Verifica se houve SOAP Fault no envelope
    const fault = body?.Fault || parsed?.Envelope?.Body?.Fault;
    if (fault) {
        const faultString = fault.faultstring || fault.FaultString || JSON.stringify(fault);
        console.error('[NFS-e Goiânia Cancelamento] SOAP Fault:', faultString);
        throw new Error(`Falha no Web Service da Prefeitura (SOAP Fault): ${faultString}`);
    }

    const respContainer = body?.CancelarNfseResponse || body;
    let cancelarNfseResposta = respContainer?.CancelarNfseResposta || respContainer?.CancelarNfseResult || respContainer;

    if (typeof cancelarNfseResposta === 'string') {
        try {
            const innerParsed = parser.parse(cancelarNfseResposta);
            cancelarNfseResposta = innerParsed?.CancelarNfseResposta || innerParsed;
        } catch(e) {}
    }

    // A) Verifica se a Prefeitura retornou Lista de Mensagens de Erro / Rejeição
    const listaErros = cancelarNfseResposta?.ListaMensagemRetorno?.MensagemRetorno 
        || cancelarNfseResposta?.RetCancelamento?.ListaMensagemRetorno?.MensagemRetorno
        || cancelarNfseResposta?.MensagemRetorno;
    if (listaErros) {
        const errosArr = Array.isArray(listaErros) ? listaErros : [listaErros];
        const motivos = errosArr.map(e => `[${e.Codigo || 'ERRO'}] ${e.Mensagem || ''} ${e.Correcao ? '(Correção: ' + e.Correcao + ')' : ''}`).join(' | ');
        console.warn('[NFS-e Goiânia Cancelamento] Rejeição pela Prefeitura:', motivos);
        throw new Error(`Prefeitura de Goiânia recusou o cancelamento: ${motivos}`);
    }

    const retCancelamento = cancelarNfseResposta?.RetCancelamento || cancelarNfseResposta;
    const confirmacao = retCancelamento?.NfseCancelamento?.Confirmacao || retCancelamento?.Confirmacao;
    const dataHoraCancelamento = confirmacao?.DataHora || new Date().toISOString();

    return {
        sucesso: true,
        oficial: true,
        numero: String(numeroNfse),
        dataHora: dataHoraCancelamento,
        mensagem: `NFS-e Nº ${numeroNfse} cancelada com sucesso junto à Prefeitura de Goiânia!`,
        xml_conteudo: respostaXml
    };
}

module.exports = {
    transmitirNfseGoiania,
    cancelarNfseGoiania,
    construirXmlRps,
    assinarXmlRps,
    ENDPOINTS_GOIANIA
};
