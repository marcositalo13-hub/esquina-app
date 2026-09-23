import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Chip } from '../src/components/Chip';
import {
  ExecucaoGuiada,
  type ExecucaoOrdemItem,
} from '../src/components/ExecucaoGuiada';
import { ScreenBackground } from '../src/components/ScreenBackground';
import { StatusBadge } from '../src/components/StatusBadge';
import {
  corIndicadorGrupo,
  formatarDataBR,
  formatarDuracao,
  getCorPrioridade,
  hojeLocal,
  localNomeOrdem,
  type OrdemServico,
  pesoPrioridade,
  prioridadeOrdem,
  type Rota,
  tipoNomeOrdem,
  tituloOrdem,
} from '../src/data/manutencao';
import {
  calcularSegundosDecorridos,
  concluirOrdem,
  iniciarOrdem,
  pausarOrdem,
  retomarOrdem,
} from '../src/lib/execucaoOrdens';
import { supabase } from '../src/lib/supabase';
import { preencherOcorrenciasFaltantes } from '../src/lib/topUpOcorrencias';
import { fonts, light, radius, semantic, spacing } from '../src/theme';

const hoje = hojeLocal;

type GrupoRota = { rota: Rota; itens: OrdemServico[] };

type ExecucaoAtiva = {
  ordens: ExecucaoOrdemItem[];
  tituloContexto: string | null;
};

// Aviso inline exibido no próprio card de rota quando "Iniciar Rota"/
// "Continuar" não encontra nada acionável, ou quando a consulta falha.
type AvisoCard = {
  id: string;
  texto: string;
  erro: boolean;
};

const AVISO_DURACAO_MS = 4000;

// Nome do local a exibir: prioriza o ambiente vinculado (locais.nome); cai
// para o texto livre antigo (plano.local) só quando não há local_id — nunca
// "Local: —" para um plano que já tinha local de texto preenchido. Mesmo
// helper duplicado em app/admin/preservacao.tsx.
function nomeLocal(plano: {
  local: string | null;
  locais?: { nome: string } | null;
}): string | null {
  return plano.locais?.nome ?? plano.local ?? null;
}

// Converte uma ordem (com plano/tipo já embutidos pela consulta) para o
// formato enxuto que o ExecucaoGuiada espera.
function paraItemExecucao(ordem: OrdemServico): ExecucaoOrdemItem {
  const plano = ordem.planos_manutencao;
  return {
    id: ordem.id,
    // Em rotina os dados vêm do plano; em extraordinária, das colunas da
    // própria ordem (ver helpers em src/data/manutencao.ts).
    titulo: tituloOrdem(ordem),
    tipo: tipoNomeOrdem(ordem),
    local: localNomeOrdem(ordem),
    rota: plano?.rotas?.nome ?? null,
    descricao: plano?.descricao ?? null,
    observacoes: plano ? plano.observacoes : ordem.observacao,
    status: ordem.status,
    iniciadoEm: ordem.iniciado_em,
    pausadoEm: ordem.pausado_em,
    tempoPausadoSegundos: ordem.tempo_pausado_segundos,
  };
}

// Uma rota é "continuação" (em vez de início novo) quando ao menos uma
// ordem dela já está em_andamento ou já tem iniciado_em preenchido.
function ehContinuacao(itens: OrdemServico[]): boolean {
  return itens.some(
    (o) => o.status === 'em_andamento' || o.iniciado_em !== null,
  );
}

// Frase convidativa do card de rota — varia só no singular/plural.
function fraseResumoRota(total: number): string {
  if (total === 1) {
    return '1 atividade programada para hoje. Vamos começar?';
  }
  return `${total} atividades programadas para hoje. Vamos começar?`;
}

// Timer ao vivo de uma linha do modo Lista — só reagenda a si mesmo, nunca
// acumula segundos em estado local: cada tick recalcula do zero a partir
// de iniciadoEm/pausadoEm/tempoPausadoSegundos (calcularSegundosDecorridos,
// mesma conta usada por admin/preservacao.tsx pra ordens já concluídas).
// É por isso que trocar de modo (Lista ⇄ Guiada) nunca reseta a contagem:
// não existe cronômetro guardado só na memória deste componente — ele é só
// uma reformatação, a cada segundo, do que já está persistido no banco.
function TimerAtividade({
  iniciadoEm,
  tempoPausadoSegundos,
}: {
  iniciadoEm: string;
  tempoPausadoSegundos: number;
}) {
  const [, forcarAtualizacao] = useState(0);

  useEffect(() => {
    const intervalo = setInterval(() => forcarAtualizacao((n) => n + 1), 1000);
    return () => clearInterval(intervalo);
  }, []);

  const segundos = calcularSegundosDecorridos(
    iniciadoEm,
    null,
    tempoPausadoSegundos,
  );

  return (
    <Text style={styles.listaTimerTexto}>{formatarDuracao(segundos)}</Text>
  );
}

export default function Preservacao() {
  const insets = useSafeAreaInsets();

  // Pendentes/em_andamento de hoje — já filtrado por data_prevista=hoje
  // direto no banco. Junto com concluidasHoje, alimenta "Resumo do dia".
  const [pendentes, setPendentes] = useState<OrdemServico[]>([]);
  // Concluídas de hoje — também filtrado por data_prevista=hoje direto no
  // banco (consulta separada da concluidas ampla abaixo), só para não
  // precisar varrer o histórico inteiro toda vez que "Resumo do dia"
  // precisa saber o que já foi concluído hoje.
  const [concluidasHoje, setConcluidasHoje] = useState<OrdemServico[]>([]);
  // Histórico amplo de concluídas (qualquer data) — só para a seção
  // "Concluídas". Ver comentário sobre .limit(5000) em carregar().
  const [concluidas, setConcluidas] = useState<OrdemServico[]>([]);
  // Atividades extraordinárias em aberto (pendente/em_andamento), de
  // qualquer prazo — não são filtradas por "hoje" como as de rotina: são
  // avulsas e ficam visíveis até serem concluídas.
  const [extraordinarias, setExtraordinarias] = useState<OrdemServico[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [execucao, setExecucao] = useState<ExecucaoAtiva | null>(null);
  const [verificandoId, setVerificandoId] = useState<string | null>(null);
  const [avisoRota, setAvisoRota] = useState<AvisoCard | null>(null);
  const avisoRotaTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fila de reprovações pendentes — alimenta o badge do sino. A tela cheia
  // só abre quando o sino é tocado (handleAbrirNotificacoes), uma
  // reprovação por vez, até esvaziar (ver renderização mais abaixo).
  const [reprovacoes, setReprovacoes] = useState<OrdemServico[]>([]);
  const [processandoReprovacao, setProcessandoReprovacao] = useState(false);
  const [modalReprovacaoVisivel, setModalReprovacaoVisivel] = useState(false);

  // Modo Lista (checklist compacto, ações inline) vs. Modo Guiada (tela
  // cheia atual, uma atividade por vez) — dois jeitos de olhar/agir sobre
  // as MESMAS ordens de hoje, nunca dois estados de execução diferentes.
  const [modoExibicao, setModoExibicao] = useState<'lista' | 'guiada'>('lista');
  const [processandoOrdemId, setProcessandoOrdemId] = useState<string | null>(
    null,
  );
  const [erroLinhaId, setErroLinhaId] = useState<string | null>(null);
  const [erroLinhaTexto, setErroLinhaTexto] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (avisoRotaTimeout.current) {
        clearTimeout(avisoRotaTimeout.current);
      }
    };
  }, []);

  const carregar = useCallback(async () => {
    const hojeStr = hoje();

    const [
      respostaPendentes,
      respostaConcluidasHoje,
      respostaConcluidas,
      respostaExtraordinarias,
    ] = await Promise.all([
      supabase
        .from('ordens_servico')
        .select(
          '*, planos_manutencao(*, tipos_atividade(*), rotas(*), locais(*))',
        )
        .neq('status', 'concluida')
        // A equipe de execução nunca vê atrasadas: só "pendentes" de hoje
        // (nunca data_prevista < hoje). Atrasadas seguem visíveis só para
        // o Administrador em app/admin/preservacao.tsx.
        .eq('data_prevista', hojeStr)
        .order('data_prevista', { ascending: true }),
      // Concluídas de hoje, filtradas por data_prevista=hoje direto no
      // banco — junto com "pendentes" acima, alimenta exclusivamente
      // "Resumo do dia" (nunca precisa varrer o histórico amplo abaixo
      // só para achar o que foi concluído hoje).
      supabase
        .from('ordens_servico')
        .select(
          '*, planos_manutencao(*, tipos_atividade(*), rotas(*), locais(*)), tipos_atividade(*), locais(*)',
        )
        .eq('status', 'concluida')
        .eq('data_prevista', hojeStr),
      // Histórico amplo de concluídas (qualquer data), só para a seção
      // "Concluídas". .limit(5000) explícito: sem isso, o corte de
      // segurança padrão do Supabase (1000 linhas) trunca silenciosamente
      // conforme o histórico cresce. Se o volume real ultrapassar isso,
      // é preciso paginação de verdade — dívida técnica documentada
      // aqui, não bug.
      supabase
        .from('ordens_servico')
        .select(
          '*, planos_manutencao(*, tipos_atividade(*), rotas(*), locais(*)), tipos_atividade(*), locais(*)',
        )
        .eq('status', 'concluida')
        .order('concluida_em', { ascending: false })
        .limit(5000),
      // Extraordinárias em aberto: sem plano por trás, então título/tipo/
      // local vêm por join direto na própria ordem. Sem filtro de data —
      // a atividade avulsa fica visível até ser concluída, e o prazo
      // (data_prevista) é exibido no card, não usado como corte.
      supabase
        .from('ordens_servico')
        .select('*, tipos_atividade(*), locais(*)')
        .eq('origem', 'extraordinaria')
        .in('status', ['pendente', 'em_andamento'])
        .limit(1000),
    ]);

    if (respostaPendentes.error) {
      setErro(respostaPendentes.error.message);
      return;
    }
    if (respostaConcluidasHoje.error) {
      setErro(respostaConcluidasHoje.error.message);
      return;
    }
    if (respostaConcluidas.error) {
      setErro(respostaConcluidas.error.message);
      return;
    }
    if (respostaExtraordinarias.error) {
      setErro(respostaExtraordinarias.error.message);
      return;
    }

    setErro(null);
    setPendentes((respostaPendentes.data ?? []) as OrdemServico[]);
    setConcluidasHoje((respostaConcluidasHoje.data ?? []) as OrdemServico[]);
    setConcluidas((respostaConcluidas.data ?? []) as OrdemServico[]);
    setExtraordinarias((respostaExtraordinarias.data ?? []) as OrdemServico[]);
  }, []);

  useEffect(() => {
    carregar().then(() => {
      preencherOcorrenciasFaltantes().then(() => {
        carregar();
      });
    });
  }, [carregar]);

  // Verifica se há atividades reprovadas pendentes de "leitura" pela
  // equipe de execução. Roda no mount e sempre que a tela ganha foco de
  // novo (ex.: volta de outra aba) via useFocusEffect. Só alimenta a
  // contagem/badge do sino — não abre mais a tela cheia sozinha (ver
  // handleAbrirNotificacoes).
  const verificarReprovacoes = useCallback(async () => {
    const { data, error } = await supabase
      .from('ordens_servico')
      .select(
        '*, planos_manutencao(*, tipos_atividade(*), rotas(*), locais(*))',
      )
      .eq('reprovacao_pendente', true)
      .order('reprovada_em', { ascending: true });

    if (error) {
      setErro(error.message);
      return;
    }

    setReprovacoes((data ?? []) as OrdemServico[]);
  }, []);

  useFocusEffect(
    useCallback(() => {
      verificarReprovacoes();
    }, [verificarReprovacoes]),
  );

  // Realtime: qualquer mudança em ordens_servico (concluída em outro
  // dispositivo, reprovada pelo admin, nova ocorrência gerada, etc.)
  // refaz os mesmos refetches já usados para atualizar a tela — sem
  // duplicar a lógica de busca.
  useEffect(() => {
    const canal = supabase
      .channel('preservacao-execucao-ordens-servico')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ordens_servico' },
        () => {
          carregar();
          verificarReprovacoes();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, [carregar, verificarReprovacoes]);

  const reprovacaoAtual = reprovacoes[0] ?? null;

  async function handleEntenderReprovacao() {
    if (!reprovacaoAtual || processandoReprovacao) {
      return;
    }

    setProcessandoReprovacao(true);

    const { error } = await supabase
      .from('ordens_servico')
      .update({ reprovacao_pendente: false })
      .eq('id', reprovacaoAtual.id);

    setProcessandoReprovacao(false);

    if (error) {
      setErro(error.message);
      return;
    }

    setReprovacoes((atual) => {
      const restante = atual.slice(1);
      if (restante.length === 0) {
        // Fila esvaziou — fecha o modal em vez de deixá-lo "armado" para
        // reabrir sozinho quando uma reprovação nova chegar via Realtime.
        setModalReprovacaoVisivel(false);
      }
      return restante;
    });
  }

  // Sino: só abre a tela cheia se houver alguma reprovação pendente. Com
  // contador zerado, o toque não faz nada.
  function handleAbrirNotificacoes() {
    if (reprovacoes.length === 0) {
      return;
    }
    setModalReprovacaoVisivel(true);
  }

  // Resumo do dia: agrupa por rota as ordens de HOJE que têm rota.
  // pendentes e concluidasHoje já vêm filtradas por data_prevista=hoje
  // direto no banco — nenhum filtro de data em JS é necessário aqui.
  const resumoRotas = useMemo(() => {
    const grupos = new Map<string, GrupoRota>();

    for (const ordem of [...pendentes, ...concluidasHoje]) {
      const plano = ordem.planos_manutencao;
      const rota = plano?.rotas;

      if (plano?.rota_id && rota) {
        const grupo = grupos.get(plano.rota_id);
        if (grupo) {
          grupo.itens.push(ordem);
        } else {
          grupos.set(plano.rota_id, { rota, itens: [ordem] });
        }
      }
    }

    for (const grupo of grupos.values()) {
      grupo.itens.sort((a, b) => {
        const ordemA = a.planos_manutencao?.ordem_na_rota ?? 0;
        const ordemB = b.planos_manutencao?.ordem_na_rota ?? 0;
        return ordemA - ordemB;
      });
    }

    return Array.from(grupos.values());
  }, [pendentes, concluidasHoje]);

  // Alta primeiro, depois Média, depois Baixa; empate desempata pelo prazo
  // mais próximo. Prioridade Alta NÃO interrompe trabalho em andamento —
  // só sobe na ordem de exibição (decisão de produto, sem lógica de
  // interrupção).
  const extraordinariasOrdenadas = useMemo(() => {
    return [...extraordinarias].sort((a, b) => {
      const peso =
        pesoPrioridade(prioridadeOrdem(a)) - pesoPrioridade(prioridadeOrdem(b));
      if (peso !== 0) {
        return peso;
      }
      return a.data_prevista.localeCompare(b.data_prevista);
    });
  }, [extraordinarias]);

  // Atividades de hoje COM rota já aparecem no Resumo do dia — somem da
  // seção Concluídas para não duplicar. Sem rota (hoje ou não) e qualquer
  // outra data continuam aparecendo normalmente.
  const concluidasExibidas = useMemo(() => {
    const hojeStr = hoje();
    return concluidas.filter(
      (o) => !(o.data_prevista === hojeStr && o.planos_manutencao?.rota_id),
    );
  }, [concluidas]);

  // Modo Lista: todas as ordens de hoje deste zelador, achatadas — mesma
  // fonte de dados já usada pelo modo Guiada (extraordinariasOrdenadas +
  // resumoRotas), só apresentada como checklist único em vez de cards por
  // rota/extraordinária.
  const ordensListaHoje = useMemo(() => {
    return [
      ...extraordinariasOrdenadas,
      ...resumoRotas.flatMap((grupo) => grupo.itens),
    ];
  }, [extraordinariasOrdenadas, resumoRotas]);

  async function handleIniciarLinha(ordemId: string) {
    if (processandoOrdemId) {
      return;
    }
    setProcessandoOrdemId(ordemId);
    setErroLinhaId(null);
    const { error } = await iniciarOrdem(ordemId);
    setProcessandoOrdemId(null);
    if (error) {
      setErroLinhaId(ordemId);
      setErroLinhaTexto(error);
      return;
    }
    await carregar();
  }

  async function handlePausarLinha(ordemId: string) {
    if (processandoOrdemId) {
      return;
    }
    setProcessandoOrdemId(ordemId);
    setErroLinhaId(null);
    const { error } = await pausarOrdem(ordemId);
    setProcessandoOrdemId(null);
    if (error) {
      setErroLinhaId(ordemId);
      setErroLinhaTexto(error);
      return;
    }
    await carregar();
  }

  async function handleRetomarLinha(
    ordemId: string,
    pausadoEm: string,
    tempoPausadoSegundos: number,
  ) {
    if (processandoOrdemId) {
      return;
    }
    setProcessandoOrdemId(ordemId);
    setErroLinhaId(null);
    const { error } = await retomarOrdem(
      ordemId,
      pausadoEm,
      tempoPausadoSegundos,
    );
    setProcessandoOrdemId(null);
    if (error) {
      setErroLinhaId(ordemId);
      setErroLinhaTexto(error);
      return;
    }
    await carregar();
  }

  async function handleConcluirLinha(ordemId: string) {
    if (processandoOrdemId) {
      return;
    }
    setProcessandoOrdemId(ordemId);
    setErroLinhaId(null);
    const { error } = await concluirOrdem(ordemId);
    setProcessandoOrdemId(null);
    if (error) {
      setErroLinhaId(ordemId);
      setErroLinhaTexto(error);
      return;
    }
    await carregar();
  }

  function mostrarAvisoRota(rotaId: string, texto: string, erro: boolean) {
    if (avisoRotaTimeout.current) {
      clearTimeout(avisoRotaTimeout.current);
    }
    setAvisoRota({ id: rotaId, texto, erro });
    avisoRotaTimeout.current = setTimeout(
      () => setAvisoRota(null),
      AVISO_DURACAO_MS,
    );
  }

  // Rede de segurança: busca as ordens acionáveis da rota DIRETO no banco
  // (em vez de confiar no estado local, que pode estar desatualizado) antes
  // de abrir o fluxo — inclui 'pendente' E 'em_andamento' (continuação),
  // não só 'pendente'. Array vazio → aviso inline no card, sem abrir o
  // fluxo. Falha na consulta → mesmo lugar, mensagem em semantic.overdue.
  async function handleIniciarRota(grupo: GrupoRota) {
    setAvisoRota(null);
    setVerificandoId(grupo.rota.id);

    try {
      const { data, error } = await supabase
        .from('ordens_servico')
        .select(
          '*, planos_manutencao(*, tipos_atividade(*), rotas(*), locais(*))',
        )
        .in('status', ['pendente', 'em_andamento'])
        .eq('data_prevista', hoje());

      if (error) {
        throw error;
      }

      const itensAcionaveis = ((data ?? []) as OrdemServico[])
        .filter((o) => o.planos_manutencao?.rota_id === grupo.rota.id)
        .sort((a, b) => {
          const ordemA = a.planos_manutencao?.ordem_na_rota ?? 0;
          const ordemB = b.planos_manutencao?.ordem_na_rota ?? 0;
          return ordemA - ordemB;
        })
        .map(paraItemExecucao);

      if (itensAcionaveis.length === 0) {
        mostrarAvisoRota(
          grupo.rota.id,
          'Todas as atividades desta rota já foram concluídas hoje.',
          false,
        );
        return;
      }

      setExecucao({
        ordens: itensAcionaveis,
        tituloContexto: grupo.rota.nome,
      });
    } catch (err) {
      mostrarAvisoRota(
        grupo.rota.id,
        err instanceof Error
          ? err.message
          : 'Não foi possível carregar as atividades desta rota.',
        true,
      );
    } finally {
      setVerificandoId(null);
    }
  }

  // Extraordinária entra no MESMO fluxo guiado das ordens de rotina — só
  // muda o contexto (uma atividade avulsa, sem rota). Nenhuma lógica de
  // execução é duplicada aqui.
  function handleIniciarExtraordinaria(ordem: OrdemServico) {
    setExecucao({
      ordens: [paraItemExecucao(ordem)],
      tituloContexto: null,
    });
  }

  function handleFinalizarExecucao() {
    setExecucao(null);
    carregar();
  }

  return (
    <View style={styles.container}>
      {modalReprovacaoVisivel && reprovacaoAtual ? (
        <Modal
          visible
          transparent={false}
          animationType="fade"
          onRequestClose={() => {}}
        >
          <View
            style={[
              styles.telaReprovacao,
              {
                paddingTop: insets.top + spacing.xl,
                paddingBottom: insets.bottom + spacing.xl,
              },
            ]}
          >
            <Ionicons name="alert-circle" size={72} color="#FFFFFF" />
            <Text style={styles.reprovacaoTitulo}>Atividade reprovada</Text>

            <View style={styles.reprovacaoInfo}>
              <Text style={styles.reprovacaoNome}>
                {reprovacaoAtual.planos_manutencao?.titulo ?? 'Atividade'}
              </Text>
              <Text style={styles.reprovacaoDetalhe}>
                {reprovacaoAtual.planos_manutencao?.tipos_atividade?.nome ??
                  'Sem tipo'}
              </Text>
              {reprovacaoAtual.planos_manutencao &&
              nomeLocal(reprovacaoAtual.planos_manutencao) ? (
                <Text style={styles.reprovacaoDetalhe}>
                  {nomeLocal(reprovacaoAtual.planos_manutencao)}
                </Text>
              ) : null}

              <Text style={styles.reprovacaoMotivoLabel}>Motivo</Text>
              <Text style={styles.reprovacaoMotivoTexto}>
                {reprovacaoAtual.motivo_reprovacao?.trim()
                  ? reprovacaoAtual.motivo_reprovacao
                  : 'Nenhum motivo informado'}
              </Text>
            </View>

            <Pressable
              style={[
                styles.reprovacaoBotao,
                processandoReprovacao && styles.reprovacaoBotaoDesabilitado,
              ]}
              onPress={handleEntenderReprovacao}
              disabled={processandoReprovacao}
            >
              <Text style={styles.reprovacaoBotaoTexto}>
                {processandoReprovacao ? 'Salvando…' : 'Entendido'}
              </Text>
            </Pressable>
          </View>
        </Modal>
      ) : null}

      <ScreenBackground />

      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.title}>Zeladoria</Text>
        <View style={styles.headerAcoes}>
          <Pressable
            style={styles.sinoBotao}
            onPress={handleAbrirNotificacoes}
            hitSlop={8}
          >
            <Ionicons
              name={
                reprovacoes.length > 0
                  ? 'notifications'
                  : 'notifications-outline'
              }
              size={22}
              color={light.textPrimary}
            />
            {reprovacoes.length > 0 ? (
              <View style={styles.sinoBadge}>
                <Text style={styles.sinoBadgeTexto}>
                  {reprovacoes.length > 9 ? '9+' : reprovacoes.length}
                </Text>
              </View>
            ) : null}
          </Pressable>
          <Pressable
            onPress={async () => {
              await supabase.auth.signOut();
              router.replace('/login');
            }}
          >
            <Text style={styles.trocarPerfil}>Sair</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.toggleModoRow}>
        <Pressable
          style={[
            styles.toggleModoBotao,
            modoExibicao === 'lista' && styles.toggleModoBotaoAtivo,
          ]}
          onPress={() => setModoExibicao('lista')}
        >
          <Text
            style={[
              styles.toggleModoTexto,
              modoExibicao === 'lista' && styles.toggleModoTextoAtivo,
            ]}
          >
            Lista
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.toggleModoBotao,
            modoExibicao === 'guiada' && styles.toggleModoBotaoAtivo,
          ]}
          onPress={() => setModoExibicao('guiada')}
        >
          <Text
            style={[
              styles.toggleModoTexto,
              modoExibicao === 'guiada' && styles.toggleModoTextoAtivo,
            ]}
          >
            Guiada
          </Text>
        </Pressable>
      </View>

      {modoExibicao === 'lista' ? (
        <ScrollView contentContainerStyle={styles.body}>
          {erro ? <Text style={styles.erro}>{erro}</Text> : null}

          {ordensListaHoje.length === 0 ? (
            <Text style={styles.vazio}>
              Nenhuma atividade prevista para hoje.
            </Text>
          ) : (
            <View style={styles.listaChecklist}>
              {ordensListaHoje.map((ordem) => {
                const pausadaLinha =
                  ordem.status === 'em_andamento' && ordem.pausado_em !== null;
                const emAndamentoLinha =
                  ordem.status === 'em_andamento' && ordem.pausado_em === null;
                const concluidaLinha = ordem.status === 'concluida';
                const local = localNomeOrdem(ordem);
                const rotaNome = ordem.planos_manutencao?.rotas?.nome ?? null;
                const processandoLinha = processandoOrdemId === ordem.id;

                return (
                  <View
                    key={ordem.id}
                    style={[
                      styles.linhaChecklist,
                      concluidaLinha && styles.linhaChecklistConcluida,
                    ]}
                  >
                    <View style={styles.linhaChecklistTextos}>
                      <Text
                        style={[
                          styles.linhaChecklistTitulo,
                          concluidaLinha &&
                            styles.linhaChecklistTituloConcluido,
                        ]}
                      >
                        {tituloOrdem(ordem)}
                      </Text>
                      {local ? (
                        <Text style={styles.linhaChecklistLocal}>{local}</Text>
                      ) : null}
                      {rotaNome ? (
                        <Text style={styles.linhaChecklistLocal}>
                          Rota: {rotaNome}
                        </Text>
                      ) : null}
                      {emAndamentoLinha && ordem.iniciado_em ? (
                        <TimerAtividade
                          iniciadoEm={ordem.iniciado_em}
                          tempoPausadoSegundos={ordem.tempo_pausado_segundos}
                        />
                      ) : null}
                      {erroLinhaId === ordem.id && erroLinhaTexto ? (
                        <Text style={styles.erro}>{erroLinhaTexto}</Text>
                      ) : null}
                    </View>

                    <View style={styles.linhaChecklistAcoes}>
                      {concluidaLinha ? (
                        <Ionicons
                          name="checkmark-circle"
                          size={22}
                          color={semantic.ok}
                        />
                      ) : pausadaLinha ? (
                        <Pressable
                          style={styles.botaoLinhaSecundario}
                          onPress={() =>
                            handleRetomarLinha(
                              ordem.id,
                              ordem.pausado_em as string,
                              ordem.tempo_pausado_segundos,
                            )
                          }
                          disabled={processandoLinha}
                        >
                          <Text style={styles.botaoLinhaSecundarioTexto}>
                            {processandoLinha ? 'Retomando…' : 'Retomar'}
                          </Text>
                        </Pressable>
                      ) : emAndamentoLinha ? (
                        <>
                          <Pressable
                            style={styles.botaoLinhaSecundario}
                            onPress={() => handlePausarLinha(ordem.id)}
                            disabled={processandoLinha}
                          >
                            <Text style={styles.botaoLinhaSecundarioTexto}>
                              {processandoLinha ? 'Pausando…' : 'Pausar'}
                            </Text>
                          </Pressable>
                          <Pressable
                            style={styles.botaoLinhaPrimario}
                            onPress={() => handleConcluirLinha(ordem.id)}
                            disabled={processandoLinha}
                          >
                            <Text style={styles.botaoLinhaPrimarioTexto}>
                              {processandoLinha ? 'Salvando…' : 'Concluir'}
                            </Text>
                          </Pressable>
                        </>
                      ) : (
                        <Pressable
                          style={styles.botaoLinhaPrimario}
                          onPress={() => handleIniciarLinha(ordem.id)}
                          disabled={processandoLinha}
                        >
                          <Text style={styles.botaoLinhaPrimarioTexto}>
                            {processandoLinha ? 'Iniciando…' : 'Iniciar'}
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          {erro ? <Text style={styles.erro}>{erro}</Text> : null}

          {/* Sem extraordinária em aberto, a seção inteira some — nada de
            título órfão nem card vazio. */}
          {extraordinariasOrdenadas.length > 0 ? (
            <>
              <Text style={styles.secaoTitulo}>Extraordinárias</Text>
              <View style={styles.lista}>
                {extraordinariasOrdenadas.map((ordem) => {
                  const prioridade = prioridadeOrdem(ordem);
                  const local = localNomeOrdem(ordem);
                  const emAndamento = ordem.status === 'em_andamento';

                  return (
                    <View key={ordem.id} style={styles.extraCard}>
                      <View style={styles.extraCabecalho}>
                        <View style={styles.seloExtra}>
                          <Text style={styles.seloExtraTexto}>
                            Extraordinária
                          </Text>
                        </View>
                        {prioridade ? (
                          <Chip
                            label={prioridade}
                            color={getCorPrioridade(prioridade)}
                          />
                        ) : null}
                      </View>

                      <Text style={styles.extraTitulo}>
                        {tituloOrdem(ordem)}
                      </Text>
                      <Text style={styles.extraDetalhe}>
                        {tipoNomeOrdem(ordem)}
                      </Text>
                      {local ? (
                        <Text style={styles.extraDetalhe}>{local}</Text>
                      ) : null}
                      <Text style={styles.extraDetalhe}>
                        Prazo · {formatarDataBR(ordem.data_prevista)}
                      </Text>

                      <Pressable
                        style={styles.botaoIniciarRota}
                        onPress={() => handleIniciarExtraordinaria(ordem)}
                      >
                        <Text style={styles.botaoIniciarRotaTexto}>
                          {emAndamento ? 'Continuar' : 'Iniciar'}
                        </Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            </>
          ) : null}

          {resumoRotas.length > 0 ? (
            <>
              <Text style={styles.secaoTitulo}>Resumo do dia</Text>
              <View style={styles.lista}>
                {resumoRotas.map((grupo) => {
                  const concluidasCount = grupo.itens.filter(
                    (o) => o.status === 'concluida',
                  ).length;
                  const iniciadasCount = grupo.itens.filter(
                    (o) => o.status !== 'pendente',
                  ).length;
                  // Mostra o botão quando existe ao menos uma ordem de hoje,
                  // nesta rota, ainda 'pendente' OU 'em_andamento' (uma
                  // 'em_andamento' sem tudo mais concluído é uma rota pausada
                  // no meio — precisa continuar aparecendo acionável).
                  const temPendente = grupo.itens.some(
                    (o) => o.status === 'pendente',
                  );
                  const temAcao =
                    temPendente ||
                    grupo.itens.some((o) => o.status === 'em_andamento');
                  // Continuação: ao menos uma ordem já foi iniciada — o botão
                  // vira "Continuar" e o fluxo pula transição/checklist.
                  const continuacao = ehContinuacao(grupo.itens);
                  // 100% concluída: todas as ordens de hoje da rota estão
                  // 'concluida' (logo, nenhuma pendente nem em_andamento).
                  const todasConcluidas =
                    grupo.itens.length > 0 &&
                    concluidasCount === grupo.itens.length;
                  const cor = corIndicadorGrupo(
                    grupo.itens.length,
                    concluidasCount,
                    iniciadasCount,
                  );

                  return (
                    <View key={grupo.rota.id} style={styles.resumoRotaCard}>
                      <View style={styles.resumoRotaCabecalho}>
                        <View
                          style={[
                            styles.resumoRotaIndicador,
                            { backgroundColor: cor },
                          ]}
                        />
                        <View style={styles.resumoRotaInfo}>
                          <Text style={styles.resumoRotaTitulo}>
                            {grupo.rota.nome}
                          </Text>
                          <Text style={styles.resumoRotaContagem}>
                            {fraseResumoRota(grupo.itens.length)}
                          </Text>
                        </View>
                      </View>

                      {temAcao ? (
                        <Pressable
                          style={styles.botaoIniciarRota}
                          onPress={() => handleIniciarRota(grupo)}
                          disabled={verificandoId === grupo.rota.id}
                        >
                          <Text style={styles.botaoIniciarRotaTexto}>
                            {verificandoId === grupo.rota.id
                              ? 'Verificando…'
                              : continuacao
                                ? 'Continuar'
                                : 'Iniciar Rota'}
                          </Text>
                        </Pressable>
                      ) : todasConcluidas ? (
                        <View style={styles.rotaConcluidaIndicador}>
                          <Ionicons
                            name="checkmark-circle"
                            size={18}
                            color={semantic.ok}
                          />
                          <Text style={styles.rotaConcluidaTexto}>
                            Todas as atividades concluídas
                          </Text>
                        </View>
                      ) : null}

                      {avisoRota?.id === grupo.rota.id ? (
                        <Text
                          style={avisoRota.erro ? styles.erro : styles.aviso}
                        >
                          {avisoRota.texto}
                        </Text>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            </>
          ) : null}

          <Text style={styles.secaoTitulo}>Concluídas</Text>
          {concluidasExibidas.length === 0 ? (
            <Text style={styles.vazio}>Nenhuma ordem concluída.</Text>
          ) : (
            <View style={styles.listaConcluidas}>
              {concluidasExibidas.map((ordem, indice) => {
                // Rotina lê do plano; extraordinária, das colunas da própria
                // ordem — os helpers cobrem os dois casos.
                const local = localNomeOrdem(ordem);
                const prioridade = prioridadeOrdem(ordem);

                return (
                  <View
                    key={ordem.id}
                    style={[
                      styles.linhaConcluida,
                      indice === 0 && styles.linhaConcluidaPrimeira,
                    ]}
                  >
                    <Text style={styles.linhaConcluidaTitulo}>
                      {tituloOrdem(ordem)}
                    </Text>
                    <Text style={styles.linhaConcluidaTipo}>
                      {tipoNomeOrdem(ordem)}
                    </Text>
                    {local ? (
                      <Text style={styles.linhaConcluidaDetalhe}>{local}</Text>
                    ) : null}

                    <View style={styles.linhaConcluidaRodape}>
                      <View style={styles.linhaConcluidaRodapeEsquerda}>
                        <Text style={styles.linhaConcluidaDetalhe}>
                          Concluída em{' '}
                          {ordem.concluida_em
                            ? `${formatarDataBR(ordem.concluida_em.slice(0, 10))} às ${new Date(
                                ordem.concluida_em,
                              ).toLocaleTimeString('pt-BR', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}`
                            : '—'}
                        </Text>
                        <StatusBadge ordem={ordem} />
                      </View>
                      {prioridade ? (
                        <Chip
                          label={prioridade}
                          color={getCorPrioridade(prioridade)}
                        />
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}

      {execucao ? (
        <ExecucaoGuiada
          ordens={execucao.ordens}
          tituloContexto={execucao.tituloContexto}
          onFinish={handleFinalizarExecucao}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: light.bg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: {
    fontFamily: fonts.semiBold,
    fontSize: 20,
    color: light.textPrimary,
  },
  trocarPerfil: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: light.textSecondary,
  },
  headerAcoes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  sinoBotao: {
    position: 'relative',
    padding: 2,
  },
  sinoBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: semantic.overdue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sinoBadgeTexto: {
    fontFamily: fonts.semiBold,
    fontSize: 10,
    color: '#FFFFFF',
  },
  body: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  toggleModoRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.xs,
  },
  toggleModoBotao: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: light.border,
    backgroundColor: light.card,
  },
  toggleModoBotaoAtivo: {
    backgroundColor: light.inkAction,
    borderColor: light.inkAction,
  },
  toggleModoTexto: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: light.textSecondary,
  },
  toggleModoTextoAtivo: {
    color: '#FFFFFF',
  },
  listaChecklist: {
    gap: spacing.xs,
  },
  linhaChecklist: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    backgroundColor: light.card,
    borderWidth: 1,
    borderColor: light.border,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  linhaChecklistConcluida: {
    opacity: 0.55,
  },
  linhaChecklistTextos: {
    flex: 1,
    gap: 2,
  },
  linhaChecklistTitulo: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: light.textPrimary,
  },
  linhaChecklistTituloConcluido: {
    textDecorationLine: 'line-through',
  },
  linhaChecklistLocal: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: light.textSecondary,
  },
  linhaChecklistAcoes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  listaTimerTexto: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: light.inkAction,
  },
  botaoLinhaPrimario: {
    backgroundColor: light.inkAction,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
  },
  botaoLinhaPrimarioTexto: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: '#FFFFFF',
  },
  botaoLinhaSecundario: {
    borderWidth: 1,
    borderColor: light.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
  },
  botaoLinhaSecundarioTexto: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: light.textSecondary,
  },
  erro: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: semantic.overdue,
  },
  aviso: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: light.textSecondary,
  },
  secaoTitulo: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: light.textPrimary,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  vazio: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: light.textSecondary,
  },
  lista: {
    gap: spacing.sm,
  },
  resumoRotaCard: {
    backgroundColor: light.card,
    borderWidth: 1,
    borderColor: light.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  // Destaque de "isto é extraordinária": borda e fundo tingidos com o
  // accent funcional do tema (TINTA — inkAction/sunken), nunca com cor
  // semântica. Verde/âmbar/vermelho seguem exclusivos de status, e a
  // prioridade continua usando essas cores no chip DENTRO do card.
  extraCard: {
    backgroundColor: light.sunken,
    borderWidth: 1,
    borderColor: light.inkAction,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  extraCabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.xs / 2,
  },
  seloExtra: {
    backgroundColor: light.inkAction,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
  },
  seloExtraTexto: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: '#FFFFFF',
  },
  extraTitulo: {
    fontFamily: fonts.semiBold,
    fontSize: 16,
    color: light.textPrimary,
  },
  extraDetalhe: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: light.textSecondary,
  },
  resumoRotaCabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  resumoRotaIndicador: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  resumoRotaInfo: {
    flex: 1,
  },
  resumoRotaTitulo: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: light.textPrimary,
  },
  resumoRotaContagem: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: light.textSecondary,
  },
  botaoIniciarRota: {
    backgroundColor: light.inkAction,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
  },
  botaoIniciarRotaTexto: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: '#FFFFFF',
  },
  rotaConcluidaIndicador: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm + 2,
  },
  rotaConcluidaTexto: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: semantic.ok,
  },
  resumoRotaLista: {
    gap: spacing.sm,
  },
  // Ruled Rows (DESIGN.md → Components): sem gap entre registros — a
  // régua de 1px entre linhas já é a separação, como em
  // normativos-gerenciar.tsx.
  listaConcluidas: {},
  // Sem fundo/borda/raio por item — só a régua de 1px Hairline Border
  // abaixo de cada linha. Opacidade reduzida mantém a leitura de "já
  // concluída" sem reintroduzir o card. Título em Inter (não Source
  // Serif): telas de Zeladoria nunca usam serifa.
  linhaConcluida: {
    paddingVertical: spacing.sm,
    gap: spacing.xs / 2,
    borderBottomWidth: 1,
    borderBottomColor: light.border,
    opacity: 0.6,
  },
  // Primeira linha da lista leva a régua de 2px em Ink Action, cabeça de
  // grupo — mesmo padrão de normativos-gerenciar.tsx.
  linhaConcluidaPrimeira: {
    borderTopWidth: 2,
    borderTopColor: light.inkAction,
  },
  linhaConcluidaTitulo: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: light.textPrimary,
  },
  linhaConcluidaTipo: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: light.textSecondary,
  },
  linhaConcluidaDetalhe: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: light.textSecondary,
  },
  linhaConcluidaRodape: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  linhaConcluidaRodapeEsquerda: {
    gap: spacing.xs / 2,
  },
  telaReprovacao: {
    flex: 1,
    backgroundColor: semantic.overdue,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  reprovacaoTitulo: {
    fontFamily: fonts.semiBold,
    fontSize: 22,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  reprovacaoInfo: {
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  reprovacaoNome: {
    fontFamily: fonts.semiBold,
    fontSize: 17,
    color: '#FFFFFF',
  },
  reprovacaoDetalhe: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.85)',
  },
  reprovacaoMotivoLabel: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: spacing.sm,
  },
  reprovacaoMotivoTexto: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: '#FFFFFF',
    lineHeight: 21,
  },
  reprovacaoBotao: {
    alignSelf: 'stretch',
    backgroundColor: '#FFFFFF',
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 4,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  reprovacaoBotaoDesabilitado: {
    opacity: 0.7,
  },
  reprovacaoBotaoTexto: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: semantic.overdue,
  },
});
