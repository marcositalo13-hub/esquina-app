import { formatarDiaCurto, formatarHoraBrasil } from './agendaZeladoria';
import { getQualidadeInfo, type OrdemServico } from './manutencao';

// Tradução de uma ordem de serviço em etapas do trilho (formato aceito por
// src/components/TrilhoEtapas.tsx). Só dados — nenhuma cor ou estilo: o
// componente decide a aparência a partir do estado.
export type EtapaHistorico = {
  rotulo: string;
  estado: 'concluida' | 'atual' | 'pendente' | 'alerta';
  detalhe?: string;
};

function juntar(partes: (string | null | undefined)[]): string | undefined {
  const texto = partes.filter(Boolean).join(' · ');
  return texto || undefined;
}

function hora(instante: string | null): string | null {
  return instante ? formatarHoraBrasil(instante) : null;
}

// Só usa o que a ordem guarda. Atenção: a reprovação apaga iniciado_em,
// concluida_em e concluida_por da tentativa reprovada (ver reprovarOrdem em
// src/lib/validacaoOrdens.ts) — por isso, numa ordem reprovada, "Em
// execução" e "Concluída" aparecem sem horário nem nome.
export function etapasDaOrdem(ordem: OrdemServico): EtapaHistorico[] {
  const programada: EtapaHistorico = {
    rotulo: 'Programada',
    estado: 'concluida',
    detalhe: ordem.data_prevista
      ? formatarDiaCurto(ordem.data_prevista)
      : undefined,
  };
  const emAndamento = ordem.status === 'em_andamento';
  const pausada = emAndamento && ordem.pausado_em !== null;

  if (ordem.reprovacao_pendente) {
    return [
      programada,
      // A execução reprovada aconteceu, mas o início dela foi apagado.
      { rotulo: 'Em execução', estado: 'concluida' },
      {
        rotulo: 'Concluída',
        estado: 'alerta',
        detalhe: juntar([
          'reprovada',
          hora(ordem.reprovada_em),
          ordem.motivo_reprovacao,
        ]),
      },
      {
        rotulo: 'Refazer',
        estado: 'atual',
        detalhe: emAndamento
          ? juntar([
              'refazendo',
              hora(ordem.iniciado_em),
              pausada ? 'pausada' : null,
            ])
          : 'aguardando o responsável',
      },
    ];
  }

  const concluida = ordem.status === 'concluida';

  const execucao: EtapaHistorico = emAndamento
    ? {
        rotulo: 'Em execução',
        estado: 'atual',
        detalhe: juntar([hora(ordem.iniciado_em), pausada ? 'pausada' : null]),
      }
    : concluida || ordem.iniciado_em
      ? {
          rotulo: 'Em execução',
          estado: 'concluida',
          detalhe: juntar([hora(ordem.iniciado_em)]),
        }
      : { rotulo: 'Em execução', estado: 'pendente' };

  const conclusao: EtapaHistorico = concluida
    ? {
        rotulo: 'Concluída',
        estado: 'concluida',
        detalhe: juntar([hora(ordem.concluida_em), ordem.concluida_por]),
      }
    : { rotulo: 'Concluída', estado: 'pendente' };

  const validacao: EtapaHistorico = ordem.validada
    ? {
        rotulo: 'Validada',
        estado: 'concluida',
        detalhe: ordem.qualidade
          ? getQualidadeInfo(ordem.qualidade).label
          : undefined,
      }
    : concluida
      ? {
          rotulo: 'Validada',
          estado: 'atual',
          detalhe: 'aguardando validação',
        }
      : { rotulo: 'Validada', estado: 'pendente' };

  return [programada, execucao, conclusao, validacao];
}
