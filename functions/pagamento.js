const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");

const MP_TOKEN = process.env.MERCADOPAGO_TOKEN || 'APP_USR-5617925851399894-093015-267239be9015b1c9ddaa929ac0594443-3725426093';
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

async function criarUsuarioFirebase(email, nomePlano, pagamentoId) {
  const auth = getAuth();
  const db = getDb();
  let uid;

  try {
    const novoUsuario = await auth.createUser({
      email: email,
      emailVerified: false,
      password: gerarSenhaTemporaria(),
      displayName: email.split('@')[0]
    });
    uid = novoUsuario.uid;
    console.log(`[criarUsuario] Novo usuário criado: ${uid}`);
  } catch (err) {
    if (err.code === 'auth/email-already-exists') {
      const usuarioExistente = await auth.getUserByEmail(email);
      uid = usuarioExistente.uid;
      console.log(`[criarUsuario] Usuário já existente: ${uid}`);
    } else {
      throw err;
    }
  }

  await db.collection('usuarios').doc(uid).set({
    email: email,
    plano: nomePlano,
    pagamentoId: String(pagamentoId),
    planoAtivadoEm: admin.firestore.FieldValue.serverTimestamp(),
    ativo: true
  }, { merge: true });

  try {
    const linkReset = await auth.generatePasswordResetLink(email);
    console.log(`[criarUsuario] Link de reset para ${email}: ${linkReset}`);
  } catch (err) {
    console.warn('[criarUsuario] Falha ao gerar link de reset:', err.message);
  }

  return uid;
}

// 1. Endpoint: criarPagamento
exports.criarPagamento = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).send('');
  if (req.method !== 'POST') return res.status(405).send('Método não permitido');

  const { tipo, valorCentavos, cardToken, emailPagador, nomePlano } = req.body;
  const db = getDb();

  try {
    if (tipo === 'pix') {
      const pagamento = await axios.post(
        `${MP_BASE}/v1/payments`,
        {
          transaction_amount: Number(valorCentavos) / 100,
          payment_method_id: 'pix',
          payer: { email: emailPagador || 'contato@primastecnologia.com' },
          description: `Assinatura Plano ${nomePlano || 'SaaS'} — Primas Tecnologia`,
          notification_url: 'https://us-central1-lojafc-a31f9.cloudfunctions.net/webhookMercadoPago'
        },
        {
          headers: {
            'Authorization': `Bearer ${MP_TOKEN}`,
            'X-Idempotency-Key': `pix-${Date.now()}-${Math.random()}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const dados = pagamento.data;
      const pixCopiaCola = dados.point_of_interaction?.transaction_data?.qr_code || '';

      await db.collection('pagamentos_pendentes').doc(String(dados.id)).set({
        pagamentoId: dados.id,
        tipo: 'pix',
        nomePlano: nomePlano || 'Padrao',
        email: emailPagador || null,
        status: 'pending',
        criadoEm: admin.firestore.FieldValue.serverTimestamp()
      });

      return res.status(200).json({
        sucesso: true,
        pixCopiaCola: pixCopiaCola,
        pagamentoId: dados.id
      });

    } else if (tipo === 'cartao' || tipo === 'assinatura') {
      let subscricao;
      // Se for ambiente de testes do Mercado Pago, usa o comprador de testes registrado
      let emailMp = emailPagador;
      if (MP_TOKEN.includes('3725426093') || !emailMp || emailMp.includes('silvaborges') || emailMp.includes('primas')) {
        emailMp = 'test_user_1362349500493985627@testuser.com';
      }

      try {
        const subscricaoPayload = {
          payer_email: emailMp,
          back_url: 'https://lojafc-a31f9.web.app/sistema/login.html',
          reason: `Assinatura Plano ${nomePlano || 'SaaS'} — Primas Tecnologia`,
          auto_recurring: {
            frequency: 1,
            frequency_type: 'months',
            transaction_amount: Number(valorCentavos) / 100,
            currency_id: 'BRL'
          }
        };

        if (cardToken) {
          subscricaoPayload.card_token_id = cardToken;
          subscricaoPayload.status = 'authorized';
        }

        subscricao = await axios.post(
          `${MP_BASE}/preapproval`,
          subscricaoPayload,
          {
            headers: {
              'Authorization': `Bearer ${MP_TOKEN}`,
              'Content-Type': 'application/json'
            }
          }
        );
      } catch (errSub) {
        console.warn('[criarPagamento] Tentativa preapproval com token:', errSub.response?.data?.message || errSub.message);
        
        // Tentativa 2: Gera o link de checkout de assinatura oficial do Mercado Pago (init_point)
        subscricao = await axios.post(
          `${MP_BASE}/preapproval`,
          {
            payer_email: emailMp,
            back_url: 'https://lojafc-a31f9.web.app/sistema/login.html',
            reason: `Assinatura Plano ${nomePlano || 'SaaS'} — Primas Tecnologia`,
            auto_recurring: {
              frequency: 1,
              frequency_type: 'months',
              transaction_amount: Number(valorCentavos) / 100,
              currency_id: 'BRL'
            }
          },
          {
            headers: {
              'Authorization': `Bearer ${MP_TOKEN}`,
              'Content-Type': 'application/json'
            }
          }
        );
      }

      const dados = subscricao.data;
      const status = dados.status;

      if (status === 'approved' || status === 'authorized') {
        if (emailPagador) {
          await criarUsuarioFirebase(emailPagador, nomePlano, dados.id);
        }
        return res.status(200).json({ aprovado: true, status: status, id: dados.id });
      } else if (dados.init_point) {
        return res.status(200).json({ aprovado: true, initPoint: dados.init_point, id: dados.id });
      } else {
        return res.status(200).json({
          aprovado: false,
          status: status,
          mensagem: traduzirStatusMP(dados.status_detail) || 'Assinatura pendente de confirmação.'
        });
      }
    } else {
      return res.status(200).json({ sucesso: false, erro: 'Tipo de pagamento inválido.' });
    }
  } catch (err) {
    const detalhe = err.response?.data || err.message;
    console.error('[criarPagamento] Aviso Mercado Pago:', detalhe);
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
  // Retorna HTTP 200 IMEDIATAMENTE (requisito obrigatório do Mercado Pago e simulador)
  res.status(200).send('OK');

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
      return;
    }

    const db = getDb();

    // Notificação de Pagamento (PIX, Cartão, etc.)
    if (type === 'payment' || action.startsWith('payment')) {
      const resp = await axios.get(
        `${MP_BASE}/v1/payments/${dataId}`,
        { headers: { 'Authorization': `Bearer ${MP_TOKEN}` } }
      );

      const pagamento = resp.data;
      const status = pagamento.status;
      console.log(`[webhook] Pagamento ${dataId} -> status: ${status}`);

      const docRef = db.collection('pagamentos_pendentes').doc(String(dataId));
      await docRef.set({ status, ultimaAtualizacao: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });

      if (status === 'approved') {
        const emailPagador = pagamento.payer?.email;
        const pendenteDoc = await docRef.get();
        const nomePlano = pendenteDoc.exists ? (pendenteDoc.data().nomePlano || 'SaaS Pro') : 'SaaS Pro';

        if (emailPagador) {
          await criarUsuarioFirebase(emailPagador, nomePlano, dataId);
          console.log(`[webhook] Acesso liberado para: ${emailPagador}`);
        }
      }
    }

    // Notificação de Assinatura Recorrente (Preapproval)
    if (type === 'subscription_preapproval' || type === 'preapproval' || action.includes('preapproval')) {
      const resp = await axios.get(
        `${MP_BASE}/preapproval/${dataId}`,
        { headers: { 'Authorization': `Bearer ${MP_TOKEN}` } }
      );

      const assinatura = resp.data;
      const status = assinatura.status; // 'authorized', 'paused', 'cancelled'
      console.log(`[webhook] Assinatura ${dataId} -> status: ${status}`);

      const emailPagador = assinatura.payer_email;
      if (status === 'authorized' && emailPagador) {
        await criarUsuarioFirebase(emailPagador, assinatura.reason || 'Assinatura SaaS', dataId);
        console.log(`[webhook] Assinatura autorizada e usuário liberado: ${emailPagador}`);
      }
    }

  } catch (err) {
    console.error('[webhook] Erro ao processar:', err.response?.data || err.message);
  }
});
