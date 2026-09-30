import { Ionicons } from '@expo/vector-icons';
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AccessibilityInfo,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type Ambiente, listarAmbientes } from '../data/ambientes';
import type { Funcionario } from '../data/funcionarios';
import {
  atualizarRota,
  criarPlanoManutencao,
  criarRota,
  ErroGeracaoOrdens,
  formatarDataBR,
  gerarOrdensIniciaisDoPlano,
  hojeLocal,
  PERIODICIDADES,
  type Periodicidade,
  type PlanoManutencao,
  type Prioridade,
  proximaOrdemNaRota,
  type Rota,
  type TipoAtividade,
} from '../data/manutencao';
import { supabase } from '../lib/supabase';
import { fonts, light, radius, semantic, spacing } from '../theme';
import { Chip } from './Chip';
import { MiniCalendar } from './MiniCalendar';

// Mesmo padrão do formulário de plano (limparFormulario em
// app/admin/preservacao.tsx) — o fluxo não pergunta prioridade, mas a
// coluna é not null.
const PRIORIDADE_PADRAO: Prioridade = 'Média';

type Passo = 1 | 2 | 3 | 4;

type Carga<T> =
  | { estado: 'carregando' }
  | { estado: 'pronto'; dados: T }
  | { estado: 'erro' };

type EscolhaRota = { tipo: 'existente'; rotaId: string } | { tipo: 'nova' };

type CampoComErro =
  | 'titulo'
  | 'tipo'
  | 'local'
  | 'repeticao'
  | 'rota'
  | 'nomeNovaRota'
  | 'responsavel';

type EtapaGravacao = 'rota' | 'responsavel' | 'atividade' | 'ordens';

async function buscarTipos(): Promise<TipoAtividade[]> {
  const { data, error } = await supabase
    .from('tipos_atividade')
    .select('*')
    .eq('ativo', true)
    .order('ordem', { ascending: true });
  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []) as TipoAtividade[];
}

async function buscarRotas(): Promise<Rota[]> {
  const { data, error } = await supabase
    .from('rotas')
    .select('*')
    .order('nome', { ascending: true });
  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []) as Rota[];
}

async function buscarLocaisAtivos(): Promise<Ambiente[]> {
  const lista = await listarAmbientes();
  return lista.filter((item) => item.ativo);
}

// Lista completa (ativos e inativos): os inativos só servem para mostrar o
// nome do responsável atual de uma rota e saber que ele precisa ser trocado.
async function buscarFuncionarios(): Promise<Funcionario[]> {
  const resposta = await fetch('/api/listar-funcionarios');
  const dados = (await resposta.json().catch(() => null)) as {
    funcionarios?: Funcionario[];
    erro?: string;
  } | null;
  if (!resposta.ok) {
    throw new Error(dados?.erro ?? 'Não foi possível carregar os usuários.');
  }
  return dados?.funcionarios ?? [];
}

function useCarga<T>(buscar: () => Promise<T>) {
  const [carga, setCarga] = useState<Carga<T>>({ estado: 'carregando' });

  const recarregar = useCallback(() => {
    setCarga({ estado: 'carregando' });
    buscar().then(
      (dados) => setCarga({ estado: 'pronto', dados }),
      () => setCarga({ estado: 'erro' }),
    );
  }, [buscar]);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  return [carga, recarregar] as const;
}

function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

function mensagemDeFalha(
  etapa: EtapaGravacao,
  rotaJaCriada: Rota | null,
): string {
  switch (etapa) {
    case 'rota':
      return 'Não foi possível criar a rota. Verifique a conexão e toque em “Salvar atividade” para tentar de novo.';
    case 'responsavel':
      return 'Não foi possível definir o responsável da rota. Toque em “Salvar atividade” para tentar de novo.';
    case 'atividade':
      return rotaJaCriada
        ? `A rota “${rotaJaCriada.nome}” foi criada, mas a atividade não pôde ser salva. Toque em “Salvar atividade” para tentar de novo — a rota não será criada outra vez.`
        : 'Não foi possível salvar a atividade. Toque em “Salvar atividade” para tentar de novo.';
    case 'ordens':
      return 'A atividade foi salva, mas as datas de execução não foram geradas. Toque em “Salvar atividade” para tentar de novo.';
  }
}

type FluxoNovaAtividadeProps = {
  onFechar: () => void;
  onSalvo: () => void | Promise<void>;
};

// Criação guiada de atividade de rotina (Atividade → Rota → Responsável →
// Revisar). Nada é gravado antes do passo 4. Edição e duplicação continuam
// no formulário direto de app/admin/preservacao.tsx.
export function FluxoNovaAtividade({
  onFechar,
  onSalvo,
}: FluxoNovaAtividadeProps) {
  const insets = useSafeAreaInsets();

  // Todas as cargas disparam na montagem, antes de o usuário chegar aos
  // passos que dependem delas.
  const [tipos, recarregarTipos] = useCarga(buscarTipos);
  const [locais, recarregarLocais] = useCarga(buscarLocaisAtivos);
  const [rotas, recarregarRotas] = useCarga(buscarRotas);
  const [funcionarios, recarregarFuncionarios] = useCarga(buscarFuncionarios);

  const [reduzirMovimento, setReduzirMovimento] = useState<boolean | null>(
    null,
  );
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(
      (ativo) => setReduzirMovimento(ativo),
      () => setReduzirMovimento(false),
    );
  }, []);

  const [passo, setPasso] = useState<Passo>(1);
  const corpoRef = useRef<ScrollView>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: roda a cada troca de passo
  useEffect(() => {
    corpoRef.current?.scrollTo({ y: 0, animated: false });
  }, [passo]);

  const [titulo, setTitulo] = useState('');
  const [tipoId, setTipoId] = useState<string | null>(null);
  const [localId, setLocalId] = useState<string | null>(null);
  const [periodicidade, setPeriodicidade] = useState<Periodicidade | null>(
    null,
  );
  const [dataInicio, setDataInicio] = useState(hojeLocal());
  const [comoExecutar, setComoExecutar] = useState('');

  const [escolhaRota, setEscolhaRota] = useState<EscolhaRota | null>(null);
  const [nomeNovaRota, setNomeNovaRota] = useState('');
  const [responsavelId, setResponsavelId] = useState<string | null>(null);

  const [erros, setErros] = useState<Partial<Record<CampoComErro, string>>>({});

  const [seletorLocalVisivel, setSeletorLocalVisivel] = useState(false);
  const [buscaLocal, setBuscaLocal] = useState('');
  const [calendarioVisivel, setCalendarioVisivel] = useState(false);
  const [confirmarDescarteVisivel, setConfirmarDescarteVisivel] =
    useState(false);

  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  // Guardados entre tentativas: uma nova tentativa depois de falha parcial
  // nunca cria uma segunda rota nem um segundo plano.
  const [rotaCriada, setRotaCriada] = useState<Rota | null>(null);
  const [planoCriado, setPlanoCriado] = useState<PlanoManutencao | null>(null);

  function limparErro(campo: CampoComErro) {
    setErros((atual) => {
      if (!atual[campo]) {
        return atual;
      }
      const novo = { ...atual };
      delete novo[campo];
      return novo;
    });
  }

  const funcionariosPorId = useMemo(() => {
    const mapa = new Map<string, Funcionario>();
    if (funcionarios.estado === 'pronto') {
      for (const item of funcionarios.dados) {
        mapa.set(item.id, item);
      }
    }
    return mapa;
  }, [funcionarios]);

  const funcionariosAtivos = useMemo(
    () =>
      funcionarios.estado === 'pronto'
        ? funcionarios.dados.filter((item) => item.ativo)
        : [],
    [funcionarios],
  );

  const rotaSelecionada =
    escolhaRota?.tipo === 'existente' && rotas.estado === 'pronto'
      ? (rotas.dados.find((rota) => rota.id === escolhaRota.rotaId) ?? null)
      : null;

  const responsavelAtualDaRota = rotaSelecionada?.funcionario_id
    ? (funcionariosPorId.get(rotaSelecionada.funcionario_id) ?? null)
    : null;

  const precisaPasso3 =
    escolhaRota?.tipo === 'nova' ||
    !rotaSelecionada?.funcionario_id ||
    !responsavelAtualDaRota?.ativo;

  const tipoSelecionado =
    tipos.estado === 'pronto'
      ? tipos.dados.find((tipo) => tipo.id === tipoId)
      : undefined;
  const localSelecionado =
    locais.estado === 'pronto'
      ? locais.dados.find((local) => local.id === localId)
      : undefined;

  const temDadosPreenchidos =
    titulo.trim().length > 0 ||
    tipoId !== null ||
    localId !== null ||
    periodicidade !== null ||
    comoExecutar.trim().length > 0 ||
    escolhaRota !== null ||
    nomeNovaRota.trim().length > 0 ||
    responsavelId !== null;

  function pedirFechar() {
    if (salvando) {
      return;
    }
    if (temDadosPreenchidos) {
      setConfirmarDescarteVisivel(true);
      return;
    }
    onFechar();
  }

  function podeVoltar() {
    return passo > 1 && !planoCriado && !salvando;
  }

  function voltar() {
    if (!podeVoltar()) {
      return;
    }
    setErros({});
    setErroSalvar(null);
    if (passo === 4) {
      setPasso(precisaPasso3 ? 3 : 2);
    } else if (passo === 3) {
      setPasso(2);
    } else {
      setPasso(1);
    }
  }

  function handleRequestClose() {
    if (seletorLocalVisivel) {
      setSeletorLocalVisivel(false);
      return;
    }
    if (calendarioVisivel) {
      setCalendarioVisivel(false);
      return;
    }
    if (podeVoltar()) {
      voltar();
      return;
    }
    pedirFechar();
  }

  function validarPasso1(): boolean {
    const novos: Partial<Record<CampoComErro, string>> = {};
    if (!titulo.trim()) {
      novos.titulo = 'Informe o que precisa ser feito.';
    }
    if (!tipoId) {
      novos.tipo = 'Escolha o tipo.';
    }
    if (!localId) {
      novos.local = 'Escolha o local.';
    }
    if (!periodicidade || !dataInicio) {
      novos.repeticao = 'Escolha a repetição.';
    }
    setErros(novos);
    return Object.keys(novos).length === 0;
  }

  function validarPasso2(): boolean {
    const novos: Partial<Record<CampoComErro, string>> = {};
    if (!escolhaRota) {
      novos.rota = 'Escolha uma rota ou crie uma nova.';
    } else if (escolhaRota.tipo === 'nova' && !nomeNovaRota.trim()) {
      novos.nomeNovaRota = 'Informe o nome da nova rota.';
    } else if (funcionarios.estado !== 'pronto') {
      novos.rota =
        'Ainda não foi possível carregar os responsáveis. Toque em “Tentar de novo”.';
    }
    setErros(novos);
    return Object.keys(novos).length === 0;
  }

  function validarPasso3(): boolean {
    if (!responsavelId || !funcionariosPorId.get(responsavelId)?.ativo) {
      setErros({ responsavel: 'Escolha quem cuida desta rota.' });
      return false;
    }
    setErros({});
    return true;
  }

  function continuar() {
    if (passo === 1 && validarPasso1()) {
      setPasso(2);
    } else if (passo === 2 && validarPasso2()) {
      setPasso(precisaPasso3 ? 3 : 4);
    } else if (passo === 3 && validarPasso3()) {
      setPasso(4);
    } else if (passo === 4) {
      salvar();
    }
  }

  async function salvar() {
    if (salvando || !escolhaRota || !tipoId || !localId || !periodicidade) {
      return;
    }

    setSalvando(true);
    setErroSalvar(null);

    const responsavelFinal = precisaPasso3
      ? responsavelId
      : (rotaSelecionada?.funcionario_id ?? null);
    let etapa: EtapaGravacao = 'rota';
    let rotaCriadaAtual = rotaCriada;

    try {
      if (planoCriado) {
        etapa = 'ordens';
        await gerarOrdensIniciaisDoPlano(planoCriado);
      } else {
        let rotaId: string;
        let ordemNaRota: number | null;

        if (escolhaRota.tipo === 'nova') {
          const nome = nomeNovaRota.trim();
          etapa = 'rota';
          if (!rotaCriadaAtual) {
            rotaCriadaAtual = await criarRota({
              nome,
              funcionario_id: responsavelFinal,
            });
            setRotaCriada(rotaCriadaAtual);
          } else if (
            rotaCriadaAtual.nome !== nome ||
            rotaCriadaAtual.funcionario_id !== responsavelFinal
          ) {
            // Voltou e mudou o nome/responsável depois da falha: ajusta a
            // rota já criada em vez de criar outra.
            rotaCriadaAtual = await atualizarRota(rotaCriadaAtual.id, {
              nome,
              funcionario_id: responsavelFinal,
            });
            setRotaCriada(rotaCriadaAtual);
          }
          rotaId = rotaCriadaAtual.id;
          ordemNaRota = 1;
        } else {
          rotaId = escolhaRota.rotaId;
          if (precisaPasso3) {
            etapa = 'responsavel';
            await atualizarRota(rotaId, { funcionario_id: responsavelFinal });
          }
          etapa = 'atividade';
          ordemNaRota = await proximaOrdemNaRota(rotaId).catch(() => null);
        }

        etapa = 'atividade';
        await criarPlanoManutencao({
          titulo: titulo.trim(),
          tipo_id: tipoId,
          descricao: comoExecutar.trim() || null,
          local_id: localId,
          periodicidade,
          prioridade: PRIORIDADE_PADRAO,
          data_inicio: dataInicio,
          observacoes: null,
          rota_id: rotaId,
          ordem_na_rota: ordemNaRota,
        });
      }

      await onSalvo();
    } catch (erro) {
      if (erro instanceof ErroGeracaoOrdens) {
        etapa = 'ordens';
        setPlanoCriado(erro.plano);
      }
      console.error('FluxoNovaAtividade: falha ao salvar', etapa, erro);
      setErroSalvar(mensagemDeFalha(etapa, rotaCriadaAtual));
    } finally {
      setSalvando(false);
    }
  }

  const locaisFiltrados = useMemo(() => {
    if (locais.estado !== 'pronto') {
      return [];
    }
    const termo = normalizarTexto(buscaLocal.trim());
    if (!termo) {
      return locais.dados;
    }
    return locais.dados.filter((local) =>
      normalizarTexto(local.nome).includes(termo),
    );
  }, [locais, buscaLocal]);

  function nomeResponsavel(id: string | null): string {
    if (!id) {
      return 'Sem responsável';
    }
    return funcionariosPorId.get(id)?.nome ?? 'Responsável não encontrado';
  }

  function textoRepeticao(): string {
    const data = formatarDataBR(dataInicio);
    if (periodicidade === 'Única') {
      return `Única, em ${data}`;
    }
    return `${periodicidade ?? ''}, a partir de ${data}`;
  }

  function renderPasso1() {
    return (
      <>
        <Text style={styles.pergunta}>O que precisa ser feito?</Text>

        <View style={styles.pauta}>
          <LinhaCampo rotulo="Título" erro={erros.titulo}>
            <TextInput
              value={titulo}
              onChangeText={(valor) => {
                setTitulo(valor);
                limparErro('titulo');
              }}
              placeholder="Ex.: Limpar a caixa d’água"
              placeholderTextColor={light.textMuted}
              style={styles.inputPautado}
            />
          </LinhaCampo>

          <LinhaCampo rotulo="Tipo" erro={erros.tipo}>
            {tipos.estado === 'carregando' ? (
              <Text style={styles.carregandoTexto}>Carregando tipos…</Text>
            ) : tipos.estado === 'erro' ? (
              <FalhaCarga
                texto="Não foi possível carregar os tipos."
                onTentar={recarregarTipos}
              />
            ) : (
              <View style={styles.chipWrap}>
                {tipos.dados.map((tipo) => (
                  <Chip
                    key={tipo.id}
                    label={tipo.nome}
                    selected={tipoId === tipo.id}
                    onPress={() => {
                      setTipoId(tipo.id);
                      limparErro('tipo');
                    }}
                  />
                ))}
              </View>
            )}
          </LinhaCampo>

          <LinhaCampo rotulo="Local" erro={erros.local}>
            <Pressable
              onPress={() => {
                setBuscaLocal('');
                setSeletorLocalVisivel(true);
              }}
              style={styles.gatilho}
            >
              <Text
                style={
                  localSelecionado ? styles.gatilhoTexto : styles.placeholder
                }
              >
                {localSelecionado?.nome ?? 'Escolher local'}
              </Text>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={light.textSecondary}
              />
            </Pressable>
          </LinhaCampo>

          <LinhaCampo rotulo="Repetição" erro={erros.repeticao}>
            <View style={styles.chipWrap}>
              {PERIODICIDADES.map((item) => (
                <Chip
                  key={item}
                  label={item}
                  selected={periodicidade === item}
                  onPress={() => {
                    setPeriodicidade(item);
                    limparErro('repeticao');
                  }}
                />
              ))}
            </View>
            <Pressable
              onPress={() => setCalendarioVisivel(true)}
              style={[styles.gatilho, styles.gatilhoData]}
            >
              <Text style={styles.gatilhoTexto}>
                {periodicidade === 'Única' ? 'Em ' : 'A partir de '}
                {formatarDataBR(dataInicio)}
              </Text>
              <Ionicons
                name="calendar-outline"
                size={18}
                color={light.textSecondary}
              />
            </Pressable>
          </LinhaCampo>

          <LinhaCampo rotulo="Como executar (opcional)">
            <TextInput
              value={comoExecutar}
              onChangeText={setComoExecutar}
              placeholder="Passos, materiais, cuidados"
              placeholderTextColor={light.textMuted}
              multiline
              style={[styles.inputPautado, styles.inputMultilinha]}
            />
          </LinhaCampo>
        </View>
      </>
    );
  }

  function renderPasso2() {
    const carregandoPasso =
      rotas.estado === 'carregando' || funcionarios.estado === 'carregando';

    return (
      <>
        <Text style={styles.pergunta}>Em qual rota ela entra?</Text>
        <Text style={styles.subtitulo}>
          Rota é o percurso de um responsável.
        </Text>

        {carregandoPasso ? (
          <Text style={styles.carregandoTexto}>Carregando rotas…</Text>
        ) : rotas.estado === 'erro' ? (
          <FalhaCarga
            texto="Não foi possível carregar as rotas."
            onTentar={recarregarRotas}
          />
        ) : rotas.estado === 'pronto' ? (
          <>
            {funcionarios.estado === 'erro' ? (
              <FalhaCarga
                texto="Não foi possível carregar os responsáveis."
                onTentar={recarregarFuncionarios}
              />
            ) : null}

            <View style={styles.pauta}>
              {rotas.dados.map((rota) => {
                const responsavel = rota.funcionario_id
                  ? funcionariosPorId.get(rota.funcionario_id)
                  : undefined;
                const semResponsavelAtivo =
                  !rota.funcionario_id ||
                  (funcionarios.estado === 'pronto' && !responsavel?.ativo);
                const detalhe = !rota.funcionario_id
                  ? 'Sem responsável'
                  : responsavel
                    ? responsavel.ativo
                      ? responsavel.nome
                      : `${responsavel.nome} · inativo`
                    : funcionarios.estado === 'erro'
                      ? 'Responsável definido'
                      : 'Sem responsável';
                return (
                  <LinhaOpcao
                    key={rota.id}
                    titulo={rota.nome}
                    detalhe={detalhe}
                    detalheAlerta={semResponsavelAtivo}
                    selecionada={
                      escolhaRota?.tipo === 'existente' &&
                      escolhaRota.rotaId === rota.id
                    }
                    onPress={() => {
                      setEscolhaRota({ tipo: 'existente', rotaId: rota.id });
                      limparErro('rota');
                      limparErro('nomeNovaRota');
                    }}
                  />
                );
              })}

              <LinhaOpcao
                titulo="Criar nova rota"
                icone="add"
                selecionada={escolhaRota?.tipo === 'nova'}
                onPress={() => {
                  setEscolhaRota({ tipo: 'nova' });
                  limparErro('rota');
                }}
              />

              {escolhaRota?.tipo === 'nova' ? (
                <LinhaCampo
                  rotulo="Nome da nova rota"
                  erro={erros.nomeNovaRota}
                >
                  <TextInput
                    value={nomeNovaRota}
                    onChangeText={(valor) => {
                      setNomeNovaRota(valor);
                      limparErro('nomeNovaRota');
                    }}
                    placeholder="Ex.: Áreas comuns — manhã"
                    placeholderTextColor={light.textMuted}
                    autoFocus
                    style={styles.inputPautado}
                  />
                </LinhaCampo>
              ) : null}
            </View>
          </>
        ) : null}

        {erros.rota ? <Text style={styles.erro}>{erros.rota}</Text> : null}
      </>
    );
  }

  function renderPasso3() {
    let contexto = '';
    if (escolhaRota?.tipo === 'nova') {
      contexto = `A rota “${nomeNovaRota.trim()}” é nova.`;
    } else if (rotaSelecionada && !rotaSelecionada.funcionario_id) {
      contexto = `A rota “${rotaSelecionada.nome}” está sem responsável.`;
    } else if (rotaSelecionada && responsavelAtualDaRota) {
      contexto = `${responsavelAtualDaRota.nome} está inativo e não pode cuidar da rota “${rotaSelecionada.nome}”.`;
    }

    return (
      <>
        <Text style={styles.pergunta}>Quem cuida desta rota?</Text>
        {contexto ? <Text style={styles.subtitulo}>{contexto}</Text> : null}

        {funcionarios.estado === 'carregando' ? (
          <Text style={styles.carregandoTexto}>Carregando usuários…</Text>
        ) : funcionarios.estado === 'erro' ? (
          <FalhaCarga
            texto="Não foi possível carregar os usuários."
            onTentar={recarregarFuncionarios}
          />
        ) : funcionariosAtivos.length === 0 ? (
          <Text style={styles.carregandoTexto}>
            Nenhum usuário ativo cadastrado.
          </Text>
        ) : (
          <View style={styles.pauta}>
            {funcionariosAtivos.map((funcionario) => (
              <LinhaOpcao
                key={funcionario.id}
                titulo={funcionario.nome}
                detalhe={funcionario.funcao ?? undefined}
                selecionada={responsavelId === funcionario.id}
                onPress={() => {
                  setResponsavelId(funcionario.id);
                  limparErro('responsavel');
                }}
              />
            ))}
          </View>
        )}

        {erros.responsavel ? (
          <Text style={styles.erro}>{erros.responsavel}</Text>
        ) : null}
      </>
    );
  }

  function renderPasso4() {
    const nomeRota =
      escolhaRota?.tipo === 'nova'
        ? `${nomeNovaRota.trim()} (nova)`
        : (rotaSelecionada?.nome ?? '');
    const responsavelTexto = precisaPasso3
      ? nomeResponsavel(responsavelId)
      : `${nomeResponsavel(rotaSelecionada?.funcionario_id ?? null)} (responsável da rota)`;

    return (
      <>
        <Text style={styles.pergunta}>Confira antes de salvar</Text>

        <View style={styles.pauta}>
          <LinhaResumo rotulo="Atividade" valor={titulo.trim()} />
          <LinhaResumo rotulo="Tipo" valor={tipoSelecionado?.nome ?? ''} />
          <LinhaResumo rotulo="Local" valor={localSelecionado?.nome ?? ''} />
          <LinhaResumo rotulo="Repetição" valor={textoRepeticao()} />
          <LinhaResumo rotulo="Rota" valor={nomeRota} />
          <LinhaResumo rotulo="Responsável" valor={responsavelTexto} />
        </View>

        {erroSalvar ? <Text style={styles.erro}>{erroSalvar}</Text> : null}
      </>
    );
  }

  const rotuloBotao =
    passo < 4 ? 'Continuar' : salvando ? 'Salvando…' : 'Salvar atividade';

  return (
    <Modal
      visible={reduzirMovimento !== null}
      transparent={false}
      animationType={reduzirMovimento ? 'none' : 'slide'}
      onRequestClose={handleRequestClose}
    >
      <View style={styles.tela}>
        <View
          style={[styles.cabecalho, { paddingTop: insets.top + spacing.md }]}
        >
          {podeVoltar() ? (
            <Pressable
              style={styles.cabecalhoBotao}
              onPress={voltar}
              hitSlop={8}
              accessibilityLabel="Voltar"
            >
              <Ionicons
                name="chevron-back"
                size={24}
                color={light.textPrimary}
              />
            </Pressable>
          ) : (
            <View style={styles.cabecalhoBotao} />
          )}
          <Text style={styles.cabecalhoTitulo}>Nova atividade</Text>
          <Pressable
            style={styles.cabecalhoBotao}
            onPress={pedirFechar}
            hitSlop={8}
            accessibilityLabel="Fechar"
          >
            <Ionicons
              name="close-outline"
              size={26}
              color={light.textPrimary}
            />
          </Pressable>
        </View>

        <View style={styles.progresso}>
          {([1, 2, 3, 4] as Passo[]).map((item) => (
            <View
              key={item}
              style={[
                styles.progressoSegmento,
                item <= passo && styles.progressoSegmentoAtivo,
              ]}
            />
          ))}
        </View>
        <Text style={styles.progressoTexto}>Passo {passo} de 4</Text>

        <ScrollView
          ref={corpoRef}
          contentContainerStyle={styles.corpo}
          keyboardShouldPersistTaps="handled"
        >
          {passo === 1 ? renderPasso1() : null}
          {passo === 2 ? renderPasso2() : null}
          {passo === 3 ? renderPasso3() : null}
          {passo === 4 ? renderPasso4() : null}
        </ScrollView>

        <View
          style={[styles.rodape, { paddingBottom: insets.bottom + spacing.md }]}
        >
          <Pressable
            onPress={continuar}
            style={({ pressed }) => [
              styles.botaoPrincipal,
              pressed && styles.botaoPrincipalPressionado,
            ]}
          >
            <Text style={styles.botaoPrincipalTexto}>{rotuloBotao}</Text>
          </Pressable>
        </View>

        {seletorLocalVisivel ? (
          <View style={styles.overlay}>
            <View style={[styles.overlayCard, styles.overlayCardAlto]}>
              <Text style={styles.overlayTitulo}>Escolher local</Text>
              {locais.estado === 'carregando' ? (
                <Text style={styles.carregandoTexto}>Carregando locais…</Text>
              ) : locais.estado === 'erro' ? (
                <FalhaCarga
                  texto="Não foi possível carregar os locais."
                  onTentar={recarregarLocais}
                />
              ) : (
                <>
                  <TextInput
                    value={buscaLocal}
                    onChangeText={setBuscaLocal}
                    placeholder="Buscar por nome"
                    placeholderTextColor={light.textMuted}
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={styles.inputBusca}
                  />
                  <ScrollView
                    style={styles.overlayLista}
                    keyboardShouldPersistTaps="handled"
                  >
                    {locaisFiltrados.length === 0 ? (
                      <Text style={styles.carregandoTexto}>
                        Nenhum local encontrado.
                      </Text>
                    ) : (
                      locaisFiltrados.map((local) => (
                        <LinhaOpcao
                          key={local.id}
                          titulo={local.nome}
                          selecionada={localId === local.id}
                          onPress={() => {
                            setLocalId(local.id);
                            limparErro('local');
                            setSeletorLocalVisivel(false);
                          }}
                        />
                      ))
                    )}
                  </ScrollView>
                </>
              )}
              <Pressable
                onPress={() => setSeletorLocalVisivel(false)}
                style={styles.overlayFechar}
              >
                <Text style={styles.linkSecundario}>Fechar</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {calendarioVisivel ? (
          <View style={styles.overlay}>
            <View style={styles.overlayCard}>
              <Text style={styles.overlayTitulo}>Data de início</Text>
              <MiniCalendar
                markedDates={{}}
                selectedDate={dataInicio}
                onSelectDay={(data) => {
                  setDataInicio(data);
                  limparErro('repeticao');
                  setCalendarioVisivel(false);
                }}
                desabilitarAntesDe={hojeLocal()}
              />
              <Pressable
                onPress={() => setCalendarioVisivel(false)}
                style={styles.overlayFechar}
              >
                <Text style={styles.linkSecundario}>Cancelar</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>

      <Modal
        visible={confirmarDescarteVisivel}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmarDescarteVisivel(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.overlayCard}>
            <Text style={styles.overlayTitulo}>Descartar atividade?</Text>
            <Text style={styles.textoConfirmacao}>
              {rotaCriada
                ? `O que você preencheu será perdido. A rota “${rotaCriada.nome}” já foi criada e continuará existindo.`
                : 'O que você preencheu será perdido.'}
            </Text>
            <View style={styles.confirmacaoBotoes}>
              <Pressable
                onPress={() => setConfirmarDescarteVisivel(false)}
                style={styles.confirmacaoCancelar}
              >
                <Text style={styles.linkSecundario}>Continuar editando</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setConfirmarDescarteVisivel(false);
                  onFechar();
                }}
                style={({ pressed }) => [
                  styles.botaoDescartar,
                  pressed && styles.botaoDescartarPressionado,
                ]}
              >
                <Text style={styles.botaoDescartarTexto}>Descartar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

function LinhaCampo({
  rotulo,
  erro,
  children,
}: {
  rotulo: string;
  erro?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.linha}>
      <Text style={styles.rotulo}>{rotulo}</Text>
      {children}
      {erro ? <Text style={styles.erroCampo}>{erro}</Text> : null}
    </View>
  );
}

function LinhaOpcao({
  titulo,
  detalhe,
  detalheAlerta = false,
  selecionada,
  icone,
  onPress,
}: {
  titulo: string;
  detalhe?: string;
  detalheAlerta?: boolean;
  selecionada: boolean;
  icone?: 'add';
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      role="radio"
      aria-checked={selecionada}
      style={({ pressed }) => [
        styles.linha,
        styles.linhaOpcao,
        pressed && styles.linhaPressionada,
      ]}
    >
      <View style={styles.linhaOpcaoTextos}>
        <View style={styles.linhaOpcaoTituloRow}>
          {icone ? (
            <Ionicons name={icone} size={18} color={light.inkAction} />
          ) : null}
          <Text style={styles.linhaOpcaoTitulo}>{titulo}</Text>
        </View>
        {detalhe ? (
          <Text
            style={[
              styles.linhaOpcaoDetalhe,
              detalheAlerta && styles.linhaOpcaoDetalheAlerta,
            ]}
          >
            {detalhe}
          </Text>
        ) : null}
      </View>
      <View style={[styles.radio, selecionada && styles.radioSelecionado]}>
        {selecionada ? (
          <Ionicons name="checkmark" size={14} color={light.bg} />
        ) : null}
      </View>
    </Pressable>
  );
}

function LinhaResumo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <View style={styles.linha}>
      <Text style={styles.rotulo}>{rotulo}</Text>
      <Text style={styles.resumoValor}>{valor}</Text>
    </View>
  );
}

function FalhaCarga({
  texto,
  onTentar,
}: {
  texto: string;
  onTentar: () => void;
}) {
  return (
    <View style={styles.falhaCarga}>
      <Text style={styles.erro}>{texto}</Text>
      <Pressable onPress={onTentar} hitSlop={8}>
        <Text style={styles.linkSecundario}>Tentar de novo</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  tela: {
    flex: 1,
    backgroundColor: light.bg,
  },
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  cabecalhoBotao: {
    width: 32,
    alignItems: 'center',
  },
  cabecalhoTitulo: {
    flex: 1,
    fontFamily: fonts.headline,
    fontSize: 17,
    color: light.textPrimary,
    textAlign: 'center',
  },
  progresso: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
  },
  progressoSegmento: {
    flex: 1,
    height: 3,
    backgroundColor: light.border,
  },
  progressoSegmentoAtivo: {
    backgroundColor: light.inkAction,
  },
  progressoTexto: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: light.textMuted,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  corpo: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  pergunta: {
    fontFamily: fonts.headline,
    fontSize: 17,
    lineHeight: 22,
    color: light.textPrimary,
    marginBottom: spacing.sm,
  },
  subtitulo: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: light.textSecondary,
    marginBottom: spacing.sm,
  },
  // Primeira linha de um grupo pautado leva a régua de 2px em tinta; as
  // demais só a régua fina — ver DESIGN.md → Ruled Rows.
  pauta: {
    marginTop: spacing.md,
    borderTopWidth: 2,
    borderTopColor: light.inkAction,
  },
  linha: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: light.border,
    gap: spacing.sm,
  },
  linhaPressionada: {
    backgroundColor: light.sunken,
  },
  rotulo: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: light.textSecondary,
  },
  inputPautado: {
    fontFamily: fonts.regular,
    fontSize: 16,
    color: light.textPrimary,
    paddingVertical: spacing.xs,
  },
  inputMultilinha: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  gatilho: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  gatilhoData: {
    marginTop: spacing.xs,
  },
  gatilhoTexto: {
    fontFamily: fonts.regular,
    fontSize: 16,
    color: light.textPrimary,
  },
  placeholder: {
    fontFamily: fonts.regular,
    fontSize: 16,
    color: light.textMuted,
  },
  linhaOpcao: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  linhaOpcaoTextos: {
    flex: 1,
    gap: 2,
  },
  linhaOpcaoTituloRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  linhaOpcaoTitulo: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: light.textPrimary,
  },
  linhaOpcaoDetalhe: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: light.textSecondary,
  },
  linhaOpcaoDetalheAlerta: {
    color: semantic.pending,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: light.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelecionado: {
    backgroundColor: light.inkAction,
    borderColor: light.inkAction,
  },
  resumoValor: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: light.textPrimary,
  },
  carregandoTexto: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: light.textSecondary,
    paddingVertical: spacing.md,
  },
  erro: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: semantic.overdue,
    marginTop: spacing.md,
  },
  erroCampo: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: semantic.overdue,
  },
  falhaCarga: {
    gap: spacing.xs,
    alignItems: 'flex-start',
  },
  linkSecundario: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: light.inkAction,
    textDecorationLine: 'underline',
  },
  rodape: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: light.border,
  },
  botaoPrincipal: {
    alignItems: 'center',
    paddingVertical: spacing.sm + 4,
    borderRadius: radius.md,
    backgroundColor: light.inkAction,
  },
  botaoPrincipalPressionado: {
    backgroundColor: light.inkActionPressed,
  },
  botaoPrincipalTexto: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: light.bg,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    padding: spacing.lg,
    zIndex: 20,
    elevation: 20,
  },
  overlayCard: {
    backgroundColor: light.card,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.md,
  },
  overlayCardAlto: {
    maxHeight: '80%',
  },
  overlayTitulo: {
    fontFamily: fonts.headline,
    fontSize: 17,
    color: light.textPrimary,
  },
  overlayLista: {
    flexGrow: 0,
  },
  overlayFechar: {
    alignSelf: 'center',
    paddingVertical: spacing.xs,
  },
  inputBusca: {
    backgroundColor: light.sunken,
    borderWidth: 1,
    borderColor: light.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: light.textPrimary,
  },
  textoConfirmacao: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: light.textSecondary,
  },
  confirmacaoBotoes: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  confirmacaoCancelar: {
    paddingVertical: spacing.sm,
  },
  botaoDescartar: {
    borderWidth: 1,
    borderColor: semantic.overdue,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  botaoDescartarPressionado: {
    backgroundColor: `${semantic.overdue}1A`,
  },
  botaoDescartarTexto: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: semantic.overdue,
  },
});

export default FluxoNovaAtividade;
