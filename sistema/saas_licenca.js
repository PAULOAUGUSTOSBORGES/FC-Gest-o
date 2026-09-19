// ==========================================================================
// SAAS_LICENCA.JS - CLIENTE UNIVERSAL DE LICENCIAMENTO MULTI-SISTEMAS
// Conecta ao banco central do SaaS Master para validar licença e módulos
// Compatível com FC-Gestão, FC-Food, FC-Barber e qualquer novo aplicativo
// ==========================================================================

(function() {
    const SAAS_CONFIG = {
        apiKey: "AIzaSyAvaDdhJSFP6WKs8UFRvlQmNGFlc1ZKgFk", // Web API Key do projeto fcgestao-testes
        authDomain: "fcgestao-testes.firebaseapp.com",
        projectId: "fcgestao-testes",
        storageBucket: "fcgestao-testes.firebasestorage.app",
        messagingSenderId: "126917183785",
        appId: "1:126917183785:web:32cdc3fd9b8e1064658f38"
    };

    let saasApp = null;
    let saasDb = null;

    function obterInstanciaSaaS() {
        if (saasDb) return saasDb;
        if (typeof firebase === 'undefined') return null;

        try {
            // Se apiKey ainda não foi preenchida, não trava a loja
            if (!SAAS_CONFIG.apiKey || SAAS_CONFIG.apiKey.includes('COLE_')) {
                return null;
            }

            // Inicializa conexão secundária isolada
            const appExistente = firebase.apps.find(a => a.name === 'saasLicenseApp');
            if (appExistente) {
                saasApp = appExistente;
            } else {
                saasApp = firebase.initializeApp(SAAS_CONFIG, 'saasLicenseApp');
            }
            saasDb = saasApp.firestore();
            return saasDb;
        } catch (e) {
            console.warn('[SaaS Licença] Conexão remota indisponível, operando com cache local:', e.message);
            return null;
        }
    }

    // Consulta e valida licença no banco do SaaS Master
    async function consultarLicencaCentral(empresaId, sistemaId = 'fc_gestao') {
        const cacheKey = `saas_licenca_${empresaId}`;
        const cacheLocal = localStorage.getItem(cacheKey);
        let licencaCached = null;
        if (cacheLocal) {
            try { licencaCached = JSON.parse(cacheLocal); } catch(e) {}
        }

        const sDb = obterInstanciaSaaS();
        if (!sDb) {
            // Fallback resiliente: se não há conexão com o SaaS, usa cache local ou libera modo offline seguro
            return licencaCached || {
                status: 'ATIVO',
                plano: 'plano_pro',
                sistemaId: sistemaId,
                modulosLiberados: ['pdv', 'vendas', 'produtos', 'fiscal', 'financeiro', 'caixa', 'compras', 'relatorios', 'site'],
                origem: 'fallback_offline'
            };
        }

        try {
            const docSnap = await sDb.collection('empresas').doc(empresaId).get();
            if (docSnap.exists) {
                const dados = docSnap.data();
                dados.id = docSnap.id;
                localStorage.setItem(cacheKey, JSON.stringify(dados));
                window.currentSaaSLicense = dados;
                return dados;
            } else if (licencaCached) {
                return licencaCached;
            }
        } catch (err) {
            console.warn('[SaaS Licença] Erro ao consultar servidor central:', err);
            if (licencaCached) return licencaCached;
        }

        // Default seguro para a empresa fundadora ou testes
        return {
            status: 'ATIVO',
            plano: 'plano_pro',
            sistemaId: sistemaId,
            modulosLiberados: ['pdv', 'vendas', 'produtos', 'fiscal', 'financeiro', 'caixa', 'compras', 'relatorios', 'site']
        };
    }

    window.consultarLicencaCentral = consultarLicencaCentral;
    window.obterInstanciaSaaS = obterInstanciaSaaS;
    window.SAAS_CONFIG = SAAS_CONFIG;
})();
