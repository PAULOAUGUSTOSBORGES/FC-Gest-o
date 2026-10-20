// ==========================================================================
// CONCILIAÇÃO BANCÁRIA - TINTAS ERP / FC GESTÃO
// ==========================================================================

// Estado Global
const itensOcultadosSalvos = JSON.parse(localStorage.getItem('fc_concilia_ocultados') || '[]');
const itensExcluidosSalvos = JSON.parse(localStorage.getItem('fc_concilia_excluidos') || '[]');
const todosOcultados = new Set([...itensOcultadosSalvos, ...itensExcluidosSalvos]);
localStorage.setItem('fc_concilia_ocultados', JSON.stringify(Array.from(todosOcultados)));
localStorage.removeItem('fc_concilia_excluidos');

window.conciliaState = {
  extrato: [],
  sistema: [],
  selectedExtratoId: null,
  selectedSistemaId: null,
  itensOcultados: todosOcultados,
  checksSistema: new Set(),
  modoVisao: 'pendentes'
};

// ==========================================
// 1. NOTIFICAÇÕES (TOAST)
// ==========================================
function showConciliaToast(msg, type = "info") {
  if (typeof window.showToast === "function") {
    try { window.showToast(msg, type); return; } catch (_) {}
  }
  const bg = type === "success" ? "#16a34a" : type === "error" ? "#dc2626" : type === "warning" ? "#d97706" : "#2563eb";
  const toast = document.createElement("div");
  toast.style.cssText = `
    position: fixed; top: 24px; right: 24px; z-index: 99999;
    background: ${bg}; color: #ffffff; padding: 12px 22px;
    border-radius: 8px; font-weight: 700; font-size: 13px;
    box-shadow: 0 4px 14px rgba(0,0,0,0.3); opacity: 0;
    transform: translateY(-10px); transition: all 0.25s ease;
  `;
  toast.innerText = msg;
  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translateY(0)";
  });

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(-10px)";
    setTimeout(() => toast.remove(), 250);
  }, 4000);
}

// ==========================================
// 2. PARSERS (DATA, MOEDA, CSV, OFX)
// ==========================================
function parseDataIso(str) {
  if (!str) return null;
  const s = String(str).trim();
  // DD/MM/YYYY ou DD-MM-YYYY ou DD.MM.YYYY
  const brMatch = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
  if (brMatch) {
    let y = brMatch[3];
    if (y.length === 2) y = "20" + y;
    return `${y}-${brMatch[2].padStart(2, '0')}-${brMatch[1].padStart(2, '0')}`;
  }
  // YYYY-MM-DD
  const isoMatch = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
  }
  // YYYYMMDD
  if (/^\d{8}$/.test(s)) {
    return `${s.substring(0, 4)}-${s.substring(4, 6)}-${s.substring(6, 8)}`;
  }
  return null;
}

function parseMoedaValor(valStr) {
  if (!valStr && valStr !== 0) return null;
  let str = String(valStr).replace(/R\$/gi, '').replace(/\s/g, '').trim();
  if (!str) return null;
  
  const isNeg = str.startsWith('-') || str.endsWith('-') || /d$/i.test(str);
  str = str.replace(/[-+DdCc]/g, '').trim();

  if (str.includes('.') && str.includes(',')) {
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (str.includes(',')) {
    str = str.replace(',', '.');
  }

  const num = parseFloat(str);
  if (isNaN(num)) return null;
  return isNeg ? -Math.abs(num) : Math.abs(num);
}

function separarLinhaCSV(line, delimiter) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"' || c === "'") {
      inQuotes = !inQuotes;
    } else if (c === delimiter && !inQuotes) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur.trim());
  return result.map(s => s.replace(/^["']|["']$/g, '').trim());
}

function parseCSVExtrato(rawText) {
  const lines = rawText.replace(/^\uFEFF/, '').trim().split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  const sample = lines.slice(0, 10).join('\n');
  const countSemi = (sample.match(/;/g) || []).length;
  const countComma = (sample.match(/,/g) || []).length;
  const countTab = (sample.match(/\t/g) || []).length;
  let sep = countSemi >= countComma ? ';' : ',';
  if (countTab > countSemi && countTab > countComma) sep = '\t';

  let headerIdx = -1, colData = -1, colDesc = -1, colValor = -1, colCredito = -1, colDebito = -1, colTipo = -1;

  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const cols = separarLinhaCSV(lines[i], sep).map(c => c.toLowerCase());
    for (let c = 0; c < cols.length; c++) {
      const name = cols[c];
      if (colData === -1 && (name.includes('data') || name === 'dt' || name === 'date')) colData = c;
      if (colDesc === -1 && (name.includes('desc') || name.includes('hist') || name.includes('lança') || name.includes('memo') || name.includes('detalhe') || name.includes('identificador'))) colDesc = c;
      if (colValor === -1 && (name.includes('valor') || name === 'val' || name === 'amount')) colValor = c;
      if (colCredito === -1 && (name.includes('crédito') || name.includes('credito') || name.includes('credit') || name.includes('entrada'))) colCredito = c;
      if (colDebito === -1 && (name.includes('débito') || name.includes('debito') || name.includes('debit') || name.includes('saída') || name.includes('saida'))) colDebito = c;
      if (colTipo === -1 && (name === 'tipo' || name === 'd/c' || name === 'dc')) colTipo = c;
    }
    if (colData !== -1 && (colValor !== -1 || (colCredito !== -1 && colDebito !== -1))) {
      headerIdx = i;
      break;
    }
  }

  const items = [];
  const start = headerIdx >= 0 ? headerIdx + 1 : 0;

  for (let i = start; i < lines.length; i++) {
    const cols = separarLinhaCSV(lines[i], sep);
    if (cols.length < 2) continue;

    let dt = null, val = null, desc = '', isDebito = false;

    if (headerIdx >= 0 && colData >= 0) {
      dt = parseDataIso(cols[colData]);

      if (colCredito >= 0 && colDebito >= 0) {
        const valCred = parseMoedaValor(cols[colCredito]);
        const valDeb = parseMoedaValor(cols[colDebito]);
        if (valCred && valCred > 0) {
          val = valCred;
          isDebito = false;
        } else if (valDeb) {
          val = Math.abs(valDeb);
          isDebito = true;
        }
      } else if (colValor >= 0) {
        const rawVal = parseMoedaValor(cols[colValor]);
        if (rawVal !== null) {
          val = Math.abs(rawVal);
          isDebito = rawVal < 0;
          if (colTipo >= 0 && cols[colTipo]) {
            const t = cols[colTipo].toUpperCase();
            if (t.includes('D') || t.includes('DEB')) isDebito = true;
            if (t.includes('C') || t.includes('CRED')) isDebito = false;
          }
        }
      }

      desc = (colDesc >= 0 && cols[colDesc]) ? cols[colDesc] : 'Transação Bancária';
    } else {
      // Heurística flexível por linha
      cols.forEach(c => {
        if (!dt) { const d = parseDataIso(c); if (d) { dt = d; return; } }
        const m = parseMoedaValor(c);
        if (m !== null && val === null && !parseDataIso(c)) {
          if (c.includes(',') || c.includes('.') || Math.abs(m) > 1000) {
            val = Math.abs(m);
            isDebito = m < 0;
            return;
          }
        }
        if (c.length > 2 && !desc) desc = c;
      });
    }

    if (dt && val !== null) {
      const cleanDesc = (desc || '').replace(/[^a-zA-Z0-9]/g, '').substring(0, 15);
      const itemId = `csv_${dt.replace(/-/g, '')}_${isDebito ? 'D' : 'C'}_${Math.round(val * 100)}_${cleanDesc}_${i}`;
      items.push({
        id: itemId,
        data: dt,
        descricao: desc || 'Transação Bancária',
        valor: Number(val.toFixed(2)),
        tipo: isDebito ? 'DEBITO' : 'CREDITO',
        status: 'PENDENTE',
        vinculo: null
      });
    }
  }

  return items;
}

function parseOFXExtrato(rawText) {
  const text = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  function extrairTag(bloco, tag) {
    const regex = new RegExp('<\\s*' + tag + '\\s*>([^<\\n\\r]+)', 'i');
    const match = bloco.match(regex);
    return match ? match[1].trim() : '';
  }

  const regexBloco = /<\s*STMTTRN\s*>([\s\S]*?)(?=<\s*\/\s*STMTTRN\s*>|<\s*STMTTRN\s*>|<\s*\/\s*BANKTRANLIST\s*>|$)/gi;
  const items = [];
  let matchBloco;
  let idx = 0;

  while ((matchBloco = regexBloco.exec(text)) !== null) {
    const bloco = matchBloco[1];
    if (!bloco.trim()) continue;

    const trnType = extrairTag(bloco, 'TRNTYPE').toUpperCase();
    const dtPostedRaw = extrairTag(bloco, 'DTPOSTED');
    const trnAmtRaw = extrairTag(bloco, 'TRNAMT');
    const memo = extrairTag(bloco, 'MEMO') || extrairTag(bloco, 'NAME') || 'Transação Bancária';
    const fitid = extrairTag(bloco, 'FITID') || extrairTag(bloco, 'CHECKNUM');

    const dataIso = parseDataIso(dtPostedRaw) || new Date().toISOString().split('T')[0];
    const valorNum = parseMoedaValor(trnAmtRaw) || 0;
    if (valorNum === 0 && !memo) continue;

    const isCredito = valorNum > 0 || trnType === 'CREDIT' || trnType === 'DEP';
    const itemId = fitid 
      ? `ofx_${fitid.trim().replace(/[^a-zA-Z0-9_-]/g, '_')}`
      : `ext_${dataIso.replace(/-/g, '')}_${isCredito ? 'C' : 'D'}_${Math.round(Math.abs(valorNum) * 100)}_${idx++}`;

    items.push({
      id: itemId,
      data: dataIso,
      descricao: memo.trim(),
      valor: Number(Math.abs(valorNum).toFixed(2)),
      tipo: isCredito ? 'CREDITO' : 'DEBITO',
      status: 'PENDENTE',
      vinculo: null
    });
  }

  return items;
}

// ==========================================
// 3. PROCESSADOR PRINCIPAL DE ARQUIVO
// ==========================================
window.processarArquivoExtrato = function(inputEl) {
  const file = inputEl?.files?.[0];
  if (!file) return;

  showConciliaToast(`Lendo ${file.name} (${Math.round(file.size / 1024)} KB)...`, "info");

  const reader = new FileReader();
  reader.onload = function(evt) {
    try {
      const buffer = evt.target.result;
      let content = "";
      try {
        content = new TextDecoder("utf-8").decode(buffer);
        if (/CHARSET\s*:\s*(1252|ISO-8859-1|WIN)/i.test(content) || content.includes('\uFFFD')) {
          content = new TextDecoder("iso-8859-1").decode(buffer);
        }
      } catch (_) {
        content = new TextDecoder("iso-8859-1").decode(buffer);
      }

      const isOfx = file.name.toLowerCase().endsWith(".ofx") || content.includes("<OFX>") || content.includes("<STMTTRN>");
      const parsedItems = isOfx ? parseOFXExtrato(content) : parseCSVExtrato(content);

      if (!parsedItems || parsedItems.length === 0) {
        const preview = content.split(/\r?\n/).slice(0, 5).join("\n");
        alert("Aviso: Nenhuma transação pôde ser identificada automaticamente no arquivo.\n\nPrimeiras linhas lidas:\n" + preview);
        showConciliaToast("Arquivo sem transações reconhecidas.", "warning");
        return;
      }

      // Mescla com extratos existentes sem sobrescrever itens já conciliados
      const mapa = new Map();
      (window.conciliaState.extrato || []).forEach(e => mapa.set(e.id, e));

      let novosCont = 0;
      const itensNovosParaBanco = [];

      parsedItems.forEach(pItem => {
        if (!mapa.has(pItem.id)) {
          mapa.set(pItem.id, pItem);
          itensNovosParaBanco.push(pItem);
          novosCont++;
        } else {
          // Se já existe e foi conciliado, preserva o status e vínculo
          const existente = mapa.get(pItem.id);
          if (existente.status !== "CONCILIADO") {
            mapa.set(pItem.id, { ...existente, ...pItem });
          }
        }
      });

      window.conciliaState.extrato = Array.from(mapa.values()).sort((a, b) => (b.data || "").localeCompare(a.data || ""));
      salvarExtratoLocalmente();
      renderizarPainelConciliacao();
      renderizarHistorico();
      showConciliaToast(`${parsedItems.length} transações lidas (${novosCont} novas adicionadas ao extrato)!`, "success");

      // Salva no Firestore apenas os itens novos
      if (itensNovosParaBanco.length > 0) {
        persistirExtratoNoBanco(itensNovosParaBanco);
      }
    } catch (err) {
      console.error("Erro ao interpretar extrato:", err);
      alert("Erro ao ler o arquivo selecionado: " + (err.message || err));
    } finally {
      inputEl.value = "";
    }
  };

  reader.onerror = function() {
    alert("Falha ao abrir o arquivo no navegador.");
  };

  reader.readAsArrayBuffer(file);
};

// ==========================================
// 4. PERSISTÊNCIA E CARREGAMENTO DO EXTRATO BANCÁRIO
// ==========================================
function obterEmpresaIdAtiva() {
  try {
    return localStorage.getItem('fc_empresa_ativa') || 'padrao';
  } catch (_) {
    return 'padrao';
  }
}

function salvarExtratoLocalmente() {
  try {
    const empId = obterEmpresaIdAtiva();
    const dados = JSON.stringify(window.conciliaState.extrato || []);
    localStorage.setItem(`fc_extrato_bancario_${empId}`, dados);
    localStorage.setItem('fc_extrato_bancario', dados);
  } catch (e) {
    console.warn("Aviso ao salvar extrato local:", e);
  }
}

function carregarExtratoLocal() {
  try {
    const empId = obterEmpresaIdAtiva();
    const raw = localStorage.getItem(`fc_extrato_bancario_${empId}`) || localStorage.getItem('fc_extrato_bancario');
    if (raw) {
      const itens = JSON.parse(raw);
      if (Array.isArray(itens) && itens.length > 0) {
        window.conciliaState.extrato = itens;
        renderizarPainelConciliacao();
        renderizarHistorico();
      }
    }
  } catch (e) {
    console.warn("Aviso ao ler extrato do cache local:", e);
  }
}

async function carregarExtratoDoBanco() {
  try {
    if (typeof window.firebase === "undefined" || typeof window.firebase.firestore !== "function") return;
    const firestore = window.firebase.firestore();
    const refBase = (typeof window.getEmpresaRef === "function") ? window.getEmpresaRef() : firestore;

    const snap = await refBase.collection("extrato_bancario").get().catch(e => {
      console.warn("Aviso ao buscar extrato no Firestore:", e);
      return null;
    });

    if (snap && !snap.empty) {
      const itemsBanco = [];
      const finList = (window.db && Array.isArray(window.db.financeiro)) ? window.db.financeiro : [];

      snap.forEach(doc => {
        const item = { id: doc.id, ...doc.data() };

        // Se porventura faltarem campos principais em registros legados, recupera do título vinculado
        if ((!item.descricao || !item.valor) && item.vinculo) {
          const vId = item.vinculo.origem_id || item.vinculo.origens?.[0]?.id;
          const tit = finList.find(f => String(f.id) === String(vId) || String(f.extrato_id) === String(item.id));
          if (tit) {
            if (!item.descricao) item.descricao = tit.pessoa || tit.descricao || tit.desc || "Transação Conciliada";
            if (!item.valor) item.valor = Number(tit.valorPago || tit.valor || 0);
            if (!item.data) item.data = (tit.dataPagamento || tit.data || "").split("T")[0];
            if (!item.tipo) item.tipo = (tit.tipo === "DESPESA" || tit.tipo === "PAGAR") ? "DEBITO" : "CREDITO";
          }
        }

        itemsBanco.push(item);
      });

      // Mescla com os itens locais/em memória
      const mapExt = new Map();
      itemsBanco.forEach(b => mapExt.set(b.id, b));

      if (Array.isArray(window.conciliaState.extrato)) {
        window.conciliaState.extrato.forEach(local => {
          if (!mapExt.has(local.id)) {
            mapExt.set(local.id, local);
          } else {
            const banco = mapExt.get(local.id);
            if (local.status === "CONCILIADO" && banco.status !== "CONCILIADO") {
              mapExt.set(local.id, { ...banco, ...local });
            } else if (banco.status === "CONCILIADO") {
              mapExt.set(local.id, { ...local, ...banco });
            }
          }
        });
      }

      window.conciliaState.extrato = Array.from(mapExt.values()).sort((a, b) => (b.data || "").localeCompare(a.data || ""));
      salvarExtratoLocalmente();
      renderizarPainelConciliacao();
      renderizarHistorico();
    }
  } catch (err) {
    console.warn("Aviso na sincronização de extrato:", err);
  }
}

async function persistirExtratoNoBanco(itens) {
  try {
    if (!Array.isArray(itens) || itens.length === 0) return;
    if (typeof window.firebase !== "undefined" && typeof window.firebase.firestore === "function") {
      const firestore = window.firebase.firestore();
      const refBase = (typeof window.getEmpresaRef === "function") ? window.getEmpresaRef() : firestore;
      
      const chunkSize = 300;
      for (let i = 0; i < itens.length; i += chunkSize) {
        const chunk = itens.slice(i, i + chunkSize);
        const batch = firestore.batch();
        chunk.forEach(item => {
          const docRef = refBase.collection("extrato_bancario").doc(item.id);
          batch.set(docRef, item, { merge: true });
        });
        await batch.commit().catch(e => console.warn("Aviso batch extrato chunk:", e));
      }
    }
  } catch (e) {
    console.warn("Persistência de extrato em modo offline/cache:", e);
  }
}

window.removerItemExtrato = async function(id) {
  const ext = (window.conciliaState.extrato || []).find(e => e.id === id);
  const desc = ext ? ` "${ext.descricao}"` : '';
  if (!confirm(`Deseja excluir a transação${desc} do extrato?`)) return;

  window.conciliaState.extrato = (window.conciliaState.extrato || []).filter(e => e.id !== id);
  if (window.conciliaState.selectedExtratoId === id) {
    window.conciliaState.selectedExtratoId = null;
  }
  salvarExtratoLocalmente();
  renderizarPainelConciliacao();
  renderizarHistorico();

  if (typeof window.firebase !== "undefined" && typeof window.firebase.firestore === "function") {
    try {
      const refBase = (typeof window.getEmpresaRef === "function") ? window.getEmpresaRef() : window.firebase.firestore();
      await refBase.collection("extrato_bancario").doc(id).delete().catch(() => {});
    } catch (_) {}
  }
  showConciliaToast("Transação removida do extrato.", "info");
};

window.limparExtratoPendentes = async function() {
  const pendentes = (window.conciliaState.extrato || []).filter(e => e.status === "PENDENTE");
  if (pendentes.length === 0) {
    showConciliaToast("Não há transações pendentes no extrato para limpar.", "info");
    return;
  }

  if (!confirm(`Deseja limpar ${pendentes.length} transação(ões) pendente(s) do extrato? As transações já conciliadas e o histórico serão preservados.`)) return;

  window.conciliaState.extrato = (window.conciliaState.extrato || []).filter(e => e.status !== "PENDENTE");
  window.conciliaState.selectedExtratoId = null;
  salvarExtratoLocalmente();
  renderizarPainelConciliacao();
  renderizarHistorico();

  if (typeof window.firebase !== "undefined" && typeof window.firebase.firestore === "function") {
    try {
      const firestore = window.firebase.firestore();
      const refBase = (typeof window.getEmpresaRef === "function") ? window.getEmpresaRef() : firestore;
      const chunkSize = 300;
      for (let i = 0; i < pendentes.length; i += chunkSize) {
        const chunk = pendentes.slice(i, i + chunkSize);
        const batch = firestore.batch();
        chunk.forEach(p => {
          batch.delete(refBase.collection("extrato_bancario").doc(p.id));
        });
        await batch.commit().catch(() => {});
      }
    } catch (_) {}
  }
  showConciliaToast("Transações pendentes removidas com sucesso.", "success");
};

// ==========================================
// 5. AUTO-MATCH
// ==========================================
window.executarAutoMatch = async function() {
  const matchedSysIds = new Set();
  const pares = [];

  for (const ext of window.conciliaState.extrato) {
    if (ext.status === "CONCILIADO") continue;

    const match = window.conciliaState.sistema.find(sys => {
      if (sys.conciliado || matchedSysIds.has(sys.id)) return false;
      const dataSys = sys.data_pagamento || sys.data_vencimento;
      const tipoSys = sys.colecao === "contas_a_pagar" ? "DEBITO" : "CREDITO";

      return dataSys === ext.data && sys.valor === ext.valor && tipoSys === ext.tipo;
    });

    if (match) {
      matchedSysIds.add(match.id);
      pares.push({ ext, sys: match });
    }
  }

  if (pares.length === 0) {
    showConciliaToast("Nenhuma correspondência de data e valor encontrada.", "warning");
    return;
  }

  // Persiste no banco com batch
  if (typeof window.firebase !== "undefined" && typeof window.firebase.firestore === "function") {
    try {
      const firestore = window.firebase.firestore();
      const batch = firestore.batch();
      const refBase = (typeof window.getEmpresaRef === "function") ? window.getEmpresaRef() : firestore;

      pares.forEach(({ ext, sys }) => {
        const extRef = refBase.collection("extrato_bancario").doc(ext.id);
        batch.set(extRef, {
          id: ext.id,
          data: ext.data,
          descricao: ext.descricao,
          valor: ext.valor,
          tipo: ext.tipo,
          status: "CONCILIADO",
          vinculo: {
            origem_id: sys.id,
            origem_colecao: sys.colecao,
            origens: [{ id: sys.id, colecao: sys.colecao, valor: sys.valor, descricao: sys.descricao }],
            data: new Date().toISOString()
          }
        }, { merge: true });
        
        // Dá baixa completa no título do financeiro
        const targetCol = sys.colecao === "contas_a_pagar" || sys.colecao === "contas_a_receber" ? "financeiro" : sys.colecao;
        const sysRef = refBase.collection(targetCol).doc(sys.id);
        batch.set(sysRef, {
          status: "PAGO",
          valorPago: Number(sys.valor || ext.valor || 0),
          dataPagamento: ext.data ? new Date(ext.data + 'T12:00:00').toISOString() : new Date().toISOString(),
          metodoPagamento: ext.descricao || "Extrato Bancário",
          conciliado: true,
          extrato_id: ext.id,
          ultimaAlteracao: Date.now()
        }, { merge: true });
      });
      await batch.commit();
    } catch (e) {
      console.warn("Aviso batch auto-match:", e);
    }
  }

  // Atualização otimista
  pares.forEach(({ ext, sys }) => {
    ext.status = "CONCILIADO";
    ext.vinculo = {
      origem_id: sys.id,
      origem_colecao: sys.colecao,
      origens: [{ id: sys.id, colecao: sys.colecao, valor: sys.valor, descricao: sys.descricao }]
    };
    sys.conciliado = true;
    sys.extrato_id = ext.id;

    if (window.db && Array.isArray(window.db.financeiro)) {
      const itemDb = window.db.financeiro.find(f => String(f.id) === String(sys.id));
      if (itemDb) {
        itemDb.status = "PAGO";
        itemDb.valorPago = Number(sys.valor || ext.valor || 0);
        itemDb.dataPagamento = ext.data ? new Date(ext.data + 'T12:00:00').toISOString() : new Date().toISOString();
        itemDb.metodoPagamento = ext.descricao || "Extrato Bancário";
        itemDb.conciliado = true;
        itemDb.extrato_id = ext.id;
        itemDb.ultimaAlteracao = Date.now();
      }
    }
  });

  if (typeof window.FCCache !== 'undefined' && typeof window.FCCache.set === 'function' && window.db?.financeiro) {
    try { window.FCCache.set('financeiro', window.db.financeiro); } catch (_) {}
  }
  try {
    if (window.db?.financeiro) {
      localStorage.setItem('fc_financeiro', JSON.stringify(window.db.financeiro));
    }
  } catch (_) {}

  salvarExtratoLocalmente();
  carregarLancamentosDoSistema();

  window.conciliaState.selectedExtratoId = null;
  window.conciliaState.selectedSistemaId = null;
  window.conciliaState.checksSistema.clear();

  renderizarPainelConciliacao();
  renderizarHistorico();
  showConciliaToast(`${pares.length} transações conciliadas e baixadas com sucesso!`, "success");
};

// ==========================================
// 6. VINCULAR MANUAL
// ==========================================
window.vincularManual = async function() {
  const extId = window.conciliaState.selectedExtratoId;
  if (!extId) {
    showConciliaToast("Selecione uma transação do Extrato Bancário à esquerda.", "warning");
    return;
  }

  // Coleta os lançamentos do sistema selecionados (via checkboxes ou seleção direta)
  let sysIds = Array.from(window.conciliaState.checksSistema);
  if (sysIds.length === 0 && window.conciliaState.selectedSistemaId) {
    sysIds = [String(window.conciliaState.selectedSistemaId)];
  }

  if (sysIds.length === 0) {
    showConciliaToast("Selecione ao menos um lançamento do Sistema à direita.", "warning");
    return;
  }

  const ext = window.conciliaState.extrato.find(e => e.id === extId);
  if (!ext || ext.status === "CONCILIADO") {
    showConciliaToast("Transação do extrato não encontrada ou já conciliada.", "error");
    return;
  }

  const sysItens = window.conciliaState.sistema.filter(s => sysIds.includes(String(s.id)));
  if (sysItens.length === 0) {
    showConciliaToast("Nenhum lançamento do sistema encontrado para vincular.", "error");
    return;
  }

  // Validação e cálculo de diferença (Juros/Acréscimo ou Desconto)
  const totalSys = sysItens.reduce((acc, s) => acc + Number(s.valor || 0), 0);
  const diff = Number((ext.valor - totalSys).toFixed(2));
  const diffAbs = Math.abs(diff);

  let jurosTotal = 0;
  let descontoTotal = 0;

  if (diffAbs > 0.02) {
    if (diff > 0) {
      // Extrato é maior que o título: diferença lançada como Juros / Acréscimo
      jurosTotal = diff;
      const confirmMsg = `Diferença de valor detectada:\n\n` +
        `• Extrato Bancário: R$ ${ext.valor.toFixed(2)} (${ext.tipo})\n` +
        `• Lançamento(s) do Sistema: R$ ${totalSys.toFixed(2)}\n` +
        `• Juros / Acréscimo: R$ ${jurosTotal.toFixed(2)}\n\n` +
        `Deseja lançar a diferença de R$ ${jurosTotal.toFixed(2)} como JUROS e dar baixa no valor total de R$ ${ext.valor.toFixed(2)}?`;
      if (!confirm(confirmMsg)) return;
    } else {
      // Extrato é menor que o título: diferença lançada como Desconto
      descontoTotal = diffAbs;
      const confirmMsg = `Diferença de valor detectada:\n\n` +
        `• Extrato Bancário: R$ ${ext.valor.toFixed(2)} (${ext.tipo})\n` +
        `• Lançamento(s) do Sistema: R$ ${totalSys.toFixed(2)}\n` +
        `• Desconto / Diferença: R$ ${descontoTotal.toFixed(2)}\n\n` +
        `Deseja lançar a diferença de R$ ${descontoTotal.toFixed(2)} como DESCONTO e dar baixa no valor de R$ ${ext.valor.toFixed(2)}?`;
      if (!confirm(confirmMsg)) return;
    }
  }

  if (typeof window.firebase !== "undefined" && typeof window.firebase.firestore === "function") {
    try {
      const firestore = window.firebase.firestore();
      const batch = firestore.batch();
      const refBase = (typeof window.getEmpresaRef === "function") ? window.getEmpresaRef() : firestore;

      const vinculoData = {
        origem_id: sysItens[0].id,
        origem_colecao: sysItens[0].colecao,
        origens: sysItens.map(s => ({
          id: s.id,
          colecao: s.colecao,
          valor: s.valor,
          descricao: s.descricao
        })),
        data: new Date().toISOString()
      };

      batch.set(refBase.collection("extrato_bancario").doc(ext.id), {
        id: ext.id,
        data: ext.data,
        descricao: ext.descricao,
        valor: ext.valor,
        tipo: ext.tipo,
        status: "CONCILIADO",
        vinculo: vinculoData
      }, { merge: true });

      sysItens.forEach(sys => {
        let jurosItem = 0;
        let descItem = 0;
        let valorPagoItem = Number(sys.valor || 0);

        if (jurosTotal > 0) {
          if (sysItens.length === 1) {
            jurosItem = jurosTotal;
            valorPagoItem = Number((Number(sys.valor || 0) + jurosItem).toFixed(2));
          } else {
            const proporcao = Number(sys.valor || 0) / totalSys;
            jurosItem = Number((jurosTotal * proporcao).toFixed(2));
            valorPagoItem = Number((Number(sys.valor || 0) + jurosItem).toFixed(2));
          }
        } else if (descontoTotal > 0) {
          if (sysItens.length === 1) {
            descItem = descontoTotal;
            valorPagoItem = Number((Number(sys.valor || 0) - descItem).toFixed(2));
          } else {
            const proporcao = Number(sys.valor || 0) / totalSys;
            descItem = Number((descontoTotal * proporcao).toFixed(2));
            valorPagoItem = Number((Number(sys.valor || 0) - descItem).toFixed(2));
          }
        }

        const obsInfo = jurosItem > 0 
          ? `[Conciliação Bancária] Juros/Acréscimo: R$ ${jurosItem.toFixed(2)}` 
          : (descItem > 0 ? `[Conciliação Bancária] Desconto: R$ ${descItem.toFixed(2)}` : '');

        const targetCol = sys.colecao === "contas_a_pagar" || sys.colecao === "contas_a_receber" ? "financeiro" : sys.colecao;
        batch.set(refBase.collection(targetCol).doc(sys.id), {
          status: "PAGO",
          valorPago: valorPagoItem,
          juros: jurosItem,
          acrescimo: jurosItem,
          desconto: descItem,
          dataPagamento: ext.data ? new Date(ext.data + 'T12:00:00').toISOString() : new Date().toISOString(),
          metodoPagamento: ext.descricao || "Extrato Bancário",
          conciliado: true,
          extrato_id: ext.id,
          observacao: (sys.observacao ? sys.observacao + '\n' : '') + obsInfo,
          ultimaAlteracao: Date.now()
        }, { merge: true });
      });

      await batch.commit();
    } catch (e) {
      console.warn("Aviso batch manual:", e);
    }
  }

  // Atualização otimista no estado da conciliação
  ext.status = "CONCILIADO";
  ext.vinculo = {
    origem_id: sysItens[0].id,
    origem_colecao: sysItens[0].colecao,
    origens: sysItens.map(s => ({
      id: s.id,
      colecao: s.colecao,
      valor: s.valor,
      descricao: s.descricao
    }))
  };

  sysItens.forEach(sys => {
    sys.conciliado = true;
    sys.extrato_id = ext.id;

    // Atualiza também no array em memória do financeiro para dar baixa completa com juros
    if (window.db && Array.isArray(window.db.financeiro)) {
      const itemDb = window.db.financeiro.find(f => String(f.id) === String(sys.id));
      if (itemDb) {
        let jurosItem = 0;
        let descItem = 0;
        let valorPagoItem = Number(sys.valor || 0);

        if (jurosTotal > 0) {
          if (sysItens.length === 1) {
            jurosItem = jurosTotal;
            valorPagoItem = Number((Number(sys.valor || 0) + jurosItem).toFixed(2));
          } else {
            const proporcao = Number(sys.valor || 0) / totalSys;
            jurosItem = Number((jurosTotal * proporcao).toFixed(2));
            valorPagoItem = Number((Number(sys.valor || 0) + jurosItem).toFixed(2));
          }
        } else if (descontoTotal > 0) {
          if (sysItens.length === 1) {
            descItem = descontoTotal;
            valorPagoItem = Number((Number(sys.valor || 0) - descItem).toFixed(2));
          } else {
            const proporcao = Number(sys.valor || 0) / totalSys;
            descItem = Number((descontoTotal * proporcao).toFixed(2));
            valorPagoItem = Number((Number(sys.valor || 0) - descItem).toFixed(2));
          }
        }

        const obsInfo = jurosItem > 0 
          ? `[Conciliação Bancária] Juros/Acréscimo: R$ ${jurosItem.toFixed(2)}` 
          : (descItem > 0 ? `[Conciliação Bancária] Desconto: R$ ${descItem.toFixed(2)}` : '');

        itemDb.status = "PAGO";
        itemDb.valorPago = valorPagoItem;
        itemDb.juros = jurosItem;
        itemDb.acrescimo = jurosItem;
        itemDb.desconto = descItem;
        itemDb.dataPagamento = ext.data ? new Date(ext.data + 'T12:00:00').toISOString() : new Date().toISOString();
        itemDb.metodoPagamento = ext.descricao || "Extrato Bancário";
        itemDb.conciliado = true;
        itemDb.extrato_id = ext.id;
        itemDb.observacao = (itemDb.observacao ? itemDb.observacao + '\n' : '') + obsInfo;
        itemDb.ultimaAlteracao = Date.now();
      }
    }
  });

  // Salva no repositório FCCache do sistema para refletir imediatamente em Contas a Pagar / Receber
  if (typeof window.FCCache !== 'undefined' && typeof window.FCCache.set === 'function' && window.db?.financeiro) {
    try { window.FCCache.set('financeiro', window.db.financeiro); } catch (_) {}
  }
  try {
    if (window.db?.financeiro) {
      localStorage.setItem('fc_financeiro', JSON.stringify(window.db.financeiro));
    }
  } catch (_) {}

  salvarExtratoLocalmente();
  carregarLancamentosDoSistema();

  window.conciliaState.selectedExtratoId = null;
  window.conciliaState.selectedSistemaId = null;
  window.conciliaState.checksSistema.clear();

  renderizarPainelConciliacao();
  renderizarHistorico();
  showConciliaToast("Transações vinculadas e baixadas com sucesso!", "success");
};

// ==========================================
// 7. GERAR AJUSTE BANCÁRIO
// ==========================================
window.gerarAjuste = async function(extId) {
  const ext = window.conciliaState.extrato.find(e => e.id === extId);
  if (!ext || ext.status === "CONCILIADO") return;

  const targetCol = ext.tipo === "DEBITO" ? "contas_a_pagar" : "contas_a_receber";
  const newId = `ajuste_${Date.now()}`;

  const novoLancamento = {
    id: newId,
    colecao: targetCol,
    descricao: `[Ajuste Bancário] ${ext.descricao}`,
    categoria: "Tarifas Bancárias",
    valor: ext.valor,
    data_vencimento: ext.data,
    data_pagamento: ext.data,
    status: "PAGO",
    conciliado: true,
    extrato_id: ext.id
  };

  const isoData = ext.data ? new Date(ext.data + 'T12:00:00').toISOString() : new Date().toISOString();

  if (typeof window.firebase !== "undefined" && typeof window.firebase.firestore === "function") {
    try {
      const firestore = window.firebase.firestore();
      const batch = firestore.batch();
      const refBase = (typeof window.getEmpresaRef === "function") ? window.getEmpresaRef() : firestore;
      
      const newDocRef = refBase.collection("financeiro").doc(newId);
      batch.set(newDocRef, {
        tipo: ext.tipo === "DEBITO" ? "DESPESA" : "RECEITA",
        pessoa: novoLancamento.descricao,
        categoria: novoLancamento.categoria,
        valor: novoLancamento.valor,
        valorPago: novoLancamento.valor,
        data: isoData,
        dataPagamento: isoData,
        metodoPagamento: ext.descricao || "Extrato Bancário",
        status: "PAGO",
        conciliado: true,
        extrato_id: ext.id,
        ultimaAlteracao: Date.now()
      });

      batch.set(refBase.collection("extrato_bancario").doc(ext.id), {
        id: ext.id,
        data: ext.data,
        descricao: ext.descricao,
        valor: ext.valor,
        tipo: ext.tipo,
        status: "CONCILIADO",
        vinculo: {
          origem_id: newId,
          origem_colecao: targetCol,
          origens: [{ id: newId, colecao: targetCol, valor: ext.valor, descricao: novoLancamento.descricao }],
          data: new Date().toISOString()
        }
      }, { merge: true });

      await batch.commit();
    } catch (e) {
      console.warn("Aviso batch ajuste:", e);
    }
  }

  ext.status = "CONCILIADO";
  ext.vinculo = {
    origem_id: newId,
    origem_colecao: targetCol,
    origens: [{ id: newId, colecao: targetCol, valor: ext.valor, descricao: novoLancamento.descricao }]
  };
  window.conciliaState.sistema.push(novoLancamento);

  if (window.db && Array.isArray(window.db.financeiro)) {
    window.db.financeiro.push({
      id: newId,
      tipo: ext.tipo === "DEBITO" ? "DESPESA" : "RECEITA",
      pessoa: novoLancamento.descricao,
      categoria: novoLancamento.categoria,
      valor: novoLancamento.valor,
      valorPago: novoLancamento.valor,
      data: isoData,
      dataPagamento: isoData,
      metodoPagamento: ext.descricao || "Extrato Bancário",
      status: "PAGO",
      conciliado: true,
      extrato_id: ext.id,
      ultimaAlteracao: Date.now()
    });
    if (typeof window.FCCache !== 'undefined' && typeof window.FCCache.set === 'function') {
      try { window.FCCache.set('financeiro', window.db.financeiro); } catch (_) {}
    }
    try { localStorage.setItem('fc_financeiro', JSON.stringify(window.db.financeiro)); } catch (_) {}
  }

  salvarExtratoLocalmente();
  carregarLancamentosDoSistema();

  renderizarPainelConciliacao();
  renderizarHistorico();
  showConciliaToast("Ajuste criado e conciliado com sucesso!", "success");
};

// ==========================================
// 8. RENDERIZAÇÃO DOM
// ==========================================
function renderizarPainelConciliacao() {
  const elExtratoList = document.getElementById("extratoList");
  const elSistemaList = document.getElementById("sistemaList");
  const btnManualMatch = document.getElementById("btnManualMatch");
  const lblStats = document.getElementById("matchStats");
  const badgeExtratoCount = document.getElementById("extratoCountBadge");
  const badgeSistemaCount = document.getElementById("sistemaCountBadge");

  const pendentesExt = (window.conciliaState.extrato || []).filter(e => e.status === "PENDENTE");
  const conciliadosExt = (window.conciliaState.extrato || []).filter(e => e.status === "CONCILIADO");

  const modo = window.conciliaState.modoVisao || "pendentes";

  // Base de itens de acordo com o modo (Pendentes ou Ocultados)
  let itensSys = [];
  if (modo === "ocultados") {
    itensSys = window.conciliaState.sistema.filter(s => window.conciliaState.itensOcultados.has(String(s.id)));
  } else {
    itensSys = window.conciliaState.sistema.filter(s => 
      !s.conciliado && 
      !window.conciliaState.itensOcultados.has(String(s.id))
    );
  }

  // Filtro de busca
  const buscaTxt = (document.getElementById("buscaSistema")?.value || "").toLowerCase().trim();
  if (buscaTxt) {
    itensSys = itensSys.filter(s => 
      (s.descricao && s.descricao.toLowerCase().includes(buscaTxt)) ||
      String(s.valor).includes(buscaTxt) ||
      (s.data_vencimento && s.data_vencimento.includes(buscaTxt))
    );
  }

  // Filtro de tipo
  const tipoFiltro = document.getElementById("filtroTipoSistema")?.value || "todos";
  if (tipoFiltro === "pagar") {
    itensSys = itensSys.filter(s => s.colecao === "contas_a_pagar");
  } else if (tipoFiltro === "receber") {
    itensSys = itensSys.filter(s => s.colecao === "contas_a_receber");
  }

  const qtdAtivosTotal = window.conciliaState.sistema.filter(s => 
    !s.conciliado && 
    !window.conciliaState.itensOcultados.has(String(s.id))
  ).length;

  if (lblStats) lblStats.textContent = `Pendentes: ${pendentesExt.length} Extrato | ${qtdAtivosTotal} Sistema`;
  if (badgeExtratoCount) badgeExtratoCount.textContent = `${pendentesExt.length} Pendentes`;

  const badgeTabPend = document.getElementById("badge-tab-pendencias");
  const badgeTabHist = document.getElementById("badge-tab-historico");
  if (badgeTabPend) badgeTabPend.textContent = pendentesExt.length;
  if (badgeTabHist) badgeTabHist.textContent = conciliadosExt.length;
  
  if (badgeSistemaCount) {
    if (modo === "ocultados") {
      badgeSistemaCount.textContent = `${itensSys.length} Ocultados`;
      badgeSistemaCount.className = "text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
    } else {
      badgeSistemaCount.textContent = `${itensSys.length} Pendentes`;
      badgeSistemaCount.className = "badge-pendente text-[11px] font-bold px-2.5 py-0.5 rounded-full";
    }
  }

  // Atualiza as pills / abas visuais do topo (Pendentes e Ocultados)
  const pillPend = document.getElementById("pill-visao-pendentes");
  const pillOcult = document.getElementById("pill-visao-ocultados");

  const countPillPend = document.getElementById("count-pill-pendentes");
  const countPillOcult = document.getElementById("count-pill-ocultados");

  if (countPillPend) countPillPend.textContent = qtdAtivosTotal;
  if (countPillOcult) countPillOcult.textContent = window.conciliaState.itensOcultados.size;

  if (pillPend) {
    pillPend.className = modo === "pendentes" 
      ? "flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 bg-blue-600 text-white shadow-sm cursor-pointer"
      : "flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer";
  }
  if (pillOcult) {
    pillOcult.className = modo === "ocultados"
      ? "flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 bg-amber-500 text-white shadow-sm cursor-pointer"
      : "flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer";
  }

  // Painéis de ações em lote
  const acoesPend = document.getElementById("acoesModoPendentes");
  const acoesOcult = document.getElementById("acoesModoOcultados");

  if (acoesPend) acoesPend.classList.toggle("hidden", modo !== "pendentes");
  if (acoesOcult) acoesOcult.classList.toggle("hidden", modo !== "ocultados");

  const qtdChecks = window.conciliaState.checksSistema.size;

  // Botões de Pendentes
  const btnOcultLote = document.getElementById("btnOcultarLote");
  const contOcult = document.getElementById("contagemOcultar");
  if (btnOcultLote) btnOcultLote.disabled = qtdChecks === 0;
  if (contOcult) contOcult.textContent = qtdChecks;

  // Botões de Ocultados
  const btnReexLote = document.getElementById("btnReexibirLote");
  const contReex = document.getElementById("contagemReexibir");
  if (btnReexLote) btnReexLote.disabled = qtdChecks === 0;
  if (contReex) contReex.textContent = qtdChecks;

  const qtdSysSelecionados = window.conciliaState.checksSistema.size || (window.conciliaState.selectedSistemaId ? 1 : 0);
  const temExtrato = !!window.conciliaState.selectedExtratoId;
  const podeVincular = temExtrato && qtdSysSelecionados > 0;

  if (btnManualMatch) {
    btnManualMatch.disabled = !podeVincular;
    if (podeVincular) {
      btnManualMatch.className = "bg-emerald-600 hover:bg-emerald-500 text-white shadow-md cursor-pointer border border-emerald-500 px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all ring-2 ring-emerald-500/20";
      const relacao = qtdSysSelecionados === 1 ? "1 Extrato ↔ 1 Sistema" : `1 Extrato ↔ ${qtdSysSelecionados} Sistema`;
      btnManualMatch.innerHTML = `<i class="fa-solid fa-link"></i> Vincular Selecionados (${relacao})`;
      btnManualMatch.title = "Clique para vincular as transações selecionadas";
    } else {
      btnManualMatch.className = "bg-slate-100 dark:bg-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 dark:text-slate-500 border border-slate-300 dark:border-slate-600 px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all opacity-50 cursor-not-allowed";
      btnManualMatch.innerHTML = `<i class="fa-solid fa-link"></i> Vincular Selecionados`;
      btnManualMatch.title = "Selecione 1 transação no Extrato e ao menos 1 no Sistema para vincular";
    }
  }

  // Lista Extrato
  if (elExtratoList) {
    if (pendentesExt.length === 0) {
      elExtratoList.innerHTML = `<p class="text-xs text-slate-400 text-center py-10 italic">Nenhum extrato importado ou todas as transações foram conciliadas.</p>`;
    } else {
      elExtratoList.innerHTML = pendentesExt.map(e => `
        <div onclick="selecionarItemExtrato('${e.id}')" class="concilia-card bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 hover:border-blue-500 dark:hover:border-blue-500 ${window.conciliaState.selectedExtratoId === e.id ? 'selected' : ''}" data-id="${e.id}">
          <div>
            <h4 class="font-bold text-xs text-slate-800 dark:text-slate-100">${e.descricao}</h4>
            <span class="text-[11px] text-slate-500 dark:text-slate-400">Data: ${e.data}</span>
            <div class="mt-1.5 flex items-center gap-2">
              <button onclick="event.stopPropagation(); window.gerarAjuste('${e.id}')" class="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300 hover:bg-blue-100 border border-blue-200 dark:border-blue-800">
                + Gerar Ajuste
              </button>
              <button onclick="event.stopPropagation(); window.removerItemExtrato('${e.id}')" title="Excluir transação do extrato" class="text-[10px] font-bold px-1.5 py-0.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors">
                <i class="fa-solid fa-trash-can"></i>
              </button>
            </div>
          </div>
          <div class="text-right flex flex-col items-end gap-1">
            <span class="font-extrabold text-xs ${e.tipo === 'DEBITO' ? 'val-debito' : 'val-credito'}">
              ${e.tipo === 'DEBITO' ? '-' : '+'} R$ ${e.valor.toFixed(2)}
            </span>
            <span class="badge-pendente text-[10px] font-bold px-2 py-0.5 rounded-full">Pendente</span>
          </div>
        </div>
      `).join("");
    }
  }

  // Lista Sistema
  if (elSistemaList) {
    if (itensSys.length === 0) {
      const msgVazio = modo === "ocultados" 
        ? "Nenhum lançamento ocultado no momento." 
        : "Nenhum lançamento pendente encontrado no sistema.";
      elSistemaList.innerHTML = `<p class="text-xs text-slate-400 text-center py-10 italic">${msgVazio}</p>`;
    } else {
      elSistemaList.innerHTML = itensSys.map(s => {
        const isPagar = s.colecao === "contas_a_pagar";
        const isChecked = window.conciliaState.checksSistema.has(String(s.id));
        const isSelected = isChecked || window.conciliaState.selectedSistemaId === String(s.id);

        let botoesAcao = "";
        let badgeStatus = `<span class="badge-pendente text-[10px] font-bold px-2 py-0.5 rounded-full">Pendente</span>`;

        if (modo === "ocultados") {
          badgeStatus = `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">Ocultado</span>`;
          botoesAcao = `
            <button onclick="event.stopPropagation(); window.reexibirItemOcultado('${s.id}')" title="Reexibir na lista de conciliação" class="text-emerald-600 hover:text-emerald-700 text-xs px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 transition-colors flex items-center gap-1 font-bold">
              <i class="fa-solid fa-rotate-left"></i> Reexibir
            </button>
          `;
        } else {
          botoesAcao = `
            <button onclick="event.stopPropagation(); window.ocultarItemIndividual('${s.id}')" title="Ocultar da conciliação (sem alterar o financeiro)" class="text-slate-400 hover:text-amber-500 text-xs px-1.5 py-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-1 font-bold">
              <i class="fa-solid fa-eye-slash"></i> Ocultar
            </button>
          `;
        }

        return `
          <div onclick="selecionarItemSistema('${s.id}')" class="concilia-card bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 hover:border-blue-500 dark:hover:border-blue-500 ${isSelected ? 'selected' : ''}" data-id="${s.id}">
            <div class="flex items-center gap-2">
              <input type="checkbox" onclick="event.stopPropagation(); window.selecionarItemSistema('${s.id}')" ${isSelected ? 'checked' : ''} class="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-0 cursor-pointer">
              <div>
                <h4 class="font-bold text-xs text-slate-800 dark:text-slate-100">${s.descricao}</h4>
                <span class="text-[11px] text-slate-500 dark:text-slate-400">Venc: ${s.data_vencimento || s.data_pagamento} • ${isPagar ? 'Contas a Pagar' : 'Contas a Receber'}</span>
              </div>
            </div>
            <div class="text-right flex flex-col items-end gap-1">
              <span class="font-extrabold text-xs ${isPagar ? 'val-debito' : 'val-credito'}">
                R$ ${s.valor.toFixed(2)}
              </span>
              <div class="flex items-center gap-1.5 mt-0.5">
                ${badgeStatus}
                ${botoesAcao}
              </div>
            </div>
          </div>
        `;
      }).join("");
    }
  }
}

// ==========================================
// 10. GESTÃO DE OCULTAR E REEXIBIR
// (100% SEGURO: Apenas altera a exibição da conciliação, NUNCA afeta o título no financeiro)
// ==========================================
window.mudarVisualizacaoSistema = function(modo) {
  window.conciliaState.modoVisao = modo;
  window.conciliaState.checksSistema.clear();
  const chkAll = document.getElementById("checkTodosSistema");
  if (chkAll) chkAll.checked = false;
  renderizarPainelConciliacao();
};

window.selecionarItemSistema = function(id) {
  const sid = String(id);
  if (window.conciliaState.checksSistema.has(sid)) {
    window.conciliaState.checksSistema.delete(sid);
    if (window.conciliaState.selectedSistemaId === sid) {
      const nextId = window.conciliaState.checksSistema.values().next().value;
      window.conciliaState.selectedSistemaId = nextId || null;
    }
  } else {
    window.conciliaState.checksSistema.add(sid);
    window.conciliaState.selectedSistemaId = sid;
  }
  renderizarPainelConciliacao();
};

window.alternarCheckItemSistema = function(id) {
  window.selecionarItemSistema(id);
};

window.alternarSelecionarTodosSistema = function(checked) {
  const modo = window.conciliaState.modoVisao || "pendentes";
  const buscaTxt = (document.getElementById("buscaSistema")?.value || "").toLowerCase().trim();
  const tipoFiltro = document.getElementById("filtroTipoSistema")?.value || "todos";

  let visiveis = [];
  if (modo === "ocultados") {
    visiveis = window.conciliaState.sistema.filter(s => window.conciliaState.itensOcultados.has(String(s.id)));
  } else {
    visiveis = window.conciliaState.sistema.filter(s => 
      !s.conciliado && 
      !window.conciliaState.itensOcultados.has(String(s.id))
    );
  }

  if (buscaTxt) {
    visiveis = visiveis.filter(s => 
      (s.descricao && s.descricao.toLowerCase().includes(buscaTxt)) ||
      String(s.valor).includes(buscaTxt) ||
      (s.data_vencimento && s.data_vencimento.includes(buscaTxt))
    );
  }
  if (tipoFiltro === "pagar") visiveis = visiveis.filter(s => s.colecao === "contas_a_pagar");
  else if (tipoFiltro === "receber") visiveis = visiveis.filter(s => s.colecao === "contas_a_receber");

  if (checked) {
    visiveis.forEach(s => window.conciliaState.checksSistema.add(String(s.id)));
    if (visiveis.length > 0) {
      window.conciliaState.selectedSistemaId = String(visiveis[0].id);
    }
  } else {
    visiveis.forEach(s => window.conciliaState.checksSistema.delete(String(s.id)));
    window.conciliaState.selectedSistemaId = null;
  }
  renderizarPainelConciliacao();
};

// --- AÇÕES DE OCULTAR ---
window.ocultarLoteSistema = function() {
  const qtd = window.conciliaState.checksSistema.size;
  if (qtd === 0) return;

  window.conciliaState.checksSistema.forEach(id => {
    window.conciliaState.itensOcultados.add(String(id));
  });
  window.conciliaState.checksSistema.clear();
  localStorage.setItem('fc_concilia_ocultados', JSON.stringify(Array.from(window.conciliaState.itensOcultados)));

  const chkAll = document.getElementById("checkTodosSistema");
  if (chkAll) chkAll.checked = false;

  renderizarPainelConciliacao();
  showConciliaToast(`${qtd} lançamento(s) ocultados da conciliação! (O financeiro continua intacto).`, "info");
};

window.ocultarItemIndividual = function(id) {
  const sid = String(id);
  window.conciliaState.itensOcultados.add(sid);
  window.conciliaState.checksSistema.delete(sid);
  localStorage.setItem('fc_concilia_ocultados', JSON.stringify(Array.from(window.conciliaState.itensOcultados)));

  if (window.conciliaState.selectedSistemaId === sid) {
    window.conciliaState.selectedSistemaId = null;
  }

  renderizarPainelConciliacao();
  showConciliaToast("Lançamento ocultado da conciliação (sem alterar o financeiro).", "info");
};

window.reexibirOcultadosLote = function() {
  const qtd = window.conciliaState.checksSistema.size;
  if (qtd === 0) return;

  window.conciliaState.checksSistema.forEach(id => {
    window.conciliaState.itensOcultados.delete(String(id));
  });
  window.conciliaState.checksSistema.clear();
  localStorage.setItem('fc_concilia_ocultados', JSON.stringify(Array.from(window.conciliaState.itensOcultados)));

  const chkAll = document.getElementById("checkTodosSistema");
  if (chkAll) chkAll.checked = false;

  renderizarPainelConciliacao();
  showConciliaToast(`${qtd} lançamento(s) reexibidos na lista!`, "success");
};

window.reexibirItemOcultado = function(id) {
  const sid = String(id);
  window.conciliaState.itensOcultados.delete(sid);
  window.conciliaState.checksSistema.delete(sid);
  localStorage.setItem('fc_concilia_ocultados', JSON.stringify(Array.from(window.conciliaState.itensOcultados)));

  renderizarPainelConciliacao();
  showConciliaToast("Lançamento reexibido na lista de pendentes.", "success");
};

window.reexibirTodosOcultados = function() {
  const qtd = window.conciliaState.itensOcultados.size;
  if (qtd === 0) return;

  window.conciliaState.itensOcultados.clear();
  localStorage.removeItem('fc_concilia_ocultados');

  renderizarPainelConciliacao();
  showConciliaToast(`${qtd} lançamento(s) ocultados reexibidos na lista!`, "success");
};

// Aliases de compatibilidade e segurança
window.ocultarItem = window.ocultarItemIndividual;
window.ocultarLancamentoIndividual = window.ocultarItemIndividual;
window.ignorarLoteSistema = window.ocultarLoteSistema;
window.excluirItemDaLista = window.ocultarItemIndividual;
window.excluirLancamentoIndividual = window.ocultarItemIndividual;
window.excluirLoteDaLista = window.ocultarLoteSistema;
window.excluirLoteSistema = window.ocultarLoteSistema;
window.removerLoteLista = window.ocultarLoteSistema;
window.removerItemLista = window.ocultarItemIndividual;
window.restaurarOcultadosSistema = window.reexibirTodosOcultados;
window.restaurarRemovidosLista = window.reexibirTodosOcultados;

window.filtrarLancamentosSistema = function() {
  renderizarPainelConciliacao();
};

// ==========================================
// 10. GESTÃO DE ABAS & HISTÓRICO
// ==========================================
window.mudarAbaConcilia = function(aba) {
  const btnPend = document.getElementById("tab-btn-pendencias");
  const btnHist = document.getElementById("tab-btn-historico");
  const areaPend = document.getElementById("area-pendencias");
  const areaHist = document.getElementById("area-historico");

  if (aba === "pendencias") {
    btnPend.className = "px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white shadow-sm flex items-center gap-2 transition-all";
    btnHist.className = "px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white flex items-center gap-2 transition-all";
    areaPend.classList.remove("hidden");
    areaHist.classList.add("hidden");
    renderizarPainelConciliacao();
  } else {
    btnHist.className = "px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white shadow-sm flex items-center gap-2 transition-all";
    btnPend.className = "px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white flex items-center gap-2 transition-all";
    areaPend.classList.add("hidden");
    areaHist.classList.remove("hidden");
    renderizarHistorico();
  }
};

window.renderizarHistorico = function(termoFiltro = "") {
  const elList = document.getElementById("historicoList");
  const elStats = document.getElementById("statsHistorico");
  if (!elList) return;

  let conciliados = (window.conciliaState.extrato || []).filter(e => e.status === "CONCILIADO");

  if (termoFiltro) {
    const t = termoFiltro.toLowerCase().trim();
    conciliados = conciliados.filter(c => 
      (c.descricao && c.descricao.toLowerCase().includes(t)) || 
      String(c.valor).includes(t) ||
      (c.data && c.data.includes(t))
    );
  }

  if (elStats) elStats.textContent = `${conciliados.length} transação(ões) no histórico`;

  const badgeTabHist = document.getElementById("badge-tab-historico");
  if (badgeTabHist) badgeTabHist.textContent = (window.conciliaState.extrato || []).filter(e => e.status === "CONCILIADO").length;

  if (conciliados.length === 0) {
    elList.innerHTML = `<p class="text-xs text-slate-400 text-center py-12 italic">Nenhuma transação conciliada encontrada no histórico.</p>`;
    return;
  }

  const finList = (window.db && Array.isArray(window.db.financeiro)) ? window.db.financeiro : [];

  elList.innerHTML = conciliados.map(c => {
    // Busca informações do lançamento vinculado
    let infoVinculo = "Lançamento Vinculado";
    if (c.vinculo) {
      if (Array.isArray(c.vinculo.origens) && c.vinculo.origens.length > 0) {
        infoVinculo = c.vinculo.origens.map(o => `${o.descricao || 'Item'} (R$ ${Number(o.valor || 0).toFixed(2)})`).join(" + ");
      } else if (c.vinculo.origem_id) {
        const sysItem = (window.conciliaState.sistema || []).find(s => String(s.id) === String(c.vinculo.origem_id)) ||
                        finList.find(s => String(s.id) === String(c.vinculo.origem_id));
        if (sysItem) {
          const desc = sysItem.descricao || sysItem.pessoa || sysItem.desc || 'Item';
          infoVinculo = `${desc} (R$ ${Number(sysItem.valor || 0).toFixed(2)})`;
        }
      }
    }

    // Fallback de descrição ou valor se ausente em registros legados
    let descExt = c.descricao;
    let valorExt = Number(c.valor || 0);
    if (!descExt || valorExt === 0) {
      const vId = c.vinculo?.origem_id || c.vinculo?.origens?.[0]?.id;
      const fItem = finList.find(f => String(f.id) === String(vId) || String(f.extrato_id) === String(c.id));
      if (fItem) {
        if (!descExt) descExt = fItem.pessoa || fItem.descricao || fItem.desc || 'Transação Conciliada';
        if (valorExt === 0) valorExt = Number(fItem.valorPago || fItem.valor || 0);
      }
    }

    const isDebito = c.tipo === "DEBITO";
    return `
      <div class="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
        <div class="flex items-start gap-3">
          <div class="w-8 h-8 rounded-lg ${isDebito ? 'bg-red-100 text-red-600 dark:bg-red-950/60' : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60'} flex items-center justify-center text-sm font-bold shrink-0 mt-0.5">
            <i class="fa-solid ${isDebito ? 'fa-arrow-down' : 'fa-arrow-up'}"></i>
          </div>
          <div>
            <h4 class="font-bold text-xs text-slate-800 dark:text-slate-100">${descExt || 'Transação Bancária'}</h4>
            <p class="text-[11px] text-slate-500 dark:text-slate-400">
              Data Extrato: <strong>${c.data || '-'}</strong> • Vinculado a: <span class="text-blue-500 font-medium">${infoVinculo}</span>
            </p>
          </div>
        </div>

        <div class="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
          <div class="text-right">
            <span class="font-black text-xs ${isDebito ? 'val-debito' : 'val-credito'}">
              ${isDebito ? '-' : '+'} R$ ${valorExt.toFixed(2)}
            </span>
            <span class="badge-conciliado block text-[10px] font-bold px-2 py-0.5 rounded-full mt-0.5">Conciliado</span>
          </div>
          <button onclick="desfazerConciliacao('${c.id}')" title="Desfazer e retornar para Pendências" class="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-red-50 dark:hover:bg-red-950/40 text-slate-600 dark:text-slate-300 hover:text-red-600 text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap">
            <i class="fa-solid fa-rotate-left text-amber-500"></i> Desvincular
          </button>
        </div>
      </div>
    `;
  }).join("");
};

window.filtrarHistorico = function(termo) {
  renderizarHistorico(termo);
};

// ==========================================
// 11. DESFAZER CONCILIAÇÃO (DESVINCULAR)
// ==========================================
window.desfazerConciliacao = async function(extratoId) {
  const ext = window.conciliaState.extrato.find(e => e.id === extratoId);
  if (!ext || ext.status !== "CONCILIADO") return;

  if (!confirm(`Deseja desfazer a conciliação de "${ext.descricao}" e retornar para Pendências?`)) return;

  const origens = Array.isArray(ext.vinculo?.origens) && ext.vinculo.origens.length > 0
    ? ext.vinculo.origens
    : (ext.vinculo?.origem_id ? [{ id: ext.vinculo.origem_id, colecao: ext.vinculo.origem_colecao }] : []);

  // Atualiza no banco
  if (typeof window.firebase !== "undefined" && typeof window.firebase.firestore === "function") {
    try {
      const firestore = window.firebase.firestore();
      const batch = firestore.batch();
      const refBase = (typeof window.getEmpresaRef === "function") ? window.getEmpresaRef() : firestore;

      batch.set(refBase.collection("extrato_bancario").doc(ext.id), {
        status: "PENDENTE",
        vinculo: null
      }, { merge: true });

      origens.forEach(orig => {
        const targetCol = orig.colecao === "contas_a_pagar" || orig.colecao === "contas_a_receber" ? "financeiro" : (orig.colecao || "financeiro");
        batch.set(refBase.collection(targetCol).doc(orig.id), {
          status: "PENDENTE",
          conciliado: false,
          extrato_id: null,
          valorPago: null,
          juros: 0,
          acrescimo: 0,
          desconto: 0,
          ultimaAlteracao: Date.now()
        }, { merge: true });
      });

      await batch.commit();
    } catch (e) {
      console.warn("Aviso ao desconciliar no banco:", e);
    }
  }

  // Atualização otimista
  ext.status = "PENDENTE";
  ext.vinculo = null;

  origens.forEach(orig => {
    const sys = window.conciliaState.sistema.find(s => String(s.id) === String(orig.id));
    if (sys) {
      sys.conciliado = false;
      sys.extrato_id = null;
    }
    if (window.db && Array.isArray(window.db.financeiro)) {
      const itemDb = window.db.financeiro.find(f => String(f.id) === String(orig.id));
      if (itemDb) {
        itemDb.conciliado = false;
        itemDb.extrato_id = null;
        itemDb.status = "PENDENTE";
        itemDb.valorPago = null;
        itemDb.juros = 0;
        itemDb.acrescimo = 0;
        itemDb.desconto = 0;
        itemDb.ultimaAlteracao = Date.now();
      }
    }
  });

  if (typeof window.FCCache !== 'undefined' && typeof window.FCCache.set === 'function' && window.db?.financeiro) {
    try { window.FCCache.set('financeiro', window.db.financeiro); } catch (_) {}
  }
  try {
    if (window.db?.financeiro) {
      localStorage.setItem('fc_financeiro', JSON.stringify(window.db.financeiro));
    }
  } catch (_) {}

  salvarExtratoLocalmente();
  carregarLancamentosDoSistema();

  renderizarPainelConciliacao();
  renderizarHistorico();
  showConciliaToast("Conciliação desfeita! As transações voltaram para as Pendências.", "info");
};

window.selecionarItemExtrato = function(id) {
  window.conciliaState.selectedExtratoId = window.conciliaState.selectedExtratoId === id ? null : id;
  renderizarPainelConciliacao();
};

// ==========================================
// 12. CARREGAMENTO DOS LANÇAMENTOS DO SISTEMA
// ==========================================
function carregarLancamentosDoSistema() {
  const lista = [];

  let fin = null;
  if (window.db && Array.isArray(window.db.financeiro) && window.db.financeiro.length > 0) {
    fin = window.db.financeiro;
  } else if (window.FCCache && typeof window.FCCache.get === 'function') {
    fin = window.FCCache.get('financeiro');
  }
  if (!fin || fin.length === 0) {
    try {
      const raw = localStorage.getItem('fc_financeiro');
      if (raw) fin = JSON.parse(raw);
    } catch (_) {}
  }

  if (Array.isArray(fin) && fin.length > 0) {
    if (!window.db) window.db = {};
    if (!window.db.financeiro) window.db.financeiro = fin;

    fin.forEach(f => {
      // Considera pendente apenas títulos que NÃO estejam conciliados e NÃO estejam pagos/cancelados
      if (!f.conciliado && f.status !== "PAGO" && f.status !== "CANCELADO") {
        const isPagar = f.tipo === "DESPESA" || f.tipo === "PAGAR";
        lista.push({
          id: String(f.id),
          colecao: isPagar ? "contas_a_pagar" : "contas_a_receber",
          descricao: f.pessoa || f.desc || f.descricao || "Lançamento",
          valor: Number(f.valor || 0),
          data_vencimento: f.data ? f.data.split("T")[0] : "",
          data_pagamento: f.dataPagamento || null,
          conciliado: false,
          observacao: f.observacao || ""
        });
      }
    });
  }

  window.conciliaState.sistema = lista;
  renderizarPainelConciliacao();
}

// Inicialização imediata (offline-first com cache local)
carregarExtratoLocal();
carregarLancamentosDoSistema();

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    carregarExtratoLocal();
    carregarLancamentosDoSistema();
    carregarExtratoDoBanco();
  });
} else {
  carregarExtratoLocal();
  carregarLancamentosDoSistema();
  carregarExtratoDoBanco();
}

window.addEventListener("fc_cache_pronto", () => {
  carregarLancamentosDoSistema();
  carregarExtratoDoBanco();
});

window.addEventListener("fc-dados-locais-atualizados", (e) => {
  if (!e.detail || e.detail.colecao === "financeiro") {
    carregarLancamentosDoSistema();
  }
});

// Sincronizações progressivas após montagem e autenticação do Firebase
setTimeout(() => { carregarLancamentosDoSistema(); carregarExtratoDoBanco(); }, 600);
setTimeout(() => { carregarLancamentosDoSistema(); carregarExtratoDoBanco(); }, 1800);
setTimeout(() => { carregarLancamentosDoSistema(); carregarExtratoDoBanco(); }, 3500);

