let calendar;
let unsubscribeAgenda = null;
let currentEventId = null;

document.addEventListener('DOMContentLoaded', function() {
    initCalendar();
    
    // Aguardar autenticação do Firebase no global.js para carregar eventos
    const authInterval = setInterval(() => {
        if (typeof window.currentUserInfo !== 'undefined' && window.currentUserInfo !== null) {
            clearInterval(authInterval);
            carregarEventos();
        }
    }, 500);
});

window.onload = () => { initGlobalData(); };

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
            month: 'Mês',
            week: 'Semana',
            day: 'Dia',
            list: 'Lista'
        },
        editable: true, // permite arrastar eventos
        selectable: true,
        selectMirror: true,
        dayMaxEvents: true, // Exibe "mais +" quando tem muitos
        height: '100%',
        
        // Ao clicar num dia ou arrastar seleção
        select: function(info) {
            abrirModalEvento(null, info.startStr, info.endStr);
            calendar.unselect();
        },
        
        // Ao clicar num evento existente
        eventClick: function(info) {
            abrirModalEvento(info.event);
        },
        
        // Ao arrastar e soltar (reagendar)
        eventDrop: function(info) {
            atualizarDataEvento(info.event);
        },
        
        // Ao redimensionar evento
        eventResize: function(info) {
            atualizarDataEvento(info.event);
        }
    });
    
    calendar.render();
}

function carregarEventos() {
    if (unsubscribeAgenda) unsubscribeAgenda();
    
    showToast("Carregando agenda...", "info");
    
    unsubscribeAgenda = firestore.collection('fc_moveis').doc('config')
        .onSnapshot((doc) => {
            // Remove todos os eventos atuais
            calendar.removeAllEvents();
            
            if (!doc.exists) return;
            
            const docData = doc.data() || {};
            const data = docData.agenda_eventos || {};
            
            Object.keys(data).forEach(key => {
                let ev = data[key];
                calendar.addEvent({
                    id: key,
                    title: ev.titulo,
                    start: ev.inicio,
                    end: ev.fim || null,
                    allDay: ev.diaInteiro,
                    backgroundColor: ev.cor || '#3b82f6',
                    borderColor: ev.cor || '#3b82f6',
                    extendedProps: {
                        descricao: ev.descricao || ''
                    }
                });
            });
        }, (error) => {
            console.error("Erro ao carregar agenda:", error);
            showToast("Erro ao carregar agenda. Verifique permissões.", "error");
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
            await firestore.collection('fc_moveis').doc('config').set({
                agenda_eventos: {
                    [id]: eventoData
                }
            }, { merge: true });
            showToast("Lembrete atualizado!", "success");
        } else {
            const newId = String(Date.now());
            eventoData.criadoEm = new Date().toISOString();
            await firestore.collection('fc_moveis').doc('config').set({
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
        await firestore.collection('fc_moveis').doc('config').update({
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
        await firestore.collection('fc_moveis').doc('config').set({
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
