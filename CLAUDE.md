@AGENTS.md

## Stack e arquitetura

Expo + expo-router + TypeScript, saída web estática (`web.output: "static"`). Deploy: GitHub → Vercel (Hobby) → Supabase (Postgres + Realtime em `ordens_servico`). Repositório público (Hobby não permite colaboração em repo privado).

Login é seletor manual de perfil — **sem autenticação real ainda**. Sem isolamento multi-condomínio (`condominio_id` não existe). Fase atual é deliberadamente single-tenant (piloto Esquina das Silvas).

## Convenção de nomenclatura — Zeladoria/Preservação

O texto visível ao usuário é **"Zeladoria"** (perfil de login) / **"Zeladoria e Manutenção"** (card do Admin, cabeçalhos de tela). Por convenção técnica, arquivos, rotas e identificadores internos continuam nomeados `preservacao`/`Preservação` (`app/preservacao.tsx`, `app/admin/preservacao.tsx`, rota `/preservacao`, variáveis, funções). **Não renomeie** esses identificadores por causa do texto visível — é decisão fixada, não pendência.

**Zeladoria** = equipe interna do condomínio, executa ordens de serviço. **Não confundir com Prestador** = marketplace de terceiros contratado pelo morador, módulo ainda não construído.

## Não fazer

- Campos de data nunca usam digitação livre de texto — sempre `MiniCalendar` (componente compartilhado entre Zeladoria e Contratos; alterá-lo exige teste de regressão nos dois módulos).
- Nunca usar `toISOString()` para calcular "hoje" — retorna UTC. Usar `hojeLocal()` com `getFullYear/getMonth/getDate`.
- Nunca escrever função serverless em `/api/` com assinatura Fetch API (`handler(request: Request)`) — trava 300s e dá 504 no plano Hobby. Sempre `(req: VercelRequest, res: VercelResponse)` + `res.status().json()`.
- Nunca usar `Alert.alert()` — não existe na web. Construir componente próprio.
- Nunca reintroduzir papel creme + terracota (`~#D97757`) — sinal reconhecido de design gerado por IA, já abandonado deliberadamente em favor do azul cobalto (`#1F4FE0`).
- Nunca instalar Reanimated ou NativeWind — decisão fixada. Traduzir qualquer exemplo de skill de design (geralmente CSS/web ou Framer Motion) para API nativa: `Easing.bezier()`, `Animated.spring()`, `Animated.stagger()`, `Pressable` com `({pressed})`.
- Toda tabela nova precisa de política de `select`, `insert`, `update` **e** `delete` no Supabase. RLS hoje está aberta (`using (true)`) em todas as tabelas — risco real porque Contratos carrega CPF/salário.
- Consultas ao Supabase sempre com filtro/paginação explícita — o limite padrão de 1000 linhas por query já causou sumiço intermitente de registros.

## Estado atual — módulo por módulo

### Zeladoria e Manutenção — funcional, ciclo completo
Implementado e em uso: cadastro de planos (tipo/periodicidade/prioridade/local/rota), motor de recorrência 90 dias com top-up ao abrir a tela, rotas ordenadas com checklist de segurança, execução guiada em tela cheia (uma atividade por vez, pausa/retomada, timer descontando pausas), dupla checagem do Administrador (Bom/Médio/Ruim ou reprova com justificativa), notificação de reprovação via sino, Painel do Síndico, card de insights no Relatório Geral.
Tabelas: `tipos_atividade`, `rotas`, `planos_manutencao`, `ordens_servico`.
Cadastro de nova atividade: ícone no canto superior direito da tela, abre em card modal sobreposto. Campos: título, tipo (catálogo controlado, não texto livre), descrição, local, periodicidade (Única/Diária/Semanal/Mensal/Trimestral/Semestral/Anual), prioridade (Baixa/Média/Alta), data de início, rota (obrigatória, sem opção "Nenhuma"), observações. Sem campo "ativo" na UI (coluna segue existindo em `planos_manutencao`, sem uso).
Login Zeladoria vê e conclui apenas ordens de serviço cujo tipo corresponde à sua especialidade — por isso o catálogo de tipos é controlado, não texto livre.

### Normativos — funcional em produção
Chat de IA sobre documentos internos com citação de artigo/documento de origem. CRUD em modal de tela cheia, swipe-to-delete na lista, data de última atualização por item.
Tabela `normativos`: `id`, `titulo`, `categoria`, `conteudo_markdown`, `atualizado_em`.
"Diretrizes do Agente" editável por tela foi cogitada e revertida — risco de remover a trava anti-alucinação sem perceber.

### Contratos — em desenvolvimento
Cadastro completo, barra de vencimento em gradiente contínuo (interpolação RGB ok→pending→overdue, nunca faixas discretas), vigência indeterminada com selo, máscara de moeda R$, selo "Renovação em breve" via `prazo_aviso_previo_dias`, assistente de IA escopado a um contrato por vez, aba de Relatórios com contadores e gráficos.
Tabelas `tipos_contrato` e `contratos` (catálogo próprio, não reaproveita `tipos_atividade`). Check constraint: `vigencia_indeterminada = true` exige `data_fim` nulo.
Exclusão só dentro do modal de edição (swipe foi removido, não corrigido). Alerta de renovação é selo persistente, nunca modal automático. Gráfico de valor usa cor de marca, não semântica.
**Pendente de teste:** drill-down nos contadores, gráfico de valor mensal por tipo (`react-native-gifted-charts`), comandos de data de vencimento no card.

### Não iniciados
Morador (encomendas, portaria, reservas), Financeiro, Prestador (marketplace).

## Arquitetura do Assistente de IA (Normativos e Contratos)

Qualquer módulo futuro com IA herda isto sem reabrir debate:
- Context stuffing, não RAG/embeddings — corpus pequeno/médio não justifica busca vetorial.
- Conteúdo em coluna `text` do Postgres, não em bucket.
- Chamada à API sempre via função serverless, nunca do cliente.
- Prompt em dois blocos: instrução de comportamento fixa no código + dados com `cache_control: { type: "ephemeral" }`.
- Modelo `claude-sonnet-5`.
- Sempre citar documento/cláusula de origem. Nunca executar ação — é consulta.
- Aviso de limitação da IA é elemento fixo de UI (texto estático), nunca gerado pelo modelo.
- Histórico de chat é efêmero, não persiste.
- Normativos manda o corpus inteiro; Contratos escopa a um contrato por vez.

## Sistema de design — "The Quiet Ledger"

Livro-razão discreto: precisão silenciosa, hierarquia clara, sem efeito visual gratuito.

**Paleta modo claro (padrão pós-login):** bg `#FAF9F6`, card `#FFFFFF`, sunken `#F1EFE9`, border `#E3E0D8`, borderStrong `#CFCBC1`, textPrimary `#22221F`, textSecondary `#6B6862`, textMuted `#9A968D`.

**Modo escuro:** exclusivo da tela de login, nunca misturar na mesma tela. bg `#121211`, surface `#1A1A19`, elevated `#232322`, border `#2E2E2C`.

**Marca — Cobalt Ink:** `#1F4FE0` (brand), `#16358F` (pressed), `#E7ECFC` (wash). Uso raro: botões primários, chips selecionados, aba ativa, gráficos que não representam status. Nunca para status.

**Semânticas — exclusivas para status:** ok `#2F7D53`, pending `#A9740B`, overdue `#B23A2E`, info `#6B6862` (neutro, deliberadamente não-azul).

**Profundidade:** chapado por padrão — cards/inputs/botões em repouso têm borda 1px e zero sombra. Sombra só em overlays temporários (CardMenu, seletor de data). Blur só quando há conteúdo real por trás.

**Motion:** `duration: { fast: 150, base: 250, slow: 400 }`. Sempre respeitar `AccessibilityInfo.isReduceMotionEnabled`. Movimento tem propósito, nunca decoração.

**Regras de interação fixas:**
- Formulários grandes e fluxos guiados são Modal em tela cheia, "X" no cabeçalho fecha sem salvar.
- Ações destrutivas pedem confirmação inline, dentro do próprio fluxo.
- Barra de navegação inferior é edge-to-edge, sem margem lateral nem cantos arredondados.
- Ações de execução ficam visíveis (botões diretos na Zeladoria); ações de exceção vão para menu de 3 pontos (Administrador supervisiona, não executa).

**Densidade por perfil:** Administrador tolera densidade (filtros, calendário, edição em massa). Zeladoria é mínimo absoluto — uso em campo, sob sol, poucos toques.

**Evitar deliberadamente:** gradiente roxo-azul genérico, ilustração 3D, densidade de ERP, papel creme + terracota.

## Validação visual obrigatória

Qualquer comando que altere `theme/index.ts`, tokens de cor, raio, ou qualquer valor consumido por múltiplas telas termina com verificação visual via `chrome-devtools-mcp`, não com `tsc --noEmit` isolado. `tsc` limpo não prova nada sobre aparência — um token que muda de VALOR mas continua existindo (ex: `radius.lg` de 16px para 999px) não gera erro de tipo, só deformação visual. Um token que é REMOVIDO gera erro de tipo, mas o app roda mesmo assim com `undefined` em runtime, e o efeito visual (botão invisível) só aparece na tela. Antes de reportar sucesso em qualquer mudança de tema: suba o servidor local, abra as telas afetadas via chrome-devtools-mcp, tire screenshot, compare com o esperado. Isso não substitui o teste manual de Porto no link do Vercel — é um portão antes dele, não no lugar dele.

## Erros recorrentes já enfrentados — reconheça rápido

| Sintoma | Causa real |
|---|---|
| Update/delete "funciona" mas nada muda | RLS sem política de `update`/`delete` — sucesso com 0 linhas afetadas, sem erro |
| Registros somem de forma intermitente | Limite de 1000 linhas por consulta — filtrar no banco, nunca no cliente |
| Data errada / item não aparece "hoje" | `toISOString()` retorna UTC — usar `hojeLocal()` |
| Função serverless trava 300s e dá 504 | Assinatura Fetch API em Vercel Function — usar `(req, res)` |
| Menu de contexto tampado por card vizinho | `View` posicionada por z-index — usar `Modal` com fundo próprio |
| Botões nomeados não funcionam no navegador | `Alert.alert()` não existe na web |
| Deploy bloqueado por autor do commit | E-mail do commit não bate com e-mail verificado no GitHub |

## Pendente de decisão antes de implementar (Módulo Administrador)

Regra exata de "pendência" (ponto vermelho) por card na home do Admin; lista completa de tipos do catálogo de atividades; se "Relatório Geral" e "Morador" têm escopo próprio a especificar.
