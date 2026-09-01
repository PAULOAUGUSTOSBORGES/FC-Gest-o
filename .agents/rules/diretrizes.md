# 📋 Regras de Execução e Qualidade de Código

## 1. Regras de Edição de Código
- Antes de editar qualquer arquivo `.html` ou `.js`, sempre leia e verifique os arquivos dependentes.
- Preserve sempre os IDs dos elementos HTML e os nomes de variáveis globais.
- Mantenha suporte total ao **Dark Mode** (classes `dark:`).
- Não altere a lógica de alternância de banco em `sistema/config_banco.js`.

## 2. Padrões de Interface
- Ícones: FontAwesome (`fa-solid`, etc.).
- Cores: Paleta Tailwind Slate com acentos em Emerald/Blue.
- Feedback visual para ações assíncronas (toasts, loading spinners).
- **Responsividade Obrigatória**: Todos os layouts devem ser fluidos e se adaptar perfeitamente a Mobile, Tablets e Desktops. Utilize classes Tailwind responsivas (`sm:`, `md:`, `lg:`, `xl:`) garantindo que tabelas possam rolar horizontalmente (`overflow-x-auto`) em telas pequenas, e grids se reestruturem (ex: `grid-cols-1 md:grid-cols-2 lg:grid-cols-4`).

## 3. Preservação de Código Base (Apenas Melhorias)
- **NÃO DESTRUA**: Nunca remova, sobrescreva ou altere lógicas que já estão funcionando.
- **ADIÇÕES**: Novas funcionalidades devem ser implementadas como novas funções/módulos acopláveis, deixando a base original intacta.
- Modifique código existente apenas se houver solicitação explícita para correção de um bug.
