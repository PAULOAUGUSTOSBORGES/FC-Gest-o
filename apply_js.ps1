$content = Get-Content financeiro.js -Raw -Encoding UTF8

$calendarScript = @"

// ====== INÍCIO CALENDÁRIO ======
let finCalendar = null;

function mudarVisualizacaoFin(tipo) {
    const btnLista = document.getElementById('fin-view-lista');
    const btnCal = document.getElementById('fin-view-calendario');
    const abas = document.getElementById('fin-abas-container');
    
    if (tipo === 'lista') {
        btnLista.classList.replace('text-slate-600', 'text-white');
        btnLista.classList.replace('dark:text-slate-300', 'text-white');
        btnLista.classList.replace('hover:text-slate-800', 'text-white');
        btnLista.classList.replace('dark:text-slate-100', 'text-white');
        btnLista.classList.add('bg-blue-600');
        
        btnCal.classList.remove('bg-blue-600', 'text-white');
        btnCal.classList.add('text-slate-600', 'dark:text-slate-300', 'hover:text-slate-800', 'dark:text-slate-100');
        
        abas.classList.remove('hidden');
        document.getElementById('fin-area-calendario').classList.add('hidden');
        renderFinAbas(document.getElementById('fin-tab-receber').classList.contains('bg-blue-600') ? 'receber' : 'pagar');
    } else {
        btnCal.classList.replace('text-slate-600', 'text-white');
        btnCal.classList.replace('dark:text-slate-300', 'text-white');
        btnCal.classList.replace('hover:text-slate-800', 'text-white');
        btnCal.classList.replace('dark:text-slate-100', 'text-white');
        btnCal.classList.add('bg-blue-600');
        
        btnLista.classList.remove('bg-blue-600', 'text-white');
        btnLista.classList.add('text-slate-600', 'dark:text-slate-300', 'hover:text-slate-800', 'dark:text-slate-100');
        
        abas.classList.add('hidden');
        document.getElementById('fin-area-receber').classList.add('hidden');
        document.getElementById('fin-area-pagar').classList.add('hidden');
        document.getElementById('fin-area-calendario').classList.remove('hidden');
        
        if (!finCalendar) {
            initFinCalendar();
        } else {
            finCalendar.render();
        }
    }
}

function initFinCalendar() {
    const calendarEl = document.getElementById('fin-calendar');
    if(!calendarEl) return;
    finCalendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        locale: 'pt-br',
        height: 600,
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek'
        },
        buttonText: { today: 'Hoje', month: 'Mês', week: 'Semana' },
        events: getFinEvents(),
        eventClick: function(info) {
            const id = info.event.extendedProps.idReal;
            if(id) {
                // Abre a edição
                window.abrirModalEdicao(id);
            }
        }
    });
    finCalendar.render();
}

function getFinEvents() {
    if(!db.financeiro) return [];
    return db.financeiro.map(f => {
        let isReceita = f.tipo === 'RECEITA';
        let isPago = f.status === 'PAGO';
        let color = isReceita ? '#10b981' : '#ef4444'; // emerald-500 / red-500
        
        let title = `R$ ${formatMoney(f.valor)}`;
        if(f.pessoa) title += ` - ${f.pessoa}`;
        if(isPago) title = '✓ ' + title;

        return {
            title: title,
            start: f.data.split(' ')[0],
            backgroundColor: color,
            borderColor: color,
            extendedProps: { idReal: f.id }
        };
    });
}
// ====== FIM CALENDÁRIO ======

"@

$content = $content + $calendarScript
Set-Content financeiro.js $content -Encoding UTF8
