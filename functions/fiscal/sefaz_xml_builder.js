// ==============================================================
// CONSTRUTOR DE XML SEFAZ - NF-e (Mod 55) & NFC-e (Mod 65)
// Padrão MOC 4.00 da Receita Federal
// ==============================================================

const { CODIGOS_UF } = require('./sefaz_urls');

/**
 * Calcula o Dígito Verificador (DV) da Chave de Acesso usando Módulo 11 (pesos 2 a 9)
 * @param {string} chave43 Chave de acesso com 43 dígitos (sem o DV)
 */
function calcularDV(chave43) {
    let soma = 0;
    let peso = 2;
    for (let i = chave43.length - 1; i >= 0; i--) {
        soma += parseInt(chave43[i], 10) * peso;
        peso = peso >= 9 ? 2 : peso + 1;
    }
    const resto = soma % 11;
    if (resto === 0 || resto === 1) return '0';
    return String(11 - resto);
}

/**
 * Formata data no padrão ISO com timezone brasileiro (-03:00)
 */
function formatarDataHoraSefaz(data = new Date()) {
    const d = new Date(data);
    const pad = (n) => String(n).padStart(2, '0');
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const mi = pad(d.getMinutes());
    const ss = pad(d.getSeconds());
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}-03:00`;
}

/**
 * Remove caracteres especiais, mantendo apenas texto limpo
 */
function limparTexto(txt) {
    if (!txt) return '';
    return String(txt)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // remove acentos
        .replace(/[&<>"']/g, '') // remove caracteres XML proibidos
        .trim();
}

/**
 * Remove pontuações, mantendo apenas dígitos numéricos
 */
function apenasDigitos(val) {
    if (!val) return '';
    return String(val).replace(/\D/g, '');
}

/**
 * Mapeia a forma de pagamento interna para o código oficial da SEFAZ
 */
function mapearFormaPagamentoSefaz(forma) {
    const f = (forma || '').toLowerCase().trim();
    if (f.includes('dinheiro')) return '01';
    if (f.includes('cheque')) return '02';
    if (f.includes('crédito') || f.includes('credito')) return '03';
    if (f.includes('débito') || f.includes('debito')) return '04';
    if (f.includes('boleto')) return '15';
    if (f.includes('pix')) return '17';
    if (f.includes('fiado') || f.includes('crediario')) return '05';
    return '99'; // Outros
}

/**
 * Constrói o XML oficial da NF-e (55) ou NFC-e (65) no layout MOC 4.00
 * @param {Object} dados Dados da venda, empresa, itens e cliente
 * @returns {{ xml: string, chave: string, nNF: number, serie: number, cNF: string }}
 */
function construirXmlNota(dados) {
    const {
        empresa,
        venda,
        itens,
        cliente,
        modelo = '65', // '65' = NFC-e, '55' = NF-e
        ambiente = 'homologacao',
        numeroNota = null,
        serie = null
    } = dados;

    const ufSigla = (empresa.uf || 'SP').toUpperCase().trim();
    const cUF = CODIGOS_UF[ufSigla] || '35';
    const tpAmb = ambiente === 'producao' ? '1' : '2';
    const nNF = numeroNota || (modelo === '65' ? (parseInt(empresa.proximoNumeroNFCe) || 1) : (parseInt(empresa.proximoNumeroNFe) || 1));
    const serieNF = serie || (modelo === '65' ? (parseInt(empresa.serieNFCe) || 1) : (parseInt(empresa.serieNFe) || 1));
    const dhEmi = formatarDataHoraSefaz(venda.data || new Date());
    
    // Ano e Mês para chave
    const anoMes = dhEmi.substring(2, 4) + dhEmi.substring(5, 7);
    const cnpjEmitente = apenasDigitos(empresa.cnpj).padStart(14, '0');
    const mod = String(modelo).padStart(2, '0');
    const serieStr = String(serieNF).padStart(3, '0');
    const nNFStr = String(nNF).padStart(9, '0');
    const tpEmis = '1'; // 1 = Normal
    const cNF = String(Math.floor(Math.random() * 89999999 + 10000000)); // Código numérico aleatório de 8 dígitos

    // Chave de 43 dígitos
    const chave43 = `${cUF}${anoMes}${cnpjEmitente}${mod}${serieStr}${nNFStr}${tpEmis}${cNF}`;
    const cDV = calcularDV(chave43);
    const chaveAcesso = `${chave43}${cDV}`;

    const tpImp = modelo === '65' ? '4' : '1'; // 4 = DANFE NFC-e, 1 = DANFE normal retrato
    const natOp = limparTexto(empresa.naturezaOperacao || 'VENDA DE MERCADORIA');
    const cMunFG = apenasDigitos(empresa.ibge || '3550308'); // Código IBGE do município

    // Emitente
    const emitCnpj = cnpjEmitente;
    const emitNome = limparTexto(empresa.nome || empresa.fantasia || 'EMPRESA COMERCIAL');
    const emitFant = limparTexto(empresa.fantasia || empresa.nome || '');
    const emitLgr = limparTexto(empresa.rua || 'RUA PRINCIPAL');
    const emitNro = limparTexto(empresa.numero || 'S/N');
    const emitBairro = limparTexto(empresa.bairro || 'CENTRO');
    const emitMun = limparTexto(empresa.cidade || 'SAO PAULO');
    const emitCep = apenasDigitos(empresa.cep || '01001000').padStart(8, '0');
    const emitIe = apenasDigitos(empresa.ie || '');
    const emitCrt = empresa.crt || '1'; // 1 = Simples Nacional

    // Destinatário
    let tagDest = '';
    const docCliente = apenasDigitos(cliente?.cpf || cliente?.cnpj || venda.clienteCpf || '');
    const nomeCliente = limparTexto(cliente?.nome || cliente?.razaoSocial || venda.clienteNome || '');

    if (docCliente || modelo === '55') {
        const isCnpj = docCliente.length > 11;
        const tagDoc = isCnpj ? `<CNPJ>${docCliente.padStart(14, '0')}</CNPJ>` : `<CPF>${(docCliente || '00000000000').padStart(11, '0')}</CPF>`;
        const nomeDest = tpAmb === '2' ? 'NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL' : (nomeCliente || 'CONSUMIDOR FINAL');
        
        let enderDestTag = '';
        if (modelo === '55' || cliente?.rua) {
            const destLgr = limparTexto(cliente?.rua || 'RUA');
            const destNro = limparTexto(cliente?.numero || 'S/N');
            const destBairro = limparTexto(cliente?.bairro || 'CENTRO');
            const destMun = limparTexto(cliente?.cidade || emitMun);
            const destIbge = apenasDigitos(cliente?.ibge || cMunFG);
            const destUf = (cliente?.uf || ufSigla).toUpperCase().trim();
            const destCep = apenasDigitos(cliente?.cep || emitCep).padStart(8, '0');

            enderDestTag = `
        <enderDest>
            <xLgr>${destLgr}</xLgr>
            <nro>${destNro}</nro>
            <xBairro>${destBairro}</xBairro>
            <cMun>${destIbge}</cMun>
            <xMun>${destMun}</xMun>
            <UF>${destUf}</UF>
            <CEP>${destCep}</CEP>
            <cPais>1058</cPais>
            <xPais>BRASIL</xPais>
        </enderDest>`;
        }

        tagDest = `
    <dest>
        ${tagDoc}
        <xNome>${nomeDest}</xNome>${enderDestTag}
        <indIEDest>9</indIEDest>
    </dest>`;
    }

    // Itens da Venda
    let itensXml = '';
    let totalProdutos = 0;
    let totalDesconto = 0;

    itens.forEach((item, index) => {
        const nItem = index + 1;
        const cProd = apenasDigitos(item.id || item.codigo || nItem).substring(0, 15) || String(nItem);
        const xProd = tpAmb === '2' && nItem === 1 
            ? 'NOTA FISCAL EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL' 
            : limparTexto(item.nome || item.descricao || `PRODUTO ${nItem}`);
        
        const ncm = apenasDigitos(item.ncm || '21069090').padStart(8, '0');
        const cfop = apenasDigitos(item.cfop || '5102').padStart(4, '0');
        const uCom = limparTexto(item.unidade || 'UN').toUpperCase();
        const qCom = (parseFloat(item.quantidade) || 1).toFixed(4);
        const vUnCom = (parseFloat(item.preco) || parseFloat(item.precoUnitario) || 0).toFixed(4);
        const subtotalItem = (parseFloat(item.quantidade || 1) * parseFloat(item.preco || item.precoUnitario || 0));
        const vProd = subtotalItem.toFixed(2);
        
        totalProdutos += subtotalItem;
        const csosn = apenasDigitos(item.csosn || '102');
        const origem = String(item.origem || '0').trim();

        // ICMS Simples Nacional ou Normal
        let icmsTag = '';
        if (emitCrt === '1' || emitCrt === '2') {
            if (csosn === '500') {
                icmsTag = `
                <ICMSSN500>
                    <orig>${origem}</orig>
                    <CSOSN>500</CSOSN>
                    <vBCSTRet>0.00</vBCSTRet>
                    <pST>0.00</pST>
                    <vICMSSubstituto>0.00</vICMSSubstituto>
                    <vICMSSTRet>0.00</vICMSSTRet>
                </ICMSSN500>`;
            } else {
                icmsTag = `
                <ICMSSN102>
                    <orig>${origem}</orig>
                    <CSOSN>${csosn}</CSOSN>
                </ICMSSN102>`;
            }
        } else {
            icmsTag = `
            <ICMS00>
                <orig>${origem}</orig>
                <CST>00</CST>
                <modBC>3</modBC>
                <vBC>${vProd}</vBC>
                <pICMS>18.00</pICMS>
                <vICMS>${(subtotalItem * 0.18).toFixed(2)}</vICMS>
            </ICMS00>`;
        }

        itensXml += `
    <det nItem="${nItem}">
        <prod>
            <cProd>${cProd}</cProd>
            <cEAN>SEM GTIN</cEAN>
            <xProd>${xProd}</xProd>
            <NCM>${ncm}</NCM>
            <CFOP>${cfop}</CFOP>
            <uCom>${uCom}</uCom>
            <qCom>${qCom}</qCom>
            <vUnCom>${vUnCom}</vUnCom>
            <vProd>${vProd}</vProd>
            <cEANTrib>SEM GTIN</cEANTrib>
            <uTrib>${uCom}</uTrib>
            <qTrib>${qCom}</qTrib>
            <vUnTrib>${vUnCom}</vUnTrib>
            <indTot>1</indTot>
        </prod>
        <imposto>
            <vTotTrib>0.00</vTotTrib>
            <ICMS>${icmsTag}
            </ICMS>
            <PIS>
                <PISNT>
                    <CST>07</CST>
                </PISNT>
            </PIS>
            <COFINS>
                <COFINSNT>
                    <CST>07</CST>
                </COFINSNT>
            </COFINS>
        </imposto>
    </det>`;
    });

    const valorDescontoTotal = parseFloat(venda.desconto || 0) || 0;
    const valorFinalNota = Math.max(0, totalProdutos - valorDescontoTotal);
    const vNF = valorFinalNota.toFixed(2);
    const vProdTotal = totalProdutos.toFixed(2);
    const vDescTotal = valorDescontoTotal.toFixed(2);

    // Formas de Pagamento
    const tPag = mapearFormaPagamentoSefaz(venda.formaPagamento || venda.pagamento);
    const tagPag = `
    <pag>
        <detPag>
            <tPag>${tPag}</tPag>
            <vPag>${vNF}</vPag>
        </detPag>
    </pag>`;

    // Informações Adicionais
    const msgSimples = emitCrt === '1' ? 'DOCUMENTO EMITIDO POR ME OU EPP OPTANTE PELO SIMPLES NACIONAL. NAO GERA DIREITO A CREDITO FISCAL DE IPI.' : '';
    const obsVenda = limparTexto(venda.observacoes || '');
    const infCpl = `${msgSimples} ${obsVenda}`.trim();

    // Montagem completa do XML
    const xml = `<NFe xmlns="http://www.portalfiscal.inf.br/nfe">
<infNFe Id="NFe${chaveAcesso}" versao="4.00">
    <ide>
        <cUF>${cUF}</cUF>
        <cNF>${cNF}</cNF>
        <natOp>${natOp}</natOp>
        <mod>${mod}</mod>
        <serie>${serieNF}</serie>
        <nNF>${nNF}</nNF>
        <dhEmi>${dhEmi}</dhEmi>
        <tpNF>1</tpNF>
        <idDest>1</idDest>
        <cMunFG>${cMunFG}</cMunFG>
        <tpImp>${tpImp}</tpImp>
        <tpEmis>${tpEmis}</tpEmis>
        <cDV>${cDV}</cDV>
        <tpAmb>${tpAmb}</tpAmb>
        <finNFe>1</finNFe>
        <indFinal>1</indFinal>
        <indPres>1</indPres>
        <procEmi>0</procEmi>
        <verProc>1.0</verProc>
    </ide>
    <emit>
        <CNPJ>${emitCnpj}</CNPJ>
        <xNome>${emitNome}</xNome>${emitFant ? `\n        <xFant>${emitFant}</xFant>` : ''}
        <enderEmit>
            <xLgr>${emitLgr}</xLgr>
            <nro>${emitNro}</nro>
            <xBairro>${emitBairro}</xBairro>
            <cMun>${cMunFG}</cMun>
            <xMun>${emitMun}</xMun>
            <UF>${ufSigla}</UF>
            <CEP>${emitCep}</CEP>
            <cPais>1058</cPais>
            <xPais>BRASIL</xPais>
        </enderEmit>
        <IE>${emitIe || 'ISENTO'}</IE>
        <CRT>${emitCrt}</CRT>
    </emit>${tagDest}${itensXml}
    <total>
        <ICMSTot>
            <vBC>0.00</vBC>
            <vICMS>0.00</vICMS>
            <vICMSDeson>0.00</vICMSDeson>
            <vFCP>0.00</vFCP>
            <vBCST>0.00</vBCST>
            <vST>0.00</vST>
            <vFCPST>0.00</vFCPST>
            <vFCPSTRet>0.00</vFCPSTRet>
            <vProd>${vProdTotal}</vProd>
            <vFrete>0.00</vFrete>
            <vSeg>0.00</vSeg>
            <vDesc>${vDescTotal}</vDesc>
            <vII>0.00</vII>
            <vIPI>0.00</vIPI>
            <vIPIDevol>0.00</vIPIDevol>
            <vPIS>0.00</vPIS>
            <vCOFINS>0.00</vCOFINS>
            <vOutro>0.00</vOutro>
            <vNF>${vNF}</vNF>
            <vTotTrib>0.00</vTotTrib>
        </ICMSTot>
    </total>
    <transp>
        <modFrete>9</modFrete>
    </transp>${tagPag}
    <infAdic>
        <infCpl>${infCpl}</infCpl>
    </infAdic>
</infNFe>
</NFe>`.trim();

    return {
        xml,
        chave: chaveAcesso,
        nNF,
        serie: serieNF,
        cNF,
        cUF,
        dhEmi,
        vNF,
        tpAmb
    };
}

module.exports = {
    construirXmlNota,
    calcularDV,
    formatarDataHoraSefaz,
    limparTexto,
    apenasDigitos
};
