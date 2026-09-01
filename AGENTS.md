# 📜 DIRETRIZES DE DESENVOLVIMENTO E REGRAS DO SISTEMA (FC-Gestão)

> **ATENÇÃO AO ANTIGRAVITY / AGENTE:**  
> Este documento é de leitura obrigatória antes de qualquer alteração, refatoração ou criação de código neste repositório. Siga rigorosamente todas as regras e padrões abaixo.

---

## 🏛️ 1. Visão Geral da Arquitetura

- **Frontend / UI:** HTML5 semântico, Tailwind CSS (classes utilitárias) e FontAwesome para ícones.
- **Lógica e Dinâmica:** JavaScript Vanilla (ES6+), modularizado por página/recurso.
- **Backend / Database:** Firebase (Firestore, Authentication, Hosting, Functions).
- **Modos de Operação do Banco:**
  - O arquivo [`sistema/config_banco.js`](file:///g:/VERSOES%20DO%20SISTEMA/site%20sistema/FC-Gest-o/sistema/config_banco.js) define a flag `MODO_TESTES`.
  - **`MODO_TESTES = true`**: Banco de Testes/Homologação (`fcgestao-testes`).
  - **`MODO_TESTES = false`**: Banco Oficial/Produção (`lojafc-a31f9`).

---

## 📌 2. Páginas e Arquivos Chave (Consultar antes de mexer)

Antes de alterar qualquer funcionalidade, consulte o arquivo correspondente:

1. **Gestão do Site / Loja Online:**
   - Interface / Configurações: [`gestao_site.html`](file:///g:/VERSOES%20DO%20SISTEMA/site%20sistema/FC-Gest-o/gestao_site.html)
   - Lógica do Site: [`site/`](file:///g:/VERSOES%20DO%20SISTEMA/site%20sistema/FC-Gest-o/site) e [`gestao_v2.js`](file:///g:/VERSOES%20DO%20SISTEMA/site%20sistema/FC-Gest-o/sistema/gestao_v2.js)
2. **Módulos do Sistema (`/sistema`):**
   - **Configuração de Banco:** [`sistema/config_banco.js`](file:///g:/VERSOES%20DO%20SISTEMA/site%20sistema/FC-Gest-o/sistema/config_banco.js)
   - **PDV / Caixa:** [`sistema/pdv.html`](file:///g:/VERSOES%20DO%20SISTEMA/site%20sistema/FC-Gest-o/sistema/pdv.html), [`sistema/caixa.html`](file:///g:/VERSOES%20DO%20SISTEMA/site%20sistema/FC-Gest-o/sistema/caixa.html), [`sistema/pdv.js`](file:///g:/VERSOES%20DO%20SISTEMA/site%20sistema/FC-Gest-o/sistema/pdv.js), [`sistema/caixa.js`](file:///g:/VERSOES%20DO%20SISTEMA/site%20sistema/FC-Gest-o/sistema/caixa.js)
   - **Estoque & Produtos:** [`sistema/estoque.html`](file:///g:/VERSOES%20DO%20SISTEMA/site%20sistema/FC-Gest-o/sistema/estoque.html), [`sistema/produtos.html`](file:///g:/VERSOES%20DO%20SISTEMA/site%20sistema/FC-Gest-o/sistema/produtos.html), [`sistema/estoque.js`](file:///g:/VERSOES%20DO%20SISTEMA/site%20sistema/FC-Gest-o/sistema/estoque.js), [`sistema/produtos.js`](file:///g:/VERSOES%20DO%20SISTEMA/site%20sistema/FC-Gest-o/sistema/produtos.js)
   - **Clientes & Fornecedores:** [`sistema/clientes.html`](file:///g:/VERSOES%20DO%20SISTEMA/site%20sistema/FC-Gest-o/sistema/clientes.html), [`sistema/clientes.js`](file:///g:/VERSOES%20DO%20SISTEMA/site%20sistema/FC-Gest-o/sistema/clientes.js), [`sistema/fornecedores.html`](file:///g:/VERSOES%20DO%20SISTEMA/site%20sistema/FC-Gest-o/sistema/fornecedores.html)
   - **Vendas & Gestão:** [`sistema/vendas_gestao.html`](file:///g:/VERSOES%20DO%20SISTEMA/site%20sistema/FC-Gest-o/sistema/vendas_gestao.html), [`sistema/vendas_gestao.js`](file:///g:/VERSOES%20DO%20SISTEMA/site%20sistema/FC-Gest-o/sistema/vendas_gestao.js)
   - **Financeiro & Relatórios:** [`sistema/financeiro.html`](file:///g:/VERSOES%20DO%20SISTEMA/site%20sistema/FC-Gest-o/sistema/financeiro.html), [`sistema/financeiro.js`](file:///g:/VERSOES%20DO%20SISTEMA/site%20sistema/FC-Gest-o/sistema/financeiro.js), [`sistema/relatorios.html`](file:///g:/VERSOES%20DO%20SISTEMA/site%20sistema/FC-Gest-o/sistema/relatorios.html), [`sistema/relatorios_v2.js`](file:///g:/VERSOES%20DO%20SISTEMA/site%20sistema/FC-Gest-o/sistema/relatorios_v2.js)
3. **Scripts Globais e Service Worker:**
   - [`global.js`](file:///g:/VERSOES%20DO%20SISTEMA/site%20sistema/FC-Gest-o/global.js)
   - [`sw.js`](file:///g:/VERSOES%20DO%20SISTEMA/site%20sistema/FC-Gest-o/sw.js)
   - [`firestore.rules`](file:///g:/VERSOES%20DO%20SISTEMA/site%20sistema/FC-Gest-o/firestore.rules)

---

## ⚙️ 3. Regras Estritas de Execução

### A. Preservação de Integridade
- **Nunca remova IDs ou Classes existentes** de inputs, botões ou modais sem garantir que nenhum script (`.js`) dependa deles.
- **Não quebre o Dark Mode:** Mantenha sempre a compatibilidade com classes `dark:` do Tailwind nos elementos HTML.
- **Preserve Comentários e Estrutura:** Não delete blocos comentados informativos.

### B. Manipulação de Banco de Dados (Firestore)
- **Nunca sobrescreva credenciais ou a lógica de alternância** em [`sistema/config_banco.js`](file:///g:/VERSOES%20DO%20SISTEMA/site%20sistema/FC-Gest-o/sistema/config_banco.js).
- **Transações e Lotes:** Para operações que envolvam estoque, caixa ou financeiro simultaneamente, garanta consistência nas escritas do Firestore.
- **Tratamento de Erros:** Todas as chamadas assíncronas do Firebase (`async/await`) devem conter blocos `try/catch` com feedback visual/notificação ao usuário.

### C. Padrão Visual e UX
- Manter o padrão visual limpo, moderno, com bordas arredondadas (`rounded-lg`, `rounded-xl`), sombras suaves (`shadow-sm`, `shadow-md`), e paleta consistente (Slate, Emerald, Blue).
- Feedback ao usuário em ações assíncronas (loaders, toasts/notificações de sucesso/erro).
- **Responsividade Obrigatória**: Todos os componentes devem se adaptar de forma fluida para celulares (telas pequenas), tablets e computadores usando as classes responsivas do Tailwind (`sm:`, `md:`, `lg:`). Grids devem se reorganizar e tabelas devem permitir rolagem (`overflow-x-auto`) sem quebrar o layout.

### D. Verificação Pós-Edição
- Após modificar arquivos JavaScript, garanta que a sintaxe seja válida e não contenha referências a variáveis não declaradas.
- Ao adicionar novas páginas ou rotas, verificar se o Service Worker ([`sw.js`](file:///g:/VERSOES%20DO%20SISTEMA/site%20sistema/FC-Gest-o/sw.js)) ou manifesto precisam de atualização de cache.

### E. Princípio de Ouro: "Não Quebre o Que Funciona"
- **NUNCA altere, substitua ou delete** blocos de código (HTML ou JS) que já foram criados e estão funcionando, a menos que o usuário ordene explicitamente a correção de um erro neles.
- O foco deve ser sempre em **MELHORAR** ou **ADICIONAR**. Crie novas funções, novos estilos ou novas seções em vez de modificar destrutivamente a lógica existente.
- Se precisar integrar código novo ao antigo, faça-o de forma não-invasiva, preservando perfeitamente o comportamento anterior.

---

## 🚀 4. Como o Antigravity deve agir a cada solicitação

1. **Localizar e Ler:** Identificar os arquivos HTML/JS envolvidos antes de gerar código.
2. **Respeitar os Padrões Existentes:** Seguir a nomenclatura de IDs, variáveis e estilos já em uso.
3. **Edições Cirúrgicas:** Fazer substituições pontuais e precisas, evitando reescrever arquivos inteiros desnecessariamente.
4. **Resumo Claro:** Explicar sucintamente as alterações efetuadas.
