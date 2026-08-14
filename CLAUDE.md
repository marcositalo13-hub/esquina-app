@AGENTS.md

## Não Fazer

Campos de data nunca usam digitação livre de texto — sempre reaproveitar o componente MiniCalendar para seleção.

## Módulo Administrador — especificação (não implementado)

Home do Administrador: painel com 4 cards — "Preservação e Manutenção", "Morador", "Prestadores", "Relatório Geral". Cada card pode exibir um indicador visual (ponto vermelho) quando há pendência associada; a regra de "pendência" por card ainda não está definida.

Card "Preservação e Manutenção" ao ser tocado abre: (1) resumo das atividades agrupadas por tipo/classificação (ex: Limpeza, Manutenção Preventiva, Hidráulica, Elétrica); (2) lista das atividades cadastradas com status, abaixo do resumo.

Cadastro de nova atividade: acessível por ícone no canto superior direito da tela de Preservação e Manutenção, abre em card modal sobreposto (não página cheia). Campos: título, tipo (catálogo controlado: Limpeza, Hidráulica, Elétrica, e outros a definir — não é texto livre), descrição, local, periodicidade (Única/Diária/Semanal/Mensal/Trimestral/Semestral/Anual), prioridade (Baixa/Média/Alta), data de início, ativo (boolean), observações.

Login Preservação (equipe interna do condomínio — zeladoria, limpeza, manutenção contratada direta pelo síndico): vê e conclui apenas as ordens de serviço cujo tipo corresponde à sua especialidade/função. Filtro por tipo é a razão da classificação ser catálogo controlado, não texto livre.

Nota de terminologia: não confundir com o login "Prestador" (módulo separado, marketplace de terceiros atendendo moradores diretamente — sem relação com ordens de serviço internas).

Pendente de decisão antes de implementar: regra exata de pendência por card; lista completa de tipos do catálogo; se "Relatório Geral" e "Morador" (dentro do Administrador) têm escopo próprio a especificar.

Rotas: agrupamento ordenado de atividades (planos com `rota_id`/`ordem_na_rota`), criado pelo Administrador em Preservação e Manutenção, executado em lote pela Preservação via "Iniciar Rota" (Resumo do dia).
