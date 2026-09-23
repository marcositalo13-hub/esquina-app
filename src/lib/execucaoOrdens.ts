import { supabase } from './supabase';

// Ações de execução de uma ordem de serviço (iniciar/pausar/retomar/
// concluir) — extraídas de dentro de src/components/ExecucaoGuiada.tsx,
// onde viviam como closures presas ao estado local do fluxo guiado
// (ordemAtual, derivado de etapaAtual). Isoladas aqui, parametrizadas por
// ordemId, pra serem chamadas tanto pelo fluxo guiado quanto pelo modo
// Lista em app/preservacao.tsx, sem duplicar a lógica nem criar uma
// segunda máquina de estado.

export async function iniciarOrdem(
  ordemId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('ordens_servico')
    .update({ status: 'em_andamento', iniciado_em: new Date().toISOString() })
    .eq('id', ordemId);

  return { error: error?.message ?? null };
}

export async function pausarOrdem(
  ordemId: string,
): Promise<{ error: string | null; pausadoEm: string | null }> {
  const agora = new Date().toISOString();

  const { error } = await supabase
    .from('ordens_servico')
    .update({ pausado_em: agora })
    .eq('id', ordemId);

  if (error) {
    return { error: error.message, pausadoEm: null };
  }
  return { error: null, pausadoEm: agora };
}

export async function retomarOrdem(
  ordemId: string,
  pausadoEmAtual: string,
  tempoPausadoAtual: number,
): Promise<{ error: string | null; tempoPausadoNovo: number | null }> {
  const segundosPausado = Math.max(
    0,
    Math.round((Date.now() - new Date(pausadoEmAtual).getTime()) / 1000),
  );
  const tempoPausadoNovo = tempoPausadoAtual + segundosPausado;

  const { error } = await supabase
    .from('ordens_servico')
    .update({
      tempo_pausado_segundos: tempoPausadoNovo,
      pausado_em: null,
    })
    .eq('id', ordemId);

  if (error) {
    return { error: error.message, tempoPausadoNovo: null };
  }
  return { error: null, tempoPausadoNovo };
}

export async function concluirOrdem(
  ordemId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('ordens_servico')
    .update({
      status: 'concluida',
      concluida_em: new Date().toISOString(),
      concluida_por: 'Teste Preservação',
    })
    .eq('id', ordemId);

  return { error: error?.message ?? null };
}

// Segundos decorridos de uma ordem em andamento, descontando pausas —
// mesma conta usada em admin/preservacao.tsx pra "Tempo: Xmin" de ordens
// concluídas (concluida_em no lugar de "agora"), só que aqui recalculada a
// cada tick pra alimentar um timer ao vivo. Nunca soma nada em estado local
// — sempre deriva de iniciado_em/pausado_em/tempo_pausado_segundos, que são
// os únicos valores realmente persistidos; por isso trocar de modo (Lista
// ⇄ Guiada) nunca reseta ou interrompe a contagem.
export function calcularSegundosDecorridos(
  iniciadoEm: string,
  pausadoEm: string | null,
  tempoPausadoSegundos: number,
): number {
  const fimContagem = pausadoEm ? new Date(pausadoEm).getTime() : Date.now();
  const bruto = (fimContagem - new Date(iniciadoEm).getTime()) / 1000;
  return Math.max(0, Math.round(bruto) - tempoPausadoSegundos);
}
