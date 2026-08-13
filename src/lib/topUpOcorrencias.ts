import {
  adicionarDiasChave,
  gerarDatasOcorrencia,
  JANELA_DIAS,
  type Periodicidade,
  proximaDataPeriodicidade,
} from '../data/manutencao';
import { supabase } from './supabase';

const hoje = () => new Date().toISOString().slice(0, 10);

// Rolling window: para cada plano ativo com periodicidade recorrente,
// garante que existam ordens_servico geradas até hoje + JANELA_DIAS.
// Roda em background após o primeiro carregamento da tela — best-effort,
// não bloqueia a renderização e ignora falhas silenciosamente.
export async function preencherOcorrenciasFaltantes(): Promise<void> {
  try {
    const { data: planos, error: erroPlanos } = await supabase
      .from('planos_manutencao')
      .select('id, data_inicio, periodicidade')
      .eq('ativo', true)
      .neq('periodicidade', 'Única');

    if (erroPlanos || !planos || planos.length === 0) {
      return;
    }

    const ateData = adicionarDiasChave(hoje(), JANELA_DIAS);

    for (const plano of planos) {
      const periodicidade = plano.periodicidade as Periodicidade;

      const { data: ultimaOrdem } = await supabase
        .from('ordens_servico')
        .select('data_prevista')
        .eq('plano_id', plano.id)
        .order('data_prevista', { ascending: false })
        .limit(1)
        .maybeSingle();

      const proximaData = ultimaOrdem?.data_prevista
        ? proximaDataPeriodicidade(ultimaOrdem.data_prevista, periodicidade)
        : plano.data_inicio;

      const datasFaltantes = gerarDatasOcorrencia(
        proximaData,
        periodicidade,
        ateData,
      );

      if (datasFaltantes.length === 0) {
        continue;
      }

      await supabase.from('ordens_servico').insert(
        datasFaltantes.map((data) => ({
          plano_id: plano.id,
          data_prevista: data,
          status: 'pendente',
        })),
      );
    }
  } catch {
    // Top-up é best-effort; falha aqui não deve afetar a tela.
  }
}

export default preencherOcorrenciasFaltantes;
