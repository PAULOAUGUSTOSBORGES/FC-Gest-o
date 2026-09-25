let calendar;
let unsubscribeAgenda = null;
let currentEventId = null;

document.addEventListener('DOMContentLoaded', function() {
    initCalendar();
    
    if (typeof window.currentUserInfo !== 'undefined' && window.currentUserInfo !== null) {
        carregarEventos();
    } else {
        const authInterval = setInterval(() => {
        if (!window.authInterval_attempts) window.authInterval_attempts = 0;
        window.authInterval_attempts++;
        if (window.authInterval_attempts > 100) { clearInterval(authInterval); return; }
        if (typeof window.currentUserInfo !== 'undefined' && window.currentUserInfo !== null) {
                clearInterval(authInterval);
                carregarEventos();
            }
        }, 150);
    }
});

window.addEventListener('load', () => { initGlobalData(carregarEventos); });

let financeiroEventsData = [];
let agendaEventsData = {};
let unsubscribeFinanceiro = null;

function renderizarTodosEventosAgenda() {
    if (!calendar) return;
    calendar.removeAllEvents();
    
    if (agendaEventsData) {
        Object.keys(agendaEventsData).forEach(key => {
            let ev = agendaEventsData[key];
            calendar.addEvent({
                id: key,
                title: ev.titulo,
                start: ev.inicio,
                end: ev.fim || null,
                allDay: ev.diaInteiro,
                backgroundColor: ev.cor || '#3b82f6',
                borderColor: ev.cor || '#3b82f6',
                extendedProps: {
                    descricao: ev.descricao || '',
                    tipoEvento: 'AGENDA'
                }
            });
        });
    }
    
    if (financeiroEventsData && Array.isArray(financeiroEventsData)) {
        financeiroEventsData.forEach(f => {
            if (f.status === 'CANCELADO' || f.status === 'RENEGOCIADO') return;
            // NUNCA agendar vendas automaticamente na agenda!
            if (f.origemVendaId || f.categoria === 'Vendas' || f.tipo === 'RECEITA' || (f.ref && (f.ref.includes('Venda') || f.ref.includes('Pedido')))) return;
            
            let color = '#ef4444'; 
            if (f.tipo === 'RECEITA') color = '#10b981';
            if (f.status === 'PAGO') color = '#64748b';
            
            let dateStr = f.data;
            if (dateStr && dateStr.includes('T')) dateStr = dateStr.split('T')[0];
            
            const valorFmt = typeof window.formatMoney === 'function' ? window.formatMoney(f.valor) : ('R$ ' + parseFloat(f.valor||0).toFixed(2));
            const titulo = (f.pessoa || 'Diversos') + ' - ' + valorFmt;
            
            if (dateStr) {
                calendar.addEvent({
                    id: 'fin_' + f.id,
                    title: titulo,
                    start: dateStr,
                    allDay: true,
                    backgroundColor: color,
                    borderColor: color,
                    extendedProps: {
                        descricao: 'Evento do m�dulo financeiro.',
                        tipoEvento: 'FINANCEIRO',
                        originalId: f.id
                    }
                });
            }
        });
    }
}

function initCalendar() {
    var calendarEl = document.getElementById('calendar');
    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        locale: 'pt-br',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek'
        },
        buttonText: {
            today: 'Hoje',
            month: 'M�s',
            week: 'Semana',
            day: 'Dia',
            list: 'Lista'
        },
        editable: true,
        selectable: true,
        selectMirror: true,
        dayMaxEvents: true,
        height: '100%',
        
        select: function(info) {
            abrirModalEvento(null, info.startStr, info.endStr);
            calendar.unselect();
        },
        
        eventClick: function(info) {
            if (info.event.extendedProps && info.event.extendedProps.tipoEvento === 'FINANCEIRO') {
                if (typeof showToast === 'function') {
                    showToast('Conta a pagar/receber. Acesse o m�dulo Financeiro para visualizar.', 'info');
                } else {
                    alert('Acesse o m�dulo Financeiro para visualizar esta conta.');
                }
                return;
            }
            abrirModalEvento(info.event);
        },
        
        eventDrop: function(info) {
            if (info.event.extendedProps && info.event.extendedProps.tipoEvento === 'FINANCEIRO') {
                info.revert();
                if (typeof showToast === 'function') showToast('N�o � poss�vel reagendar contas por aqui.', 'error');
                return;
            }
            atualizarDataEvento(info.event);
        },
        
        eventResize: function(info) {
            if (info.event.extendedProps && info.event.extendedProps.tipoEvento === 'FINANCEIRO') {
                info.revert();
                if (typeof showToast === 'function') showToast('N�o � poss�vel reagendar contas por aqui.', 'error');
                return;
            }
            atualizarDataEvento(info.event);
        }
    });
    
    calendar.render();
}

function carregarEventos() {
    if (window.__paginaBloqueadaPorPermissao || (typeof window.verificarPermissaoRota === 'function' && !window.verificarPermissaoRota(window.location.pathname).permitido)) {
        console.warn('Bloqueando execução: usuário sem permissão para esta rota.');
        return;
    }
    if (window.__paginaBloqueadaPorPlano) return;
    if (unsubscribeAgenda) unsubscribeAgenda();
    if (unsubscribeFinanceiro) unsubscribeFinanceiro();
    
    const _listenDoc = (typeof window.fcListenDoc === 'function') ? window.fcListenDoc : function(col, id, cb) {
        return firestore.collection(col).doc(id).onSnapshot(doc => cb(doc.exists ? doc.data() : null));
    };
    const _listenCollection = (typeof window.fcListenCollection === 'function') ? window.fcListenCollection : function(col, cb) {
        return firestore.collection(col).onSnapshot(snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    };
    
    unsubscribeAgenda = _listenDoc('fc_moveis', 'config', function(docData) {
        agendaEventsData = (docData && docData.agenda_eventos) ? docData.agenda_eventos : {};
        renderizarTodosEventosAgenda();
    });
    
    unsubscribeFinanceiro = _listenCollection('financeiro', function(dados) {
        financeiroEventsData = dados || [];
        renderizarTodosEventosAgenda();
    });
} 

function abrirModalEvento(eventoObj = null, dataInicio = '', dataFim = '') {
    const tituloEl = document.getElementById('modal-evento-titulo');
    const btnExcluir = document.getElementById('btn-excluir-evento');
    
    // Limpar formulário
    document.getElementById('evento-id').value = '';
    document.getElementById('evento-titulo').value = '';
    document.getElementById('evento-desc').value = '';
    document.getElementById('evento-hora-ini').value = '';
    
    // Resetar cor para azul
    document.querySelector('input[name="evento-cor"][value="#3b82f6"]').checked = true;

    if (eventoObj) {
        // Modo Edição
        tituloEl.innerHTML = '<i class="fa-solid fa-pen text-blue-500"></i> Editar Lembrete';
        btnExcluir.classList.remove('hidden');
        
        document.getElementById('evento-id').value = eventoObj.id;
        document.getElementById('evento-titulo').value = eventoObj.title;
        document.getElementById('evento-desc').value = eventoObj.extendedProps.descricao || '';
        
        // Formatar datas
        let dIni = eventoObj.start;
        document.getElementById('evento-data-ini').value = dIni.toISOString().split('T')[0];
        
        if (!eventoObj.allDay && dIni.getHours() !== 0) {
            document.getElementById('evento-hora-ini').value = dIni.toTimeString().substring(0, 5);
        }
        
        // Selecionar cor
        let cor = eventoObj.backgroundColor;
        let radioCor = document.querySelector(`input[name="evento-cor"][value="${cor}"]`);
        if (radioCor) radioCor.checked = true;
        
    } else {
        // Modo Novo
        tituloEl.innerHTML = '<i class="fa-regular fa-calendar-plus text-blue-500"></i> Novo Lembrete';
        btnExcluir.classList.add('hidden');
        
        // Se veio do click no calendário (dataInicio ex: '2023-10-15')
        if (dataInicio) {
            // Se tiver T, tira
            document.getElementById('evento-data-ini').value = dataInicio.split('T')[0];
            if(dataInicio.includes('T')) {
                document.getElementById('evento-hora-ini').value = dataInicio.split('T')[1].substring(0,5);
            }
        } else {
            document.getElementById('evento-data-ini').value = new Date().toISOString().split('T')[0];
        }
    }
    
    document.getElementById('modal-evento').classList.remove('hidden');
    setTimeout(() => document.getElementById('evento-titulo').focus(), 100);
}

function fecharModalEvento() {
    document.getElementById('modal-evento').classList.add('hidden');
}

async function salvarEvento() {
    const id = document.getElementById('evento-id').value;
    const titulo = document.getElementById('evento-titulo').value.trim();
    const dataIniStr = document.getElementById('evento-data-ini').value;
    const horaIniStr = document.getElementById('evento-hora-ini').value;
    const desc = document.getElementById('evento-desc').value.trim();
    const cor = document.querySelector('input[name="evento-cor"]:checked').value;
    
    if (!titulo || !dataIniStr) {
        showToast("Título e Data são obrigatórios.", "warning");
        return;
    }
    
    let inicio = dataIniStr;
    let diaInteiro = true;
    
    if (horaIniStr) {
        inicio = `${dataIniStr}T${horaIniStr}:00`;
        diaInteiro = false;
    }
    
    const eventoData = {
        titulo: titulo,
        inicio: inicio,
        diaInteiro: diaInteiro,
        descricao: desc,
        cor: cor,
        atualizadoEm: new Date().toISOString()
    };
    
    fecharModalEvento();
    showToast("Salvando lembrete...", "info");
    
    try {
        if (id) {
            await window.getEmpresaRef().collection('configuracoes').doc('config').set({
                agenda_eventos: {
                    [id]: eventoData
                }
            }, { merge: true });
            showToast("Lembrete atualizado!", "success");
        } else {
            const newId = String(Date.now());
            eventoData.criadoEm = new Date().toISOString();
            await window.getEmpresaRef().collection('configuracoes').doc('config').set({
                agenda_eventos: {
                    [newId]: eventoData
                }
            }, { merge: true });
            showToast("Lembrete criado!", "success");
        }
    } catch (e) {
        console.error("Erro ao salvar evento:", e);
        showToast("Erro ao salvar: " + e.message, "error");
    }
}

async function excluirEvento() {
    const id = document.getElementById('evento-id').value;
    if (!id) return;
    
    if (!confirm("Tem certeza que deseja excluir este lembrete?")) return;
    
    fecharModalEvento();
    
    try {
        await window.getEmpresaRef().collection('configuracoes').doc('config').update({
            [`agenda_eventos.${id}`]: firebase.firestore.FieldValue.delete()
        });
        showToast("Lembrete excluído.", "success");
    } catch (e) {
        console.error("Erro ao excluir:", e);
        showToast("Erro ao excluir: " + e.message, "error");
    }
}

async function atualizarDataEvento(eventoFullCalendar) {
    let id = eventoFullCalendar.id;
    let novoInicio = eventoFullCalendar.startStr;
    let novoFim = eventoFullCalendar.endStr || null;
    let allDay = eventoFullCalendar.allDay;
    
    const eventoData = {
        inicio: novoInicio,
        fim: novoFim,
        diaInteiro: allDay,
        atualizadoEm: new Date().toISOString()
    };
    
    try {
        await window.getEmpresaRef().collection('configuracoes').doc('config').set({
            agenda_eventos: {
                [id]: eventoData
            }
        }, { merge: true });
        showToast("Data atualizada!", "success");
    } catch (e) {
        console.error("Erro ao atualizar data:", e);
        showToast("Erro ao mover: " + e.message, "error");
        eventoFullCalendar.revert();
    }
}






