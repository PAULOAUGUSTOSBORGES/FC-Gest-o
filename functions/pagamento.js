const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");

const MP_TOKEN = process.env.MERCADOPAGO_TOKEN || 'APP_USR-4139999599254354-093013-a40e774b9a2e412dd44185483865af54-208400622';
const MP_BASE = 'https://api.mercadopago.com';

function getDb() {
  return admin.firestore();
}

function getAuth() {
  return admin.auth();
}

function gerarSenhaTemporaria() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
  let senha = '';
  for (let i = 0; i < 16; i++) {
    senha += chars[Math.floor(Math.random() * chars.length)];
  }
  return senha;
}

function traduzirStatusMP(statusDetail) {
  const traducoes = {
    'cc_rejected_bad_filled_card_number': 'Número do cartão inválido.',
    'cc_rejected_bad_filled_date': 'Data de validade inválida.',
    'cc_rejected_bad_filled_other': 'Dados do cartão incorretos.',
    'cc_rejected_bad_filled_security_code': 'CVV inválido.',
    'cc_rejected_blacklist': 'Cartão bloqueado pela operadora.',
    'cc_rejected_call_for_authorize': 'Operadora solicitou autorização. Ligue para o banco.',
    'cc_rejected_card_disabled': 'Cartão desativado.',
    'cc_rejected_duplicated_payment': 'Pagamento duplicado detectado.',
    'cc_rejected_high_risk': 'Pagamento recusado por segurança.',
    'cc_rejected_insufficient_amount': 'Saldo insuficiente.',
    'cc_rejected_invalid_installments': 'Número de parcelas inválido.',
    'cc_rejected_max_attempts': 'Limite de tentativas atingido. Use outro cartão.'
  };
  return traducoes[statusDetail] || 'Pagamento recusado. Verifique os dados e tente novamente.';
}

async function criarUsuarioFirebase(email, nomePlano, pagamentoId, senha, dadosExtras = {}) {
  const auth = getAuth();
  const db = getDb();
  let uid;

  try {
    const novoUsuario = await auth.createUser({
      email: email,
      emailVerified: false,
      password: senha || gerarSenhaTemporaria(),
      displayName: email.split('@')[0]
    });
    uid = novoUsuario.uid;
    console.log(`[criarUsuario] Novo usuário criado: ${uid}`);
  } catch (err) {
    if (err.code === 'auth/email-already-exists') {
      const usuarioExistente = await auth.getUserByEmail(email);
      uid = usuarioExistente.uid;
      if (senha) {
        await auth.updateUser(uid, { password: senha });
      }
      console.log(`[criarUsuario] Usuário já existente: ${uid}`);
    } else {
      throw err;
    }
  }

  const nomeFinalEmpresa = (dadosExtras && dadosExtras.nomeEmpresa) ? dadosExtras.nomeEmpresa.trim() : 'Minha Loja';

  // 1. Localiza a empresa cadastrada pelo cliente no cadastro.html
  let empresaId = null;
  try {
    const empSnap = await db.collection('empresas')
      .where('emailAcesso', '==', email)
      .get();

    if (!empSnap.empty) {
      const docs = empSnap.docs.sort((a, b) => {
        const da = a.data().dataCriacao && a.data().dataCriacao.toMillis ? a.data().dataCriacao.toMillis() : 0;
        const dbVal = b.data().dataCriacao && b.data().dataCriacao.toMillis ? b.data().dataCriacao.toMillis() : 0;
        return dbVal - da;
      });
      const empDoc = docs[0];
      empresaId = empDoc.id;
      const empUpdate = {
        status: 'ATIVO',
        pago: true,
        pagamentoId: String(pagamentoId),
        planoAtivadoEm: admin.firestore.FieldValue.serverTimestamp()
      };
      if (nomeFinalEmpresa && (!empDoc.data().nomeEmpresa || empDoc.data().nomeEmpresa === 'Minha Loja')) {
        empUpdate.nomeEmpresa = nomeFinalEmpresa;
      }
      if (dadosExtras.whatsapp) empUpdate.whatsapp = dadosExtras.whatsapp;
      if (dadosExtras.cidade) empUpdate.cidade = dadosExtras.cidade;
      if (dadosExtras.nomeResponsavel) empUpdate.responsavel = dadosExtras.nomeResponsavel;

      await empDoc.ref.set(empUpdate, { merge: true });
      console.log(`[criarUsuario] Empresa ${empresaId} ativada com sucesso!`);
    }
  } catch (eEmp) {
    console.warn('[criarUsuario] Aviso ao buscar empresa:', eEmp.message);
  }

  // Se ainda não tiver empresaId, gera um id padrao
  if (!empresaId) {
    empresaId = 'emp_' + uid.substring(0, 10);
    await db.collection('empresas').doc(empresaId).set({
      nomeEmpresa: nomeFinalEmpresa,
      responsavel: dadosExtras.nomeResponsavel || '',
      whatsapp: dadosExtras.whatsapp || '',
      cidade: dadosExtras.cidade || '',
      emailAcesso: email,
      plano: nomePlano,
      status: 'ATIVO',
      pago: true,
      pagamentoId: String(pagamentoId),
      dataCriacao: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  }

  // Garante que o documento configuracoes/config seja criado com a identidade da nova empresa
  try {
    const configRef = db.collection('empresas').doc(empresaId).collection('configuracoes').doc('config');
    const configSnap = await configRef.get();
    const configAtual = configSnap.exists ? (configSnap.data() || {}) : {};
    const empAtual = configAtual.empresa || {};

    const nomeConfig = (empAtual.nome && empAtual.nome !== 'FC Móveis') ? empAtual.nome : nomeFinalEmpresa;
    const fantasiaConfig = (empAtual.fantasia && empAtual.fantasia !== 'FC Móveis') ? empAtual.fantasia : nomeFinalEmpresa;

    await configRef.set({
      empresa: {
        nome: nomeConfig,
        fantasia: fantasiaConfig,
        telefone: empAtual.telefone || dadosExtras.whatsapp || '',
        cidade: empAtual.cidade || dadosExtras.cidade || '',
        email: empAtual.email || email,
        cnpj: empAtual.cnpj || '',
        logo: empAtual.logo || ''
      },
      taxas: configAtual.taxas || { 'Dinheiro': 0, 'PIX': 0, 'Cartão Débito': 0, 'Boleto': 0, 'Fiado': 0, 'Cartão Crédito': { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0 } },
      prazos: configAtual.prazos || { 'Fiado': 30, 'Boleto': 30, 'Cartão Crédito': 1, 'Cartão Débito': 1 },
      pdv: configAtual.pdv || { permite_estoque_negativo: false }
    }, { merge: true });
    console.log(`[criarUsuario] Documento configuracoes/config configurado para ${empresaId} (${nomeConfig})`);
  } catch (eConf) {
    console.warn('[criarUsuario] Aviso ao criar configuracoes/config:', eConf.message);
  }

  // 2. Salva o documento do usuário vinculando empresaId (obrigatório para login.js)
  await db.collection('usuarios').doc(uid).set({
    email: email,
    plano: nomePlano,
    empresaId: empresaId,
    pagamentoId: String(pagamentoId),
    planoAtivadoEm: admin.firestore.FieldValue.serverTimestamp(),
    ativo: true
  }, { merge: true });

  // 3. Cadastra o funcionário Admin na subcoleção para o FC Gestão liberar a sessão
  try {
    await db.collection('empresas').doc(empresaId).collection('funcionarios').doc(uid).set({
      nome: email.split('@')[0],
      email: email,
      isAdmin: true,
      perm_gestao: true,
      perm_fiscal: true,
      perm_operacao: true,
      perm_pdv: true,
      ativo: true,
      criadoEm: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    console.log(`[criarUsuario] Funcionário Admin registrado em empresas/${empresaId}/funcionarios/${uid}`);
  } catch (eFunc) {
    console.warn('[criarUsuario] Aviso ao criar funcionário:', eFunc.message);
  }

  try {
    const linkReset = await auth.generatePasswordResetLink(email);
    console.log(`[criarUsuario] Link de reset para ${email}: ${linkReset}`);
  } catch (err) {
    console.warn('[criarUsuario] Falha ao gerar link de reset:', err.message);
  }

  return uid;
}

// 1. Endpoint: criarPagamento — usa Checkout Pro do Mercado Pago (PRODUÇÃO)
// Gera o link oficial com PIX, cartão de crédito, boleto, saldo Mercado Pago
exports.criarPagamento = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).send('');
  if (req.method !== 'POST') return res.status(405).send('Método não permitido');

  const { valorCentavos, emailPagador, nomePlano, senha, nomeEmpresa, nomeResponsavel, whatsapp, cidade } = req.body;
  const db = getDb();

  try {
    const emailMp = emailPagador || 'cliente@primastecnologia.com';

    // Checkout Pro Oficial: gera link oficial com PIX, cartão, etc.
    const preferencePayload = {
      items: [{
        title: `Plano ${(nomePlano || 'SaaS').substring(0, 50)}`,
        quantity: 1,
        unit_price: Number(valorCentavos) / 100,
        currency_id: 'BRL'
      }],
      payment_methods: {
        excluded_payment_methods: [],
        excluded_payment_types: [],
        installments: 12
      },
      back_urls: {
        success: 'https://lojafc-a31f9.web.app/sistema/login.html',
        failure: 'https://pauloaugustosborges.github.io/IsabellaTecnologia/cadastro.html',
        pending: 'https://lojafc-a31f9.web.app/sistema/login.html'
      },
      auto_return: 'approved',
      notification_url: 'https://us-central1-lojafc-a31f9.cloudfunctions.net/webhookMercadoPago',
      external_reference: emailPagador || 'cliente@primastecnologia.com',
      statement_descriptor: 'PRIMAS TECNOLOGIA'
    };

    if (emailPagador && !emailPagador.toLowerCase().includes('silvaborges') && !emailPagador.toLowerCase().includes('pauloaugusto')) {
      preferencePayload.payer = { email: emailPagador };
    }

    const preference = await axios.post(
      `${MP_BASE}/checkout/preferences`,
      preferencePayload,
      {
        headers: {
          'Authorization': `Bearer ${MP_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const dados = preference.data;
    const initPoint = dados.init_point; // Link Oficial de Produção do Mercado Pago

    // Salva no Firestore para o webhook processar quando o pagamento for confirmado
    await db.collection('pagamentos_pendentes').doc(String(dados.id)).set({
      preferenceId: dados.id,
      nomePlano: nomePlano || 'Padrao',
      email: emailPagador || null,
      senha: senha || null,
      nomeEmpresa: nomeEmpresa || null,
      nomeResponsavel: nomeResponsavel || null,
      whatsapp: whatsapp || null,
      cidade: cidade || null,
      valor: Number(valorCentavos) / 100,
      status: 'pending',
      criadoEm: admin.firestore.FieldValue.serverTimestamp()
    });

    if (emailPagador) {
      await db.collection('pagamentos_pendentes_email').doc(emailPagador.toLowerCase().trim()).set({
        preferenceId: dados.id,
        nomePlano: nomePlano || 'Padrao',
        email: emailPagador,
        senha: senha || null,
        nomeEmpresa: nomeEmpresa || null,
        nomeResponsavel: nomeResponsavel || null,
        whatsapp: whatsapp || null,
        cidade: cidade || null,
        valor: Number(valorCentavos) / 100,
        status: 'pending',
        atualizadoEm: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }

    return res.status(200).json({
      sucesso: true,
      initPoint: initPoint,
      id: dados.id
    });

  } catch (err) {
    const detalhe = err.response?.data || err.message;
    console.error('[criarPagamento] Erro Mercado Pago:', detalhe);
    return res.status(200).json({
      sucesso: false,
      erro: err.response?.data?.message || err.message,
      detalhe: detalhe
    });
  }
});

// 2. Endpoint: verificarPix
exports.verificarPix = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).send('');

  const { nomePlano, emailPagador, pagamentoId } = req.body || {};
  const db = getDb();

  try {
    if (pagamentoId) {
      const doc = await db.collection('pagamentos_pendentes').doc(String(pagamentoId)).get();
      if (doc.exists && doc.data().status === 'approved') {
        return res.status(200).json({ aprovado: true });
      }
    }

    let query = db.collection('pagamentos_pendentes')
      .where('tipo', '==', 'pix')
      .where('status', '==', 'approved');

    if (nomePlano) {
      query = query.where('nomePlano', '==', nomePlano);
    }
    if (emailPagador) {
      query = query.where('email', '==', emailPagador);
    }

    const snapshot = await query.orderBy('criadoEm', 'desc').limit(1).get();

    if (!snapshot.empty) {
      return res.status(200).json({ aprovado: true });
    } else {
      return res.status(200).json({
        aprovado: false,
        mensagem: 'Pagamento PIX ainda não identificado.'
      });
    }
  } catch (err) {
    console.error('[verificarPix] Erro:', err.message);
    return res.status(500).json({ erro: 'Erro ao verificar PIX.' });
  }
});

// 3. Endpoint: webhookMercadoPago
exports.webhookMercadoPago = functions.https.onRequest(async (req, res) => {
  try {
    const body = req.body || {};
    const query = req.query || {};

    const action = body.action || '';
    const type = body.type || query.topic || '';
    const dataId = body.data?.id || body.id || query.id || query['data.id'];

    console.log(`[webhook] Notificação recebida: action=${action}, type=${type}, id=${dataId}`);

    // Se for simulação ou ping de teste do painel com ID 123456
    if (!dataId || String(dataId) === '123456' || String(dataId) === '123456789') {
      console.log('[webhook] Teste ou simulador detectado. Conexão validada com sucesso!');
      return res.status(200).send('OK');
    }

    const db = getDb();

    // Notificação de Pagamento — Checkout Pro (PIX, Cartão, Boleto)
    if (type === 'payment' || action.startsWith('payment') || query.type === 'payment') {
      const resp = await axios.get(
        `${MP_BASE}/v1/payments/${dataId}`,
        { headers: { 'Authorization': `Bearer ${MP_TOKEN}` } }
      );

      const pagamento = resp.data;
      const status = pagamento.status;
      console.log(`[webhook] Pagamento ${dataId} -> status: ${status}`);

      // external_reference contém o email REAL do cliente (gravado na preferência)
      const emailReal = pagamento.external_reference || pagamento.payer?.email;

      const docRef = db.collection('pagamentos_pendentes').doc(String(dataId));
      await docRef.set({ status, ultimaAtualizacao: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });

      if ((status === 'approved' || status === 'refunded') && emailReal) {
        let nomePlano = 'SaaS Pro';
        let senhaCliente = null;
        let dadosExtras = {};

        try {
          const docEmail = await db.collection('pagamentos_pendentes_email').doc(emailReal.toLowerCase().trim()).get();
          if (docEmail.exists) {
            const dataEmail = docEmail.data();
            nomePlano = dataEmail.nomePlano || nomePlano;
            senhaCliente = dataEmail.senha || null;
            dadosExtras = {
              nomeEmpresa: dataEmail.nomeEmpresa || null,
              nomeResponsavel: dataEmail.nomeResponsavel || null,
              whatsapp: dataEmail.whatsapp || null,
              cidade: dataEmail.cidade || null
            };
          } else {
            const docPag = await db.collection('pagamentos_pendentes').doc(String(dataId)).get();
            if (docPag.exists) {
              const dataPag = docPag.data();
              nomePlano = dataPag.nomePlano || nomePlano;
              senhaCliente = dataPag.senha || null;
              dadosExtras = {
                nomeEmpresa: dataPag.nomeEmpresa || null,
                nomeResponsavel: dataPag.nomeResponsavel || null,
                whatsapp: dataPag.whatsapp || null,
                cidade: dataPag.cidade || null
              };
            }
          }
        } catch (e) {
          console.warn('[webhook] Erro ao buscar dados pendentes por email:', e.message);
        }

        await criarUsuarioFirebase(emailReal, nomePlano, dataId, senhaCliente, dadosExtras);
        console.log(`[webhook] Acesso liberado automaticamente para: ${emailReal} (Empresa: ${dadosExtras.nomeEmpresa || 'Minha Loja'})`);
      }
    }

    return res.status(200).send('OK');
  } catch (err) {
    console.error('[webhook] Erro ao processar:', err.response?.data || err.message);
    return res.status(200).send('OK');
  }
});


