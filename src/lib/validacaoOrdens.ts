import type { Qualidade } from '../data/manutencao';
import { supabase } from './supabase';

// Ações da dupla checagem (validar/reprovar uma ordem concluída) —
// extraídas de dentro de src/components/ValidacaoGuiada.tsx, onde viviam
// como handlers presos ao estado local do fluxo guiado (fila/filaIndex).
// Isoladas aqui, parametrizadas por ordemId, pra serem chamadas tanto pelo
// fluxo guiado quanto pela lista inline em app/admin/preservacao.tsx, sem
// duplicar a lógica.

export async function validarOrdem(
  ordemId: string,
  qualidade: Qualidade,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('ordens_servico')
    .update({
      validada: true,
      qualidade,
      validada_em: new Date().toISOString(),
      validada_por: 'Teste Administrador',
    })
    .eq('id', ordemId);

  return { error: error?.message ?? null };
}

export async function reprovarOrdem(
  ordemId: string,
  motivo: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('ordens_servico')
    .update({
      status: 'pendente',
      concluida_em: null,
      concluida_por: null,
      iniciado_em: null,
      motivo_reprovacao: motivo.trim() || null,
      reprovacao_pendente: true,
      reprovada_em: new Date().toISOString(),
    })
    .eq('id', ordemId);

  return { error: error?.message ?? null };
}
