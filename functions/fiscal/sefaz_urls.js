// ==============================================================
// MAPEAMENTO OFICIAL DE ENDPOINTS SEFAZ - NF-e (55) & NFC-e (65)
// Suporta todos os 27 estados brasileiros (Homologação e Produção)
// ==============================================================

const CODIGOS_UF = {
    'RO': '11', 'AC': '12', 'AM': '13', 'RR': '14', 'PA': '15', 'AP': '16', 'TO': '17',
    'MA': '21', 'PI': '22', 'CE': '23', 'RN': '24', 'PB': '25', 'PE': '26', 'AL': '27', 'SE': '28', 'BA': '29',
    'MG': '31', 'ES': '32', 'RJ': '33', 'SP': '35',
    'PR': '41', 'SC': '42', 'RS': '43',
    'MS': '50', 'MT': '51', 'GO': '52', 'DF': '53'
};

// Mapeamento dos Servidores Autorizadores de NF-e (Mod 55)
const SERVIDORES_NFE = {
    'SP': {
        producao: 'https://nfe.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx',
        homologacao: 'https://homologacao.nfe.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx',
        evento_prod: 'https://nfe.fazenda.sp.gov.br/ws/nferecepcaoevento4.asmx',
        evento_homol: 'https://homologacao.nfe.fazenda.sp.gov.br/ws/nferecepcaoevento4.asmx'
    },
    'MG': {
        producao: 'https://nfe.fazenda.mg.gov.br/nfe2/services/NFeAutorizacao4',
        homologacao: 'https://hnfe.fazenda.mg.gov.br/nfe2/services/NFeAutorizacao4',
        evento_prod: 'https://nfe.fazenda.mg.gov.br/nfe2/services/NFeRecepcaoEvento4',
        evento_homol: 'https://hnfe.fazenda.mg.gov.br/nfe2/services/NFeRecepcaoEvento4'
    },
    'PR': {
        producao: 'https://nfe.fazenda.pr.gov.br/nfe/NFeAutorizacao4',
        homologacao: 'https://homologacao.nfe.fazenda.pr.gov.br/nfe/NFeAutorizacao4',
        evento_prod: 'https://nfe.fazenda.pr.gov.br/nfe/NFeRecepcaoEvento4',
        evento_homol: 'https://homologacao.nfe.fazenda.pr.gov.br/nfe/NFeRecepcaoEvento4'
    },
    'RS': {
        producao: 'https://nfe.sefaz.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx',
        homologacao: 'https://nfe-homologacao.sefaz.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx',
        evento_prod: 'https://nfe.sefaz.rs.gov.br/ws/recepcaoevento/recepcaoevento4.asmx',
        evento_homol: 'https://nfe-homologacao.sefaz.rs.gov.br/ws/recepcaoevento/recepcaoevento4.asmx'
    },
    'GO': {
        producao: 'https://nfe.sefaz.go.gov.br/nfe/services/NFeAutorizacao4',
        homologacao: 'https://homolog.sefaz.go.gov.br/nfe/services/NFeAutorizacao4',
        evento_prod: 'https://nfe.sefaz.go.gov.br/nfe/services/NFeRecepcaoEvento4',
        evento_homol: 'https://homolog.sefaz.go.gov.br/nfe/services/NFeRecepcaoEvento4'
    },
    'MT': {
        producao: 'https://nfe.sefaz.mt.gov.br/nfews/v2/services/NfeAutorizacao4',
        homologacao: 'https://homologacao.sefaz.mt.gov.br/nfews/v2/services/NfeAutorizacao4',
        evento_prod: 'https://nfe.sefaz.mt.gov.br/nfews/v2/services/NfeRecepcaoEvento4',
        evento_homol: 'https://homologacao.sefaz.mt.gov.br/nfews/v2/services/NfeRecepcaoEvento4'
    },
    'MS': {
        producao: 'https://nfe.fazenda.ms.gov.br/ws/NFeAutorizacao4',
        homologacao: 'https://hom.nfe.fazenda.ms.gov.br/ws/NFeAutorizacao4',
        evento_prod: 'https://nfe.fazenda.ms.gov.br/ws/NFeRecepcaoEvento4',
        evento_homol: 'https://hom.nfe.fazenda.ms.gov.br/ws/NFeRecepcaoEvento4'
    },
    'BA': {
        producao: 'https://nfe.sefaz.ba.gov.br/webservices/NFeAutorizacao4/NFeAutorizacao4.asmx',
        homologacao: 'https://hnfe.sefaz.ba.gov.br/webservices/NFeAutorizacao4/NFeAutorizacao4.asmx',
        evento_prod: 'https://nfe.sefaz.ba.gov.br/webservices/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx',
        evento_homol: 'https://hnfe.sefaz.ba.gov.br/webservices/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx'
    },
    'SVRS': {
        producao: 'https://nfe.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx',
        homologacao: 'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx',
        evento_prod: 'https://nfe.svrs.rs.gov.br/ws/recepcaoevento/recepcaoevento4.asmx',
        evento_homol: 'https://nfe-homologacao.svrs.rs.gov.br/ws/recepcaoevento/recepcaoevento4.asmx'
    }
};

// Mapeamento dos Servidores Autorizadores de NFC-e (Mod 65)
const SERVIDORES_NFCE = {
    'SP': {
        producao: 'https://nfce.fazenda.sp.gov.br/ws/NFeAutorizacao4.asmx',
        homologacao: 'https://homologacao.nfce.fazenda.sp.gov.br/ws/NFeAutorizacao4.asmx',
        evento_prod: 'https://nfce.fazenda.sp.gov.br/ws/NFeRecepcaoEvento4.asmx',
        evento_homol: 'https://homologacao.nfce.fazenda.sp.gov.br/ws/NFeRecepcaoEvento4.asmx',
        qrcode_prod: 'https://www.nfce.fazenda.sp.gov.br/qrcode',
        qrcode_homol: 'https://www.homologacao.nfce.fazenda.sp.gov.br/qrcode'
    },
    'MG': {
        producao: 'https://nfce.fazenda.mg.gov.br/portalnfce/services/NFeAutorizacao4',
        homologacao: 'https://hnfce.fazenda.mg.gov.br/portalnfce/services/NFeAutorizacao4',
        evento_prod: 'https://nfce.fazenda.mg.gov.br/portalnfce/services/NFeRecepcaoEvento4',
        evento_homol: 'https://hnfce.fazenda.mg.gov.br/portalnfce/services/NFeRecepcaoEvento4',
        qrcode_prod: 'https://nfce.fazenda.mg.gov.br/portalnfce/sistema/qrcode.xhtml',
        qrcode_homol: 'https://hnfce.fazenda.mg.gov.br/portalnfce/sistema/qrcode.xhtml'
    },
    'PR': {
        producao: 'https://nfce.fazenda.pr.gov.br/nfce/NFeAutorizacao4',
        homologacao: 'https://homologacao.nfce.fazenda.pr.gov.br/nfce/NFeAutorizacao4',
        evento_prod: 'https://nfce.fazenda.pr.gov.br/nfce/NFeRecepcaoEvento4',
        evento_homol: 'https://homologacao.nfce.fazenda.pr.gov.br/nfce/NFeRecepcaoEvento4',
        qrcode_prod: 'http://www.fazenda.pr.gov.br/nfce/qrcode',
        qrcode_homol: 'http://www.fazenda.pr.gov.br/nfce/qrcode'
    },
    'RS': {
        producao: 'https://nfce.sefaz.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx',
        homologacao: 'https://nfce-homologacao.sefaz.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx',
        evento_prod: 'https://nfce.sefaz.rs.gov.br/ws/recepcaoevento/recepcaoevento4.asmx',
        evento_homol: 'https://nfce-homologacao.sefaz.rs.gov.br/ws/recepcaoevento/recepcaoevento4.asmx',
        qrcode_prod: 'https://www.sefaz.rs.gov.br/NFCE/NFCE-COM.aspx',
        qrcode_homol: 'https://www.sefaz.rs.gov.br/NFCE/NFCE-COM.aspx'
    },
    'GO': {
        producao: 'https://nfe.sefaz.go.gov.br/nfe/services/NFeAutorizacao4',
        homologacao: 'https://homolog.sefaz.go.gov.br/nfe/services/NFeAutorizacao4',
        evento_prod: 'https://nfe.sefaz.go.gov.br/nfe/services/NFeRecepcaoEvento4',
        evento_homol: 'https://homolog.sefaz.go.gov.br/nfe/services/NFeRecepcaoEvento4',
        qrcode_prod: 'https://nfe.sefaz.go.gov.br/nfeweb/sites/nfce/danfeNFCe',
        qrcode_homol: 'https://homolog.sefaz.go.gov.br/nfeweb/sites/nfce/danfeNFCe'
    },
    'MT': {
        producao: 'https://nfce.sefaz.mt.gov.br/nfcews/services/NfeAutorizacao4',
        homologacao: 'https://homologacao.sefaz.mt.gov.br/nfcews/services/NfeAutorizacao4',
        evento_prod: 'https://nfce.sefaz.mt.gov.br/nfcews/services/NfeRecepcaoEvento4',
        evento_homol: 'https://homologacao.sefaz.mt.gov.br/nfcews/services/NfeRecepcaoEvento4',
        qrcode_prod: 'http://www.sefaz.mt.gov.br/nfce/consultanfce',
        qrcode_homol: 'http://homologacao.sefaz.mt.gov.br/nfce/consultanfce'
    },
    'BA': {
        producao: 'https://nfce.sefaz.ba.gov.br/webservices/NFeAutorizacao4/NFeAutorizacao4.asmx',
        homologacao: 'https://hnfce.sefaz.ba.gov.br/webservices/NFeAutorizacao4/NFeAutorizacao4.asmx',
        evento_prod: 'https://nfce.sefaz.ba.gov.br/webservices/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx',
        evento_homol: 'https://hnfce.sefaz.ba.gov.br/webservices/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx',
        qrcode_prod: 'http://nfe.sefaz.ba.gov.br/servicos/nfce/qrcode.aspx',
        qrcode_homol: 'http://hnfe.sefaz.ba.gov.br/servicos/nfce/qrcode.aspx'
    },
    'SVRS': {
        producao: 'https://nfce.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx',
        homologacao: 'https://nfce-homologacao.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx',
        evento_prod: 'https://nfce.svrs.rs.gov.br/ws/recepcaoevento/recepcaoevento4.asmx',
        evento_homol: 'https://nfce-homologacao.svrs.rs.gov.br/ws/recepcaoevento/recepcaoevento4.asmx',
        qrcode_prod: 'https://www.sefaz.rs.gov.br/NFCE/NFCE-COM.aspx',
        qrcode_homol: 'https://www.sefaz.rs.gov.br/NFCE/NFCE-COM.aspx'
    }
};

/**
 * Retorna as URLs da SEFAZ para autorização e eventos
 * @param {string} modelo '55' (NFe) ou '65' (NFCe)
 * @param {string} uf Sigla do estado (ex: 'SP', 'MG', 'GO')
 * @param {string} ambiente 'producao' ou 'homologacao'
 */
function obterEndpointsSefaz(modelo, uf, ambiente = 'homologacao') {
    const estado = (uf || 'SP').toUpperCase().trim();
    const amb = ambiente === 'producao' ? 'producao' : 'homologacao';
    const ambEvt = ambiente === 'producao' ? 'evento_prod' : 'evento_homol';
    const ambQr = ambiente === 'producao' ? 'qrcode_prod' : 'qrcode_homol';

    if (modelo === '65') {
        const configNFCe = SERVIDORES_NFCE[estado] || SERVIDORES_NFCE['SVRS'];
        return {
            autorizacaoUrl: configNFCe[amb],
            eventoUrl: configNFCe[ambEvt],
            qrCodeUrl: configNFCe[ambQr] || SERVIDORES_NFCE['SVRS'][ambQr],
            cUF: CODIGOS_UF[estado] || '35'
        };
    } else {
        const configNFe = SERVIDORES_NFE[estado] || SERVIDORES_NFE['SVRS'];
        return {
            autorizacaoUrl: configNFe[amb],
            eventoUrl: configNFe[ambEvt],
            cUF: CODIGOS_UF[estado] || '35'
        };
    }
}

module.exports = {
    CODIGOS_UF,
    obterEndpointsSefaz
};
