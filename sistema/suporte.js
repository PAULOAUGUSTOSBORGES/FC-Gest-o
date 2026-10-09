// ======================================================================
// SUPORTE.JS - Módulo de Suporte & Autoatendimento Especialista FC-Gestão
// v2.0 - FAQ Dinâmico com Aprendizado da IA
// ======================================================================

const FAQ_FC_GESTAO = [
    // --- PRODUTOS & ESTOQUE ---
    {
        id: 'faq_produtos_foto',
        categoria: 'Produtos & Estoque',
        pergunta: 'Como colocar foto no meu produto no cadastro?',
        resposta: `Para anexar foto(s) a um produto:
        <ol class="list-decimal list-inside space-y-1.5 mt-2">
            <li>Acesse o menu <strong>Produtos & Estoque</strong>.</li>
            <li>Localize o produto desejado e clique no botão <strong>Editar (lápis)</strong> ou clique em <strong>+ Novo Produto</strong>.</li>
            <li>No formulário, procure a seção <strong>Fotos / Imagens do Produto</strong>.</li>
            <li>Clique no botão <strong>Escolher Arquivo / Carregar Foto</strong> ou cole o link (URL) da imagem.</li>
            <li>Você pode selecionar uma foto principal e fotos adicionais.</li>
            <li>Clique em <strong>Salvar Produto</strong>. As fotos aparecem imediatamente no catálogo da <em>Loja Virtual</em> e na busca rápida do PDV.</li>
        </ol>`
    },
    {
        id: 'faq_produtos_cadastro',
        categoria: 'Produtos & Estoque',
        pergunta: 'Como cadastrar um novo produto com código de barras e estoque mínimo?',
        resposta: `Siga o passo a passo:
        <ol class="list-decimal list-inside space-y-1.5 mt-2">
            <li>Vá em <strong>Produtos & Estoque</strong> e clique em <strong>+ Novo Produto</strong>.</li>
            <li>Preencha o <strong>Nome do Produto</strong> e selecione a <strong>Categoria</strong>.</li>
            <li>No campo <strong>Código de Barras (EAN)</strong>, bipe com o leitor ou digite o código de barras (se deixar vazio, o sistema pode gerar um código interno).</li>
            <li>Preencha o <strong>Preço de Custo</strong> e o <strong>Preço de Venda</strong> (o sistema calcula a margem de lucro automaticamente).</li>
            <li>Defina o <strong>Estoque Atual</strong> e o <strong>Estoque Mínimo</strong> (você receberá avisos quando o estoque estiver baixo).</li>
            <li>Clique em <strong>Salvar Produto</strong>.</li>
        </ol>`
    },
    {
        id: 'faq_produtos_grade',
        categoria: 'Produtos & Estoque',
        pergunta: 'Como controlar variações de tamanho, cor ou tecido no produto?',
        resposta: `No cadastro ou edição de produto, você pode habilitar <strong>Variações / Personalizações</strong>. Você define atributos (ex: Cor: Preto, Bege, Marrom | Tamanho: P, M, G | Madeira: Cedro, Peroba). No PDV e na Loja Virtual, o vendedor ou cliente seleciona a combinação exata no momento do pedido.`
    },
    {
        id: 'faq_compras_xml',
        categoria: 'Produtos & Estoque',
        pergunta: 'Como dar entrada no estoque importando o XML da NF-e do fornecedor?',
        resposta: `A importação de XML automatiza todo o estoque e o financeiro:
        <ol class="list-decimal list-inside space-y-1.5 mt-2">
            <li>Acesse o menu <strong>Compras & NF-e XML</strong>.</li>
            <li>Clique no botão <strong>Importar XML de Compra</strong>.</li>
            <li>Selecione o arquivo <code>.xml</code> emitido pelo seu distribuidor.</li>
            <li>O sistema faz a correlação dos produtos recebidos com os do seu estoque (ou cadastra automaticamente os novos).</li>
            <li>Confirme a entrada: o estoque soma as quantidades e o sistema lança as contas a pagar no <strong>Financeiro</strong> com as parcelas da nota!</li>
        </ol>`
    },
    {
        id: 'faq_ajuste_estoque',
        categoria: 'Produtos & Estoque',
        pergunta: 'Como fazer ajuste de inventário ou contagem física de estoque?',
        resposta: `Em <strong>Produtos & Estoque</strong>, você pode editar diretamente o saldo do produto clicando em <strong>Ajustar Estoque</strong> ou realizar a conferência via balanço. Informe a quantidade contada e o motivo (ex: avaria, contagem periódica ou perda).`
    },

    // --- FRENTE DE CAIXA (PDV) ---
    {
        id: 'faq_pdv_venda',
        categoria: 'Frente de Caixa (PDV)',
        pergunta: 'Como realizar uma venda rápida no PDV?',
        resposta: `Operação de venda passo a passo:
        <ol class="list-decimal list-inside space-y-1.5 mt-2">
            <li>Acesse <strong>Frente de Loja / PDV</strong>.</li>
            <li>Passe o leitor de código de barras ou digite o nome do produto na barra de pesquisa e pressione Enter.</li>
            <li>Para aplicar desconto ou alterar quantidade, utilize os atalhos ou os campos na linha do item.</li>
            <li>Vincule o <strong>Cliente</strong> e o <strong>Vendedor</strong> (para cálculo automático de comissão).</li>
            <li>Clique em <strong>Finalizar Venda (F2 ou botão verde)</strong>.</li>
            <li>Escolha a forma de pagamento: <em>Dinheiro, PIX, Cartão de Crédito, Débito ou Crediário/A Prazo</em>.</li>
            <li>Confirme a venda! Você pode imprimir o cupom térmico (58mm/80mm) ou enviar o comprovante no WhatsApp do cliente.</li>
        </ol>`
    },
    {
        id: 'faq_pdv_sangria',
        categoria: 'Frente de Caixa (PDV)',
        pergunta: 'Como fazer Sangria ou Suprimento no Caixa?',
        resposta: `No topo da tela do <strong>PDV</strong> ou em <strong>Caixa Físico</strong>:
        <ul class="list-disc list-inside space-y-1 mt-2">
            <li><strong>Suprimento:</strong> Utilize para colocar o troco de abertura no início do expediente. Clique em <em>Movimentação de Caixa</em> &rarr; <em>Suprimento</em> &rarr; informe o valor.</li>
            <li><strong>Sangria:</strong> Utilize para retirar dinheiro em espécie acumulado na gaveta por segurança. Clique em <em>Movimentação de Caixa</em> &rarr; <em>Sangria</em> &rarr; informe o valor e motivo.</li>
        </ul>
        Todas as movimentações ficam registradas no relatório de fechamento de caixa.`
    },
    {
        id: 'faq_fechamento_caixa',
        categoria: 'Frente de Caixa (PDV)',
        pergunta: 'Como fechar o caixa no final do dia e conferir valores?',
        resposta: `Acesse o menu <strong>Caixa Físico</strong>:
        <ol class="list-decimal list-inside space-y-1.5 mt-2">
            <li>Clique em <strong>Fechar Caixa</strong>.</li>
            <li>O sistema apresentará o resumo detalhado por forma de recebimento: total em Dinheiro, Cartão de Crédito, Débito, PIX e Boletos.</li>
            <li>Informe o valor físico contado na gaveta. Se houver diferença (sobra ou quebra), o sistema aponta no relatório.</li>
            <li>Imprima a folha de fechamento de caixa ou salve em PDF para a contabilidade.</li>
        </ol>`
    },
    {
        id: 'faq_cancelar_venda',
        categoria: 'Frente de Caixa (PDV)',
        pergunta: 'Como cancelar uma venda feita por engano no PDV?',
        resposta: `Vá em <strong>Gestão de Vendas</strong>, localize a venda pelo número do pedido ou nome do cliente. Clique no botão de opções e selecione <strong>Cancelar Venda</strong>. O sistema estorna os produtos automaticamente para o estoque e estorna o lançamento no fluxo de caixa.`
    },
    {
        id: 'faq_impressora_termica',
        categoria: 'Frente de Caixa (PDV)',
        pergunta: 'Como configurar a impressora térmica de bobina (58mm ou 80mm)?',
        resposta: `Acesse <strong>Configurações</strong> &rarr; role até <strong>Impressão & Cupom</strong>:
        <ul class="list-disc list-inside space-y-1 mt-2">
            <li>Selecione o tamanho da bobina: <strong>80mm</strong> (padrão largo) ou <strong>58mm</strong> (mini impressoras USB/Bluetooth).</li>
            <li>Ative a opção <em>Impressão Automática ao Finalizar Venda</em> se quiser que o cupom saia imediatamente.</li>
            <li>Defina mensagem de rodapé (ex: 'Obrigado pela preferência! Volte sempre').</li>
        </ul>`
    },

    // --- FISCAL (NF-e / NFC-e) ---
    {
        id: 'faq_fiscal_nfe',
        categoria: 'Fiscal (NF-e/NFC-e)',
        pergunta: 'Como emitir uma Nota Fiscal Eletrônica (NF-e mod. 55 ou NFC-e mod. 65)?',
        resposta: `Acesse <strong>Emissor Fiscal NF-e/NFC-e</strong>:
        <ol class="list-decimal list-inside space-y-1.5 mt-2">
            <li>Você pode clicar em <strong>Gerar Nota a partir de Venda</strong> ou <strong>Nova NF-e Avulsa</strong>.</li>
            <li>Verifique se o cliente possui CPF/CNPJ e endereço completo cadastrados.</li>
            <li>Revise os itens e seus dados tributários: NCM, CFOP (5.102/6.102 padrão revenda) e CSOSN/CST.</li>
            <li>Clique em <strong>Transmitir para SEFAZ</strong>.</li>
            <li>Após autorizada, você pode baixar o XML oficial ou imprimir o DANFE em PDF com 1 clique.</li>
        </ol>`
    },
    {
        id: 'faq_fiscal_nfse',
        categoria: 'Fiscal (NF-e/NFC-e)',
        pergunta: 'Como funciona a emissão de Nota Fiscal de Serviços (NFS-e) e em quais cidades?',
        resposta: `O módulo de NFS-e é opcional e pode ser ativado em <strong>Configurações</strong> &rarr; aba <strong>Fiscal</strong>:
        <ul class="list-disc list-inside space-y-1.5 mt-2">
            <li><strong>Empresas de Goiânia - GO:</strong> Possui conexão direta via Web Service oficial (padrão ABRASF 2.04 / SEFIN Goiânia) com Certificado Digital A1. Em Configurações, há o botão <em>[Copiar E-mail p/ Prefeitura]</em> para solicitar a liberação do seu CNPJ na SEFIN com 1 clique.</li>
            <li><strong>Empresas de Outros Municípios:</strong> O sistema opera em modo <strong>RPS Oficial / Espelho Fiscal Municipal</strong>, gerando a numeração e espelho fiscal para escrituração contábil e importação no portal da sua prefeitura local, sem custos adicionais.</li>
            <li><strong>Notas de Mercadorias (NFC-e e NF-e):</strong> Funcionam diretamente com os servidores da SEFAZ em todo o território nacional.</li>
        </ul>`
    },
    {
        id: 'faq_fiscal_certificado',
        categoria: 'Fiscal (NF-e/NFC-e)',
        pergunta: 'Como configurar o Certificado Digital A1 no sistema?',
        resposta: `No menu <strong>Configurações</strong> &rarr; aba <strong>Dados Fiscais & Certificado</strong>:
        <ul class="list-disc list-inside space-y-1 mt-2">
            <li>Faça o upload do arquivo do Certificado Digital modelo <strong>A1 (.pfx ou .p12)</strong>.</li>
            <li>Digite a senha do certificado.</li>
            <li>Preencha a Inscrição Estadual (IE) e o Regime Tributário (Simples Nacional ou Regime Normal).</li>
            <li>O sistema guarda as credenciais criptografadas para assinatura das notas fiscais.</li>
        </ul>`
    },

    // --- FINANCEIRO & GESTÃO ---
    {
        id: 'faq_financeiro_contas',
        categoria: 'Financeiro',
        pergunta: 'Como cadastrar e quitar Contas a Pagar e Contas a Receber?',
        resposta: `Acesse <strong>Contas a Pagar/Receber</strong>:
        <ul class="list-disc list-inside space-y-1.5 mt-2">
            <li><strong>Lançar nova despesa:</strong> Clique em <em>+ Nova Conta</em>, defina se é Pagar ou Receber, valor, data de vencimento, fornecedor/cliente e centro de custo.</li>
            <li><strong>Parcelamento:</strong> Você pode gerar parcelas automáticas (ex: 3x, 6x, 12x) com cálculo de juros ou vencimentos mensais.</li>
            <li><strong>Dar baixa:</strong> Ao pagar ou receber, clique no ícone de check da linha, informe o valor pago e a forma (PIX, Dinheiro, Banco) para atualizar o saldo bancário.</li>
        </ul>`
    },
    {
        id: 'faq_dre_lucro',
        categoria: 'Financeiro',
        pergunta: 'Onde vejo o Lucro Líquido Real da minha loja (DRE)?',
        resposta: `No menu <strong>Relatórios & DRE</strong>:
        O sistema gera o Demonstrativo de Resultado estruturado:
        <br><code>(+) Vendas Brutas</code>
        <br><code>(-) Custos dos Produtos Vendidos (CPV)</code>
        <br><code>(=) Lucro Bruto</code>
        <br><code>(-) Despesas Fixas e Variáveis</code>
        <br><code>(=) LUCRO LÍQUIDO REAL</code>
        Você pode filtrar por Hoje, Este Mês, Mês Passado ou Ano.`
    },
    {
        id: 'faq_comissoes',
        categoria: 'Financeiro',
        pergunta: 'Como calcular e fechar a comissão dos vendedores?',
        resposta: `No menu <strong>Relatórios & DRE</strong> &rarr; aba <strong>Comissão Detalhada de Vendedores</strong>:
        O sistema lista todas as vendas realizadas por cada colaborador no período, a porcentagem de comissão cadastrada para ele e o valor total em reais a ser pago. Você pode exportar para Excel ou PDF para fazer o pagamento.`
    },

    // --- LOJA VIRTUAL & MARKETING ---
    {
        id: 'faq_loja_virtual_link',
        categoria: 'Loja Virtual',
        pergunta: 'Como funciona a Minha Loja Virtual e como meus clientes compram?',
        resposta: `O FC-Gestão cria um site/catálogo online exclusivo para a sua loja:
        <ul class="list-disc list-inside space-y-1.5 mt-2">
            <li>Seus clientes acessam o link pelo celular ou computador, vêem as fotos, preços e categorias dos seus produtos.</li>
            <li>Eles montam o carrinho e clicam em <strong>Finalizar Pedido</strong>.</li>
            <li>O pedido chega com a lista completa, endereço de entrega e total formatado diretamente no seu <strong>WhatsApp</strong>!</li>
            <li>O link da sua loja pode ser colocado na bio do seu Instagram ou compartilhado nos grupos de clientes.</li>
        </ul>`
    },
    {
        id: 'faq_loja_personalizacao',
        categoria: 'Loja Virtual',
        pergunta: 'Como trocar as cores, logotipo e banner da Minha Loja Virtual?',
        resposta: `Acesse <strong>Configurações</strong> &rarr; seção <strong>Minha Loja Virtual</strong>. Você pode alterar o nome de exibição, carregar o logotipo da sua marca, colocar foto de capa/banner promocional e definir taxa de entrega para bairros ou frete a combinar.`
    },

    // --- CLIENTES & CADASTROS ---
    {
        id: 'faq_relatorio_cliente',
        categoria: 'Clientes & Cadastros',
        pergunta: 'Como puxar relatório de um cliente ou ver o histórico de compras dele?',
        resposta: `Você pode consultar e exportar dados de clientes de duas formas no sistema:
        <ol class="list-decimal list-inside space-y-1.5 mt-2">
            <li><strong>Para ver o histórico de compras de um cliente específico:</strong> Acesse o menu <strong>Gestão de Vendas</strong>, digite o nome do cliente no campo <em>Buscar Cliente ou Pedido...</em> e defina o período (ex: <em>Histórico Completo</em>). O sistema lista todos os pedidos, produtos comprados, formas de pagamento e permite reimprimir cupons ou reenviar o comprovante no WhatsApp.</li>
            <li><strong>Para exportar a lista/relatório completo de clientes cadastrados:</strong> Acesse o menu <strong>Clientes</strong>. No topo da tela (ao lado da busca), clique nos botões <strong>Puxar: Excel, Word ou PDF</strong>. O relatório será baixado imediatamente no formato escolhido com telefones, CPF/CNPJ, endereços e cidades.</li>
            <li><strong>Para ver débitos ou crediário (fiado):</strong> Acesse o menu <strong>Contas a Pagar/Receber</strong> e filtre por cliente para ver o extrato completo de parcelas em aberto e quitadas.</li>
        </ol>
        <p class="mt-2 text-[10px] text-slate-400">💡 <em>Nota: O assistente de suporte orienta o caminho e os menus do sistema, mantendo os dados da sua empresa seguros.</em></p>`
    },
    {
        id: 'faq_cadastrar_cliente',
        categoria: 'Clientes & Cadastros',
        pergunta: 'Como cadastrar um novo cliente com CPF/CNPJ e endereço completo?',
        resposta: `Acesse o menu <strong>Clientes</strong> e clique no botão azul <strong>+ Novo Cliente</strong>.
        Preencha o Nome Completo ou Razão Social, selecione Pessoa Física (CPF) ou Jurídica (CNPJ), informe o WhatsApp para envio automático de comprovantes e preencha o CEP para preenchimento automático do endereço. Clique em <strong>Salvar Cliente</strong>. O cliente já fica disponível para seleção no PDV.`
    },

    // --- GESTÃO DE VENDAS & COMPROVANTES ---
    {
        id: 'faq_gestao_vendas_comprovante',
        categoria: 'Gestão de Vendas',
        pergunta: 'Como reimprimir cupom de uma venda passada ou reenviar comprovante no WhatsApp?',
        resposta: `Acesse o menu <strong>Gestão de Vendas</strong>:
        <ol class="list-decimal list-inside space-y-1.5 mt-2">
            <li>Localize a venda digitando o nome do cliente ou o número do pedido no campo <strong>Buscar Cliente ou Pedido...</strong>.</li>
            <li>Se a venda for antiga, mude o seletor de período para <strong>Histórico Completo</strong> ou <strong>Mês Anterior</strong>.</li>
            <li>Na linha da venda, clique no ícone de <strong>Impressora</strong> para reimprimir o cupom térmico (58mm/80mm) ou no ícone de <strong>WhatsApp</strong> para enviar a segunda via ao cliente.</li>
        </ol>`
    },

    // --- SISTEMA & ASSINATURA ---
    {
        id: 'faq_usuarios_equipe',
        categoria: 'Sistema & Acessos',
        pergunta: 'Como criar login individual para funcionários e vendedores?',
        resposta: `Acesse o menu <strong>Funcionários / Vendedores</strong> e clique em <strong>+ Novo Funcionário</strong>. Preencha nome, e-mail, senha e defina o cargo/perfil (Vendedor, Operador de Caixa ou Gerente). Cada colaborador terá seu próprio login para que as vendas e comissões fiquem separadas.`
    },
    {
        id: 'faq_plano_renovacao',
        categoria: 'Sistema & Acessos',
        pergunta: 'Como renovar meu plano ou pagar a mensalidade do sistema?',
        resposta: `Para renovar sua assinatura ou solicitar liberação de novos módulos, você pode pagar via PIX utilizando os dados cadastrados ou clicar no botão <strong>Chamar no WhatsApp</strong> aqui na Central de Suporte. O suporte confirmará seu pagamento e liberará seu acesso imediatamente.`
    }
];

// FAQ carregado dinamicamente do Firestore (respostas aprendidas pela IA)
let FAQ_DINAMICO = [];

let categoriaAtiva = 'Todos';
let numeroWhatsappFundador = '5562999676874';
let historicoChatIa = [];
let chaveGeminiMaster = '';
let _faqDinamicoCarregado = false;
let _saasAppSuporte = null;

function inicializarTelaSuporte() {
    carregarCategorias();
    filtrarFaqSistema();
    obterWhatsappSaaS();
    carregarFaqDinamico(); // Carrega tópicos aprendidos pela IA do Firestore
    
    // Atualiza imediatamente o nome da empresa e logo na barra lateral a partir do cache/dados globais
    if (typeof aplicarIdentidadeVisualGlobal === 'function') {
        aplicarIdentidadeVisualGlobal();
    } else {
        const empNome = localStorage.getItem('fc_nome_empresa_ativa') || (window.currentEmpresaData && window.currentEmpresaData.nomeEmpresa) || 'Minha Loja';
        const elNome = document.getElementById('menu-empresa-nome');
        if (elNome) elNome.innerText = empNome;
    }
}

// Inicia tanto pelo listener do DOM quanto através do ciclo de sessão global do FC-Gestão
document.addEventListener('DOMContentLoaded', () => {
    inicializarTelaSuporte();
});

window.addEventListener('load', () => {
    if (typeof initGlobalData === 'function') {
        initGlobalData(inicializarTelaSuporte);
    } else {
        inicializarTelaSuporte();
    }
});

// Utilitário: normaliza texto removendo acentos para buscas mais inteligentes
function _normalizarTexto(t) {
    return (t || '').toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ').trim();
}

// Mapa de sinônimos para busca mais inteligente
const _SINONIMOS_BUSCA = {
    'puxar': 'ver acessar abrir',
    'chamar': 'abrir acessar ir',
    'relatorio': 'relatório dre extrato historico',
    'historico': 'histórico compras vendas registro',
    'cliente': 'comprador consumidor',
    'nota': 'nf nfe nfce fiscal',
    'fechar': 'encerrar finalizar',
    'caixa': 'pdv frente loja vendas',
    'entrar': 'dar entrada importar adicionar',
    'baixar': 'dar baixa quitar pagar receber',
    'contas': 'financeiro pagar receber',
    'funcionario': 'funcionário vendedor colaborador equipe',
    'usuario': 'usuário login acesso senha',
    'loja': 'site catalogo virtual online',
    'foto': 'imagem arquivo anexo',
    'bipe': 'leitor codigo barras scanner',
    'troco': 'suprimento abertura caixa',
    'cancelar': 'estornar devolver cancelamento',
    'parcela': 'parcelamento prazo crediario',
    'comissao': 'comissão vendedor percentual',
    'lucro': 'dre resultado financeiro',
};

function _expandirSinonimos(tokens) {
    const expandidos = new Set(tokens);
    tokens.forEach(t => {
        if (_SINONIMOS_BUSCA[t]) {
            _SINONIMOS_BUSCA[t].split(' ').forEach(s => expandidos.add(s));
        }
    });
    return [...expandidos];
}

function _getFaqCompleto() {
    return [...FAQ_FC_GESTAO, ...FAQ_DINAMICO];
}

function carregarCategorias() {
    const container = document.getElementById('container-categorias-faq');
    if (!container) return;

    const faqCompleto = _getFaqCompleto();
    const categorias = ['Todos', ...new Set(faqCompleto.map(f => f.categoria))];
    container.innerHTML = categorias.map(cat => {
        const ativa = cat === categoriaAtiva;
        const cls = ativa 
            ? 'bg-sky-500 text-white font-bold shadow-md shadow-sky-500/20' 
            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 font-semibold';
        return `<button onclick="selecionarCategoria('${cat}')" class="px-4 py-2 rounded-xl text-xs whitespace-nowrap transition-all ${cls}">${cat}</button>`;
    }).join('');
}

function selecionarCategoria(cat) {
    categoriaAtiva = cat;
    carregarCategorias();
    filtrarFaqSistema();
}

function filtrarFaqSistema() {
    const inputBusca = document.getElementById('campo-busca-faq');
    const busca = (inputBusca?.value || '').toLowerCase().trim();
    const buscaNorm = _normalizarTexto(busca);
    const btnLimpar = document.getElementById('btn-limpar-busca-faq');
    const container = document.getElementById('lista-respostas-faq');
    const contador = document.getElementById('contador-resultados-faq');

    if (btnLimpar) {
        btnLimpar.style.display = busca.length > 0 ? 'flex' : 'none';
    }

    if (!container) return;

    const faqCompleto = _getFaqCompleto();
    let itens = faqCompleto;

    if (categoriaAtiva !== 'Todos') {
        itens = itens.filter(i => i.categoria === categoriaAtiva);
    }

    if (buscaNorm) {
        const tokens = buscaNorm.split(/\s+/).filter(p => p.length >= 2);
        const tokensExpandidos = _expandirSinonimos(tokens);
        itens = itens.filter(i => {
            const textoCompleto = _normalizarTexto(i.pergunta + ' ' + i.resposta + ' ' + i.categoria);
            // Exige pelo menos um token match (não todos), mais flexível
            return tokens.some(p => textoCompleto.includes(p)) || 
                   tokensExpandidos.some(p => textoCompleto.includes(p));
        });
        // Ordena por relevância: mais matches primeiro, e IA aprendida fica no topo se match
        itens.sort((a, b) => {
            const textA = _normalizarTexto(a.pergunta + ' ' + a.categoria);
            const textB = _normalizarTexto(b.pergunta + ' ' + b.categoria);
            const scoreA = tokensExpandidos.filter(t => textA.includes(t)).length + (a.origem === 'ia' ? 2 : 0);
            const scoreB = tokensExpandidos.filter(t => textB.includes(t)).length + (b.origem === 'ia' ? 2 : 0);
            return scoreB - scoreA;
        });
    }

    if (contador) contador.textContent = `${itens.length} tópico${itens.length !== 1 ? 's' : ''} encontrado${itens.length !== 1 ? 's' : ''}`;

    if (itens.length === 0) {
        container.innerHTML = `
            <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-8 text-center">
                <i class="fa-solid fa-magnifying-glass text-3xl text-slate-400 mb-2"></i>
                <p class="font-bold text-slate-700 dark:text-slate-200 text-sm">Nenhum resultado para esta busca</p>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Pergunte para a IA ao lado ou chame no WhatsApp!</p>
            </div>
        `;
        return;
    }

    const highlight = (txt) => {
        if (!busca) return txt;
        const re = new RegExp(`(${buscaNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        return txt.replace(re, '<mark class="bg-amber-400/40 text-amber-900 dark:text-amber-200 px-0.5 rounded font-bold">$1</mark>');
    };

    container.innerHTML = itens.map(f => {
        const isIa = f.origem === 'ia';
        const iconColor = isIa ? 'bg-purple-950/50 border-purple-800 text-purple-400' : 'bg-sky-50 dark:bg-sky-950/50 border-sky-200 dark:border-sky-800 text-sky-600 dark:text-sky-400';
        const iconTag = isIa ? 'fa-robot' : 'fa-question';
        const badgeIa = isIa ? `<span style="position:absolute;top:0.75rem;right:0.75rem;font-size:9px;font-weight:800;letter-spacing:0.05em;text-transform:uppercase;background:rgba(168,85,247,0.15);color:#c084fc;border:1px solid rgba(168,85,247,0.3);padding:2px 7px;border-radius:9999px;display:inline-flex;align-items:center;gap:4px;"><i class="fa-solid fa-robot" style="font-size:8px;"></i> IA</span>` : '';
        return `
        <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden transition-all hover:border-sky-400/50" style="position:relative;">
            ${badgeIa}
            <button onclick="toggleFaq('${f.id}')" class="w-full text-left p-4 md:p-5 flex items-start gap-3.5" style="padding-right:${isIa ? '4.5rem' : '1.25rem'}">
                <div class="w-7 h-7 rounded-lg ${iconColor} flex items-center justify-center text-xs shrink-0 mt-0.5" style="border-width:1px;border-style:solid;">
                    <i class="fa-solid ${iconTag}"></i>
                </div>
                <div class="flex-1">
                    <span class="text-[10px] font-extrabold uppercase text-sky-500 tracking-wider">${f.categoria}</span>
                    <h5 class="text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5">${highlight(f.pergunta)}</h5>
                </div>
                <i class="fa-solid fa-chevron-down text-slate-400 text-xs shrink-0 mt-1.5 transition-transform" id="chev-${f.id}"></i>
            </button>
            <div id="content-${f.id}" class="hidden px-5 pb-5 pt-0">
                <div class="border-t border-slate-100 dark:border-slate-700/80 pt-3 pl-10 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                    ${f.resposta}
                    ${isIa ? '<p style="margin-top:0.75rem;font-size:9px;color:#64748b;display:flex;align-items:center;gap:4px;"><i class="fa-solid fa-robot" style="color:#a855f7;"></i> Tópico aprendido pela IA com base em dúvidas reais dos usuários</p>' : ''}
                </div>
            </div>
        </div>
    `}).join('');
}


function toggleFaq(id) {
    const el = document.getElementById(`content-${id}`);
    const chev = document.getElementById(`chev-${id}`);
    if (!el) return;
    const open = !el.classList.contains('hidden');
    el.classList.toggle('hidden');
    if (chev) chev.style.transform = open ? '' : 'rotate(180deg)';
}

async function obterWhatsappSaaS() {
    // 1. Tenta carregar do cache da licença SaaS já carregada pelo saas_licenca.js
    try {
        if (window.currentSaaSLicense && window.currentSaaSLicense.whatsappFundador) {
            const raw = String(window.currentSaaSLicense.whatsappFundador).replace(/\D/g, '');
            if (raw.length >= 10) numeroWhatsappFundador = raw.startsWith('55') ? raw : '55' + raw;
        }
    } catch(e) {}

    // 2. Consulta diretamente o banco central do SaaS (fcgestao-testes)
    try {
        let saasApp = firebase.apps.find(a => a.name === 'saasSuporteDb');
        if (!saasApp && window.SAAS_CONFIG) {
            saasApp = firebase.initializeApp(window.SAAS_CONFIG, 'saasSuporteDb');
        }
        if (saasApp) {
            _saasAppSuporte = saasApp; // Reutilizado em carregarFaqDinamico e salvarRespostaIaComoFaq
            const dbCentral = saasApp.firestore();
            
            // 1. Tenta buscar em sistemas_saas/fc_gestao (permissão pública liberada nas regras)
            try {
                const snapSis = await dbCentral.collection('sistemas_saas').doc('fc_gestao').get();
                if (snapSis.exists && snapSis.data().whatsappSuporte) {
                    const raw = String(snapSis.data().whatsappSuporte).replace(/\D/g, '');
                    if (raw.length >= 10) {
                        numeroWhatsappFundador = raw.startsWith('55') ? raw : '55' + raw;
                    }
                }
            } catch(e) {}

            // 2. Tenta buscar em saas_config/fundador
            try {
                const snapFund = await dbCentral.collection('saas_config').doc('fundador').get();
                if (snapFund.exists && snapFund.data().whatsapp) {
                    const raw = String(snapFund.data().whatsapp).replace(/\D/g, '');
                    if (raw.length >= 10) {
                        numeroWhatsappFundador = raw.startsWith('55') ? raw : '55' + raw;
                    }
                }
            } catch(e) {}

            // Busca chave do Gemini
            try {
                const snapMaster = await dbCentral.collection('saas_config').doc('master').get();
                if (snapMaster.exists && snapMaster.data().geminiKeyMaster) {
                    chaveGeminiMaster = snapMaster.data().geminiKeyMaster;
                } else {
                    const snapGem = await dbCentral.collection('saas_config').doc('gemini_config').get();
                    if (snapGem.exists && snapGem.data().geminiKeyMaster) {
                        chaveGeminiMaster = snapGem.data().geminiKeyMaster;
                    }
                }
            } catch(e) {}
        }
    } catch (err) {
        console.warn('Configuração central:', err.message);
    }

    // Atualiza o rodapé visual com o número formatado
    const infoEl = document.getElementById('info-whatsapp-numero');
    if (infoEl) {
        const f = numeroWhatsappFundador.replace(/^55/, '');
        const formatted = f.replace(/(\d{2})(\d{4,5})(\d{4})/, '($1) $2-$3');
        infoEl.innerHTML = `<i class="fa-solid fa-shield-halved text-emerald-400"></i> WhatsApp do SaaS: +55 ${formatted}`;
    }
}

function abrirWhatsAppSuporte(assunto = '') {
    const empresaNome = (window.currentEmpresaData && window.currentEmpresaData.nome) || 'Minha Loja';
    const texto = encodeURIComponent(`Olá! Preciso de suporte com o sistema FC Gestão (${empresaNome}). ${assunto ? '\nAssunto: ' + assunto : ''}`);
    window.open(`https://wa.me/${numeroWhatsappFundador}?text=${texto}`, '_blank');
}

// -----------------------------------------------------------------------
// BUSCA INTELIGENTE NO FAQ (usa FAQ_FC_GESTAO + FAQ_DINAMICO)
// -----------------------------------------------------------------------
function buscarMelhorRespostaNoFaq(pergunta) {
    const pNorm = _normalizarTexto(pergunta);
    
    const stopWords = new Set(['como', 'faco', 'faca', 'para', 'onde', 'meu', 'minha', 'meus', 'minhas',
        'que', 'qual', 'quais', 'uma', 'uns', 'umas', 'com', 'sem', 'por', 'pra',
        'consigo', 'posso', 'quero', 'esta', 'esse', 'essa', 'dentro', 'sistema', 'site',
        'preciso', 'queria', 'tem', 'nao', 'nao', 'minha', 'tenho', 'vai', 'tem']);

    const tokens = pNorm.split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));
    const tokensExpandidos = _expandirSinonimos(tokens);

    let melhorItem = null;
    let melhorPontuacao = 0;

    _getFaqCompleto().forEach(item => {
        let pontos = 0;
        const textoPergNorm = _normalizarTexto(item.pergunta);
        const textoRespNorm = _normalizarTexto(item.resposta);
        const categNorm = _normalizarTexto(item.categoria);

        // Pontuação por tokens normais + expandidos
        tokensExpandidos.forEach(tok => {
            if (textoPergNorm.includes(tok)) pontos += 7;
            if (categNorm.includes(tok)) pontos += 3;
            if (textoRespNorm.includes(tok)) pontos += 1;
        });

        // Bonificações contextuais precisas
        if (tokens.some(t => ['foto', 'imagem', 'anexo', 'arquivo'].some(k => t.includes(k))) && item.id === 'faq_produtos_foto') pontos += 35;
        if (tokens.some(t => ['venda', 'pdv', 'balcao', 'cupom', 'vender'].some(k => t.includes(k))) && !tokens.some(t => t.includes('cancel')) && item.id === 'faq_pdv_venda') pontos += 20;
        if (tokens.some(t => ['sangria', 'suprimento', 'troco', 'gaveta', 'abertura'].some(k => t.includes(k))) && item.id === 'faq_pdv_sangria') pontos += 30;
        if (tokens.some(t => ['fechar', 'fechamento', 'encerrar'].some(k => t.includes(k))) && item.id === 'faq_fechamento_caixa') pontos += 30;
        if (tokens.some(t => ['cancel', 'estorn', 'devolver'].some(k => t.includes(k))) && item.id === 'faq_cancelar_venda') pontos += 30;
        if (tokens.some(t => ['fiscal', 'nfce', 'nfe', 'nota', 'danfe'].some(k => t.includes(k))) && item.id === 'faq_fiscal_nfe') pontos += 25;
        if (tokens.some(t => ['nfse', 'servico', 'serviço', 'rps', 'goiania', 'goiânia', 'prefeitura'].some(k => t.includes(k))) && item.id === 'faq_fiscal_nfse') pontos += 35;
        if (tokens.some(t => ['xml', 'fornecedor', 'compra', 'entrada'].some(k => t.includes(k))) && item.id === 'faq_compras_xml') pontos += 25;
        if (tokens.some(t => ['relator', 'dre', 'lucro', 'resultado'].some(k => t.includes(k))) && item.id === 'faq_dre_lucro') pontos += 25;
        if (tokens.some(t => ['comissao', 'comiss', 'vendedor'].some(k => t.includes(k))) && item.id === 'faq_comissoes') pontos += 25;
        if (tokens.some(t => ['historico', 'compras', 'extrato'].some(k => t.includes(k))) && (item.id === 'faq_dre_lucro' || item.id === 'faq_financeiro_contas')) pontos += 20;
        if (tokens.some(t => ['certificado', 'a1', 'pfx', 'senha'].some(k => t.includes(k))) && item.id === 'faq_fiscal_certificado') pontos += 30;
        if (tokens.some(t => ['impressora', 'bobina', 'termica', '58mm', '80mm'].some(k => t.includes(k))) && item.id === 'faq_impressora_termica') pontos += 35;
        if (tokens.some(t => ['loja', 'virtual', 'site', 'catalogo', 'link'].some(k => t.includes(k))) && item.id === 'faq_loja_virtual_link') pontos += 25;
        if (tokens.some(t => ['funcionario', 'vendedor', 'login', 'usuario', 'acesso'].some(k => t.includes(k))) && item.id === 'faq_usuarios_equipe') pontos += 25;
        if (tokens.some(t => ['mensalidade', 'plano', 'renovar', 'assinatura', 'pagar'].some(k => t.includes(k))) && item.id === 'faq_plano_renovacao') pontos += 30;

        // Bônus extra para itens aprendidos pela IA (foram validados por perguntas reais)
        if (item.origem === 'ia' && pontos > 0) pontos += 5;

        if (pontos > melhorPontuacao) {
            melhorPontuacao = pontos;
            melhorItem = item;
        }
    });

    return melhorPontuacao >= 5 ? melhorItem : null;
}

// -----------------------------------------------------------------------
// FAQ DINÂMICO — CARREGAR DO FIRESTORE
// -----------------------------------------------------------------------
async function carregarFaqDinamico() {
    if (_faqDinamicoCarregado) return;
    try {
        let db = null;
        let saasApp = _saasAppSuporte || firebase.apps.find(a => a.name === 'saasSuporteDb');
        if (!saasApp && window.SAAS_CONFIG) {
            try { saasApp = firebase.initializeApp(window.SAAS_CONFIG, 'saasSuporteDb'); } catch(e){}
        }
        if (saasApp) {
            _saasAppSuporte = saasApp;
            db = saasApp.firestore();
        } else if (typeof firebase !== 'undefined' && firebase.firestore) {
            db = firebase.firestore();
        }

        if (!db) return;

        let snap = null;
        try {
            snap = await db.collection('faq_dinamico').orderBy('criadoEm', 'desc').limit(200).get();
        } catch(e) {
            // Caso falte índice de ordenação, faz busca simples
            snap = await db.collection('faq_dinamico').limit(200).get();
        }

        if (!snap || snap.empty) return;

        const novos = [];
        const idsExistentes = new Set(FAQ_FC_GESTAO.map(f => f.id));

        snap.forEach(doc => {
            const d = doc.data();
            if (!d.pergunta || !d.resposta) return;
            if (idsExistentes.has(doc.id)) return;
            novos.push({
                id: doc.id,
                categoria: d.categoria || 'Outros',
                pergunta: d.pergunta,
                resposta: d.resposta,
                origem: 'ia',
                criadoEm: d.criadoEm
            });
        });

        FAQ_DINAMICO = novos;
        _faqDinamicoCarregado = true;

        // Atualiza as categorias e a lista com os novos tópicos
        carregarCategorias();
        filtrarFaqSistema();
    } catch(err) {
        console.warn('[FAQ Dinâmico] Erro ao carregar:', err.message);
    }
}

// -----------------------------------------------------------------------
// FAQ DINÂMICO — SALVAR RESPOSTA DA IA NO FIRESTORE
// -----------------------------------------------------------------------
async function salvarRespostaIaComoFaq(pergunta, respostaTexto, categoriaDetectada) {
    try {
        // Validações de segurança antes de salvar
        if (!pergunta || !respostaTexto) return;
        const limpa = respostaTexto.replace(/<[^>]*>/g, '').trim();
        if (limpa.length < 60) return; // Resposta muito curta
        if (/cpf|cnpj|senha|telefone|\d{3}\.\d{3}|\d{11}/i.test(pergunta)) return; // Contém dados pessoais

        let db = null;
        let saasApp = _saasAppSuporte || firebase.apps.find(a => a.name === 'saasSuporteDb');
        if (!saasApp && window.SAAS_CONFIG) {
            try { saasApp = firebase.initializeApp(window.SAAS_CONFIG, 'saasSuporteDb'); } catch(e){}
        }
        if (saasApp) {
            _saasAppSuporte = saasApp;
            db = saasApp.firestore();
        } else if (typeof firebase !== 'undefined' && firebase.firestore) {
            db = firebase.firestore();
        }

        if (!db) return;

        // Gera ID seguro e legível para o documento (evita duplicatas)
        const hashPergunta = 'faq_ia_' + encodeURIComponent(pergunta.toLowerCase().trim().substring(0, 40))
            .replace(/[^a-zA-Z0-9]/g, '_').substring(0, 45);

        // Verifica se já existe
        const docRef = db.collection('faq_dinamico').doc(hashPergunta);
        try {
            const existing = await docRef.get();
            if (existing && existing.exists) return; // Já salvo anteriormente
        } catch(e){}

        // Detecta categoria automaticamente pela pergunta
        const catMap = [
            { keys: ['cliente', 'consumidor', 'cadastro cliente'], cat: 'Clientes & Cadastros' },
            { keys: ['produto', 'estoque', 'foto', 'imagem', 'xml', 'fornecedor', 'grade', 'variacao', 'inventario'], cat: 'Produtos & Estoque' },
            { keys: ['pdv', 'venda', 'caixa', 'sangria', 'suprimento', 'cupom', 'impressora', 'fechar', 'troco'], cat: 'Frente de Caixa (PDV)' },
            { keys: ['nota', 'nfe', 'nfce', 'fiscal', 'danfe', 'sefaz', 'certificado'], cat: 'Fiscal (NF-e/NFC-e)' },
            { keys: ['financeiro', 'conta', 'pagar', 'receber', 'lucro', 'dre', 'comissao', 'despesa', 'parcela', 'fiado'], cat: 'Financeiro' },
            { keys: ['loja', 'virtual', 'site', 'catalogo', 'link', 'instagram', 'pedido'], cat: 'Loja Virtual' },
            { keys: ['funcionario', 'vendedor', 'usuario', 'login', 'senha', 'equipe', 'acesso', 'plano', 'mensalidade'], cat: 'Sistema & Acessos' },
        ];
        const pNorm = _normalizarTexto(pergunta);
        let catFinal = categoriaDetectada || 'Outros';
        for (const entry of catMap) {
            if (entry.keys.some(k => pNorm.includes(k))) {
                catFinal = entry.cat;
                break;
            }
        }

        // Formata resposta para HTML legível
        const respostaHtml = respostaTexto
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n/g, '<br>');

        await docRef.set({
            pergunta: pergunta.trim(),
            resposta: respostaHtml,
            categoria: catFinal,
            origem: 'ia',
            criadoEm: firebase.firestore.FieldValue ? firebase.firestore.FieldValue.serverTimestamp() : new Date(),
            totalVisualizacoes: 0
        });

        // Adiciona imediatamente à lista local (sem precisar recarregar)
        const novoItem = {
            id: hashPergunta,
            categoria: catFinal,
            pergunta: pergunta.trim(),
            resposta: respostaHtml,
            origem: 'ia'
        };
        FAQ_DINAMICO.unshift(novoItem);
        carregarCategorias();
        filtrarFaqSistema();

        console.info('[FAQ Dinâmico] Tópico salvo:', hashPergunta);
    } catch(err) {
        console.warn('[FAQ Dinâmico] Erro ao salvar:', err.message);
    }
}



async function perguntarIaSuporte(e) {
    if (e) e.preventDefault();
    const input = document.getElementById('ia-chat-input');
    const container = document.getElementById('ia-chat-mensagens');
    const btn = document.getElementById('btn-enviar-ia');
    if (!input || !container) return;

    const pergunta = input.value.trim();
    if (!pergunta) return;

    input.value = '';
    input.disabled = true;
    if (btn) btn.disabled = true;

    container.innerHTML += `
        <div class="flex gap-2.5 items-start justify-end">
            <div class="bg-sky-600 text-white rounded-2xl rounded-tr-none p-3 max-w-[85%] leading-relaxed shadow-sm">
                ${pergunta.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
            </div>
            <div class="w-7 h-7 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center text-xs shrink-0 mt-0.5">
                <i class="fa-solid fa-user"></i>
            </div>
        </div>
    `;

    const loadingId = 'ia-loading-' + Date.now();
    container.innerHTML += `
        <div class="flex gap-2.5 items-start" id="${loadingId}">
            <div class="w-7 h-7 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center text-xs shrink-0 mt-0.5">
                <i class="fa-solid fa-robot"></i>
            </div>
            <div class="bg-slate-800 border border-slate-700/80 rounded-2xl rounded-tl-none p-3 shadow-sm flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full bg-purple-400 animate-bounce" style="animation-delay:0ms"></span>
                <span class="w-2 h-2 rounded-full bg-purple-400 animate-bounce" style="animation-delay:150ms"></span>
                <span class="w-2 h-2 rounded-full bg-purple-400 animate-bounce" style="animation-delay:300ms"></span>
            </div>
        </div>
    `;
    container.scrollTop = container.scrollHeight;

    try {
        let apiKey = chaveGeminiMaster;
        if (!apiKey && window.currentEmpresaData && window.currentEmpresaData.geminiKey) {
            apiKey = window.currentEmpresaData.geminiKey;
        }

        let respostaTexto = '';

        if (apiKey && apiKey.length > 10) {
            const contextoSistema = `Você é o assistente virtual especialista e suporte oficial do sistema ERP e PDV comercial "FC Gestão".
Seu papel é EXCLUSIVAMENTE ORIENTAR E GUIAR o usuário sobre como operar o sistema passo a passo: indicando os menus, botões, abas e telas exatas.

IMPORTANTE SOBRE PRIVACIDADE E RELATÓRIOS:
- Você NUNCA gera dados de relatórios fictícios nem expõe informações privadas de vendas ou clientes da loja.
- Quando o usuário pedir "puxar relatório", "ver extrato" ou "consultar histórico", oriente-o com clareza sobre onde clicar no sistema para emitir ou visualizar esse relatório.

MAPA DE MENUS E OPERAÇÕES DO SISTEMA:

1. CLIENTES & CADASTROS:
   - "Puxar relatório de um cliente" ou "Ver histórico de compras do cliente":
     * Opção A (Compras do cliente): Menu 'Gestão de Vendas' -> no campo 'Buscar Cliente ou Pedido...' digite o nome do cliente -> selecione o período (ex: 'Histórico Completo') -> o sistema lista todos os pedidos feitos por ele, produtos comprados, valores, datas e botão de reimprimir/reenviar comprovante.
     * Opção B (Exportar lista geral de clientes): Menu 'Clientes' -> no topo da tela clique no botão 'Puxar: Excel', 'Word' ou 'PDF' para baixar a relação completa de clientes com telefones e endereços.
     * Opção C (Débitos/Fiado): Menu 'Contas a Pagar/Receber' -> filtrar por cliente para ver parcelas pendentes ou quitar débitos.
   - Cadastrar cliente: Menu 'Clientes' -> botão '+ Novo Cliente' -> preencher nome, CPF/CNPJ, WhatsApp, CEP e endereço -> Salvar.

2. GESTÃO DE VENDAS & COMPROVANTES:
   - Consultar vendas passadas: Menu 'Gestão de Vendas' -> filtrar por período (Hoje, Este Mês, Histórico Completo) ou pesquisar por cliente/pedido.
   - Reimprimir cupom ou 2ª via: Em 'Gestão de Vendas' -> clicar no ícone de impressora na linha da venda.
   - Reenviar comprovante no WhatsApp: Em 'Gestão de Vendas' -> clicar no ícone do WhatsApp.
   - Cancelar venda: Em 'Gestão de Vendas' -> clicar no botão de opções da venda -> 'Cancelar Venda' (o sistema devolve o item ao estoque e estorna o caixa).

3. PRODUTOS & ESTOQUE:
   - Colocar foto no produto: Menu 'Produtos & Estoque' -> clicar no botão Editar (lápis) do produto ou '+ Novo Produto' -> seção 'Fotos / Imagens do Produto' -> clicar em Escolher Arquivo ou colar link da imagem -> Salvar Produto. As fotos aparecem na Loja Virtual e no PDV.
   - Cadastro geral: Nome, Categoria, Código de Barras (EAN), Preço de Custo, Preço de Venda, Estoque Atual e Mínimo.
   - Variações: Cor, Tamanho, Madeira e Tecido (para personalização).
   - Entrada por XML de fornecedor: Menu 'Compras & NF-e XML' -> Importar XML -> estoque somado e contas geradas no Financeiro.
   - Ajustar estoque manual: Em 'Produtos & Estoque' -> Ajustar Estoque.

4. FRENTE DE CAIXA (PDV):
   - Realizar venda rápida: Menu 'Frente de Loja / PDV' -> bipar código de barras ou digitar nome -> selecionar vendedor e cliente -> clicar em Finalizar Venda (F2) -> escolher Dinheiro, PIX, Cartões ou Crediário -> imprimir cupom térmico (58mm/80mm) ou enviar no WhatsApp.
   - Sangria e Suprimento: No PDV ou 'Caixa Físico' -> botão 'Movimentação de Caixa' -> Suprimento para troco inicial ou Sangria para retirada segura de dinheiro da gaveta.
   - Fechamento de Caixa: Menu 'Caixa Físico' -> 'Fechar Caixa' -> conferir resumo por Dinheiro, PIX e Cartões.
   - Impressora térmica: Em 'Configurações' -> seção 'Impressão & Cupom' -> selecionar 58mm ou 80mm.

5. FISCAL:
   - Emissão de NF-e (mod. 55) e NFC-e (mod. 65): Menu 'Emissor Fiscal NF-e/NFC-e' -> gerar a partir de venda existente ou avulsa -> validar dados e tributos (NCM, CFOP 5102, ICMS) -> Transmitir para SEFAZ (nacional para todos os estados).
   - Emissão de NFS-e (Serviços): Habilitada em 'Configurações' -> aba Fiscal. Para Goiânia/GO, possui integração direta via Web Service com a SEFIN/Prefeitura com botão de copiar modelo de e-mail de liberação. Para outros municípios, opera em modo RPS Oficial / Espelho Fiscal Municipal para escrituração local.
   - Certificado Digital: Em 'Configurações' -> Dados Fiscais -> carregar Certificado A1 (.pfx) e senha.

6. FINANCEIRO & DRE:
   - Contas a Pagar e Receber: Menu 'Contas a Pagar/Receber' -> '+ Nova Conta' com parcelamento -> dar baixa clicando no check.
   - Lucro Real e DRE: Menu 'Relatórios & DRE' -> Demonstrativo de Resultado com Vendas Brutas, Custos (CPV), Despesas e Lucro Líquido Real.
   - Comissões de Vendedores: Menu 'Relatórios & DRE' -> aba Comissão Detalhada por Vendedor.

7. LOJA VIRTUAL:
   - Menu 'Minha Loja Virtual': Catálogo online dos produtos com link público para colocar no Instagram e pedidos que chegam prontos no WhatsApp do lojista.

REGRAS DE RESPOSTA:
- Seja direto, educado e use tópicos com negrito e passos numerados.
- Se a dúvida for sobre renovação de plano, pagamento de mensalidade ou suporte urgente, direcione para o botão 'Chamar no WhatsApp'.
- Sempre especifique os NOMES EXATOS dos menus para que o usuário ache na hora.`;

            historicoChatIa.push({ role: 'user', parts: [{ text: pergunta }] });

            const modelos = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro'];

            for (const mod of modelos) {
                try {
                    const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${mod}:generateContent?key=${apiKey}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            system_instruction: { parts: [{ text: contextoSistema }] },
                            contents: historicoChatIa
                        })
                    });

                    if (resp.ok) {
                        const data = await resp.json();
                        respostaTexto = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
                        if (respostaTexto) {
                            historicoChatIa.push({ role: 'model', parts: [{ text: respostaTexto }] });
                            
                            // Salva a resposta no Firestore para compor as Respostas Rápidas de todas as contas
                            salvarRespostaIaComoFaq(pergunta, respostaTexto);
                            
                            // Adiciona aviso visual amigável de aprendizado
                            respostaTexto += `\n\n*(💡 Essa resposta foi salva nas Respostas Rápidas para todas as contas do sistema)*`;
                            break;
                        }
                    }
                } catch (e) {
                    console.warn(`Tentativa com ${mod} falhou:`, e.message);
                }
            }
        }

        if (!respostaTexto) {
            const melhorFaq = buscarMelhorRespostaNoFaq(pergunta);

            if (melhorFaq) {
                respostaTexto = `<strong>${melhorFaq.pergunta}</strong><br><br>${melhorFaq.resposta}<br><br><span class="text-slate-400">💡 Essa resposta te ajudou? Se precisar de mais detalhes, você também pode clicar no botão <strong>Chamar no WhatsApp</strong> aqui ao lado!</span>`;
            } else {
                respostaTexto = `Não encontrei um tópico exato para sua pergunta no manual rápido.<br><br>
                Você pode:
                <ul class="list-disc list-inside mt-2 space-y-1">
                    <li>Verificar a lista de <strong>Respostas Rápidas</strong> ao lado filtrando por categorias (<em>Produtos, Clientes, PDV, Fiscal, Financeiro</em>).</li>
                    <li>Falar agora mesmo com nosso atendimento humano clicando no botão verde <strong>Chamar no WhatsApp</strong>!</li>
                </ul>`;
            }
        }

        const loadEl = document.getElementById(loadingId);
        if (loadEl) loadEl.remove();

        const formatado = respostaTexto
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n/g, '<br>');

        container.innerHTML += `
            <div class="flex gap-2.5 items-start">
                <div class="w-7 h-7 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center text-xs shrink-0 mt-0.5">
                    <i class="fa-solid fa-robot"></i>
                </div>
                <div class="bg-slate-800/90 text-slate-200 border border-slate-700/80 rounded-2xl rounded-tl-none p-3 max-w-[85%] leading-relaxed shadow-sm">
                    ${formatado}
                </div>
            </div>
        `;

    } catch (err) {
        const loadEl = document.getElementById(loadingId);
        if (loadEl) loadEl.remove();
        container.innerHTML += `
            <div class="bg-red-900/30 text-red-300 border border-red-700/50 p-3 rounded-xl text-xs">
                Ocorreu uma instabilidade na consulta. Você pode pesquisar nos tópicos ao lado ou chamar no WhatsApp!
            </div>
        `;
    } finally {
        input.disabled = false;
        if (btn) btn.disabled = false;
        input.focus();
        container.scrollTop = container.scrollHeight;
    }
}

function limparBuscaFaq() {
    const input = document.getElementById('campo-busca-faq');
    if (input) {
        input.value = '';
        input.focus();
        filtrarFaqSistema();
    }
}

window.selecionarCategoria = selecionarCategoria;
window.filtrarFaqSistema = filtrarFaqSistema;
window.limparBuscaFaq = limparBuscaFaq;
window.toggleFaq = toggleFaq;
window.abrirWhatsAppSuporte = abrirWhatsAppSuporte;
window.perguntarIaSuporte = perguntarIaSuporte;
